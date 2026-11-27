// Upload loop: sends the SQLite queue to POST /api/mobile/count/sync.
// Runs when the network comes back, every 15 s while counting, and right
// after every Confirm. Network errors back off (2 s, 4 s, 8 s ... max 60 s).
import NetInfo from '@react-native-community/netinfo';
import { api, ApiError, NetworkError, errorText } from './api';
import * as db from './db';

export type SyncStatus = {
  pending: number;
  rejected: number;
  syncing: boolean;
  online: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
  /** Server answered 409: session no longer open for this user. Upload paused. */
  locked: boolean;
};

type Ctx = {
  baseUrl: string;
  getToken: () => string | null;
  sessionId: number;
  userId: number;
  onUnauthorized: () => void;
  onLocked: () => void;
  /** Called after a successful sync + refresh so the screen can re-read SQLite. */
  onDataChanged: () => void;
};

const TICK_MS = 15000;

export class SyncEngine {
  private ctx: Ctx;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private again = false;
  private stopped = false;
  private failures = 0;
  private unsubNet: (() => void) | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = {
    pending: 0,
    rejected: 0,
    syncing: false,
    online: true,
    lastError: null,
    lastSyncAt: null,
    locked: false,
  };

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  start() {
    this.stopped = false;
    this.unsubNet = NetInfo.addEventListener((s) => {
      const online = s.isConnected !== false && s.isInternetReachable !== false;
      const cameBack = online && !this.status.online;
      this.set({ online });
      if (cameBack) {
        this.failures = 0;
        this.trigger();
      }
    });
    this.trigger();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.unsubNet?.();
    this.unsubNet = null;
  }

  /** Allow uploads again (after re-login or after the session reopened). */
  unlock() {
    this.set({ locked: false, lastError: null });
    this.failures = 0;
    this.trigger();
  }

  subscribe(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Re-count the queue (call after a local change). */
  async refreshCounts() {
    const c = await db.queueCounts(this.ctx.sessionId, this.ctx.userId);
    this.set(c);
  }

  trigger() {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.run();
  }

  private set(p: Partial<SyncStatus>) {
    this.status = { ...this.status, ...p };
    for (const l of this.listeners) l(this.status);
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.trigger(), ms);
  }

  private async run() {
    this.running = true;
    this.again = false;
    let next = TICK_MS;
    try {
      await this.refreshCounts();
      const token = this.ctx.getToken();
      if (!token || this.status.locked) return;
      this.set({ syncing: true });

      // Upload in batches of up to 500 + 500 until the queue is empty.
      for (let round = 0; round < 20; round++) {
        const { lines, unknowns } = await db.pendingBatch(this.ctx.sessionId, this.ctx.userId);
        if (lines.length === 0 && unknowns.length === 0) break;
        const res = await api.sync(this.ctx.baseUrl, token, {
          sessionId: this.ctx.sessionId,
          deviceNow: new Date().toISOString(),
          lines: lines.map((l) => ({
            id: l.id,
            variationId: l.variationId,
            qty: l.qty,
            spot: l.spot,
            countedAt: l.countedAt,
            deleted: l.deleted === 1,
          })),
          unknownItems: unknowns.map((u) => ({
            id: u.id,
            scannedCode: u.scannedCode,
            description: u.description,
            qty: u.qty,
            countedAt: u.countedAt,
            deleted: u.deleted === 1,
          })),
        });
        const accepted = new Set(res.accepted ?? []);
        const rejected = new Map((res.rejected ?? []).map((r) => [r.id, r.error] as const));
        await db.markResult('lines', new Map(lines.map((l) => [l.id, l.updatedAt])), accepted, rejected);
        await db.markResult(
          'unknown_items',
          new Map(unknowns.map((u) => [u.id, u.updatedAt])),
          accepted,
          rejected,
        );
        // Nothing accepted or rejected (unexpected answer): stop this round, retry later.
        if (accepted.size === 0 && rejected.size === 0) break;
      }

      // Pull every counter's lines for the running totals.
      const all = await api.lines(this.ctx.baseUrl, token, this.ctx.sessionId);
      await db.applyServerLines(this.ctx.sessionId, all.lines ?? [], all.unknownItems ?? []);
      this.failures = 0;
      this.set({ lastError: null, lastSyncAt: new Date().toISOString(), online: true });
      this.ctx.onDataChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this.set({ lastError: 'Login expired. Enter your password again.' });
        this.ctx.onUnauthorized();
        next = TICK_MS;
      } else if (e instanceof ApiError && e.status === 409) {
        this.set({ locked: true, lastError: e.message });
        this.ctx.onLocked();
      } else if (e instanceof NetworkError) {
        this.failures++;
        next = Math.min(60000, 2000 * 2 ** (this.failures - 1));
        this.set({ lastError: 'No connection. Your counts are saved on this phone and will upload later.' });
      } else {
        this.failures++;
        next = Math.min(60000, 2000 * 2 ** (this.failures - 1));
        this.set({ lastError: errorText(e) });
      }
    } finally {
      await this.refreshCounts().catch(() => {});
      this.set({ syncing: false });
      this.running = false;
      if (this.again) this.trigger();
      else this.schedule(next);
    }
  }
}
