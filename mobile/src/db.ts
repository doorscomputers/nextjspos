// On-phone database (SQLite). Everything the counter confirms is saved here
// FIRST, then uploaded by the sync loop. Nothing unsynced is ever deleted
// automatically.
import * as SQLite from 'expo-sqlite';
import type { ServerLine, ServerProduct, ServerUnknown } from './api';

/** synced column: 0 = waiting to upload, 1 = uploaded, 2 = rejected by server */
export const PENDING = 0;
export const SYNCED = 1;
export const REJECTED = 2;

export type Product = {
  variationId: number;
  productId: number;
  name: string;
  variationName: string | null;
  sku: string | null;
  subSku: string | null;
};

type QueueCols = {
  countedAt: string;
  countedByName: string | null;
  /** user who made the local change; only that user's token uploads it */
  userId: number | null;
  deleted: number;
  synced: number;
  /** 1 = the server has this id (so a delete must be uploaded) */
  onServer: number;
  error: string | null;
  updatedAt: string;
};

export type LineRow = QueueCols & {
  id: string;
  sessionId: number;
  variationId: number;
  qty: number;
  spot: string | null;
};

export type UnknownRow = QueueCols & {
  id: string;
  sessionId: number;
  scannedCode: string | null;
  description: string;
  qty: number;
};

export type CountedItem = {
  variationId: number;
  name: string | null;
  variationName: string | null;
  sku: string | null;
  subSku: string | null;
  total: number;
  lineCount: number;
  pending: number;
  rejected: number;
  lastAt: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('itcount.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT);
        CREATE TABLE IF NOT EXISTS products (
          variationId INTEGER PRIMARY KEY NOT NULL,
          productId INTEGER NOT NULL,
          name TEXT NOT NULL,
          variationName TEXT,
          sku TEXT,
          subSku TEXT,
          skuKey TEXT,
          subSkuKey TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(skuKey);
        CREATE INDEX IF NOT EXISTS idx_products_subsku ON products(subSkuKey);
        CREATE TABLE IF NOT EXISTS lines (
          id TEXT PRIMARY KEY NOT NULL,
          sessionId INTEGER NOT NULL,
          variationId INTEGER NOT NULL,
          qty REAL NOT NULL,
          spot TEXT,
          countedAt TEXT NOT NULL,
          countedByName TEXT,
          userId INTEGER,
          deleted INTEGER NOT NULL DEFAULT 0,
          synced INTEGER NOT NULL DEFAULT 0,
          onServer INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          updatedAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_lines_session ON lines(sessionId, variationId);
        CREATE TABLE IF NOT EXISTS unknown_items (
          id TEXT PRIMARY KEY NOT NULL,
          sessionId INTEGER NOT NULL,
          scannedCode TEXT,
          description TEXT NOT NULL,
          qty REAL NOT NULL,
          countedAt TEXT NOT NULL,
          countedByName TEXT,
          userId INTEGER,
          deleted INTEGER NOT NULL DEFAULT 0,
          synced INTEGER NOT NULL DEFAULT 0,
          onServer INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          updatedAt TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export const codeKey = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

const num = (v: number | string) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Rounds away floating point noise, e.g. 0.1 + 0.2 -> 0.3 */
export const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ---------- key/value settings ----------
export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}
export async function kvSet(key: string, value: string | null) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

// ---------- products ----------
export async function saveProducts(list: ServerProduct[], full: boolean) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (full) await tx.runAsync('DELETE FROM products');
    const stmt = await tx.prepareAsync(
      `INSERT INTO products (variationId, productId, name, variationName, sku, subSku, skuKey, subSkuKey)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(variationId) DO UPDATE SET productId = excluded.productId, name = excluded.name,
         variationName = excluded.variationName, sku = excluded.sku, subSku = excluded.subSku,
         skuKey = excluded.skuKey, subSkuKey = excluded.subSkuKey`,
    );
    const del = await tx.prepareAsync('DELETE FROM products WHERE variationId = ?');
    try {
      for (const p of list) {
        // `since` refresh marks removed / deactivated products with deleted: true.
        if (p.deleted) {
          await del.executeAsync(p.variationId);
          continue;
        }
        await stmt.executeAsync(
          p.variationId,
          p.productId,
          p.name ?? '',
          p.variationName ?? null,
          p.sku ?? null,
          p.subSku ?? null,
          codeKey(p.sku) || null,
          codeKey(p.subSku) || null,
        );
      }
    } finally {
      await stmt.finalizeAsync();
      await del.finalizeAsync();
    }
  });
}

export async function productCount() {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM products');
  return r?.n ?? 0;
}

/** Exact match on SKU or sub-SKU (trimmed, case-insensitive). */
export async function findByCode(code: string): Promise<Product[]> {
  const key = codeKey(code);
  if (!key) return [];
  const db = await getDb();
  return db.getAllAsync<Product>(
    `SELECT variationId, productId, name, variationName, sku, subSku FROM products
     WHERE skuKey = ? OR subSkuKey = ? ORDER BY name LIMIT 20`,
    key,
    key,
  );
}

/** Contains-search on name, variation name, SKU and sub-SKU (min 2 characters, max 50 rows). */
export async function searchProducts(q: string): Promise<Product[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const like = '%' + t.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
  const db = await getDb();
  return db.getAllAsync<Product>(
    `SELECT variationId, productId, name, variationName, sku, subSku FROM products
     WHERE name LIKE ?1 ESCAPE '\\' OR variationName LIKE ?1 ESCAPE '\\'
        OR sku LIKE ?1 ESCAPE '\\' OR subSku LIKE ?1 ESCAPE '\\'
     ORDER BY name LIMIT 50`,
    like,
  );
}

export async function getProduct(variationId: number): Promise<Product | null> {
  const db = await getDb();
  return db.getFirstAsync<Product>(
    'SELECT variationId, productId, name, variationName, sku, subSku FROM products WHERE variationId = ?',
    variationId,
  );
}

// ---------- count lines ----------
export async function addLine(l: {
  id: string;
  sessionId: number;
  variationId: number;
  qty: number;
  spot: string | null;
  countedByName: string;
  userId: number;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO lines (id, sessionId, variationId, qty, spot, countedAt, countedByName, userId, deleted, synced, onServer, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
    l.id,
    l.sessionId,
    l.variationId,
    l.qty,
    l.spot,
    now,
    l.countedByName,
    l.userId,
    now,
  );
}

/** Edit = the same line id is uploaded again with the new qty. */
export async function editLine(id: string, qty: number, spot: string | null, userId: number) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE lines SET qty = ?, spot = ?, userId = ?, synced = 0, error = NULL, updatedAt = ? WHERE id = ?',
    qty,
    spot,
    userId,
    new Date().toISOString(),
    id,
  );
}

/** Lines never uploaded are removed at once; uploaded ones are sent as deleted:true. */
export async function deleteLine(id: string, userId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM lines WHERE id = ? AND onServer = 0', id);
  await db.runAsync(
    'UPDATE lines SET deleted = 1, userId = ?, synced = 0, error = NULL, updatedAt = ? WHERE id = ? AND onServer = 1',
    userId,
    new Date().toISOString(),
    id,
  );
}

/** Throw away a change the server rejected (the server copy comes back on the next refresh). */
export async function discardLine(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM lines WHERE id = ? AND synced = 2', id);
}

export async function variationTotal(sessionId: number, variationId: number) {
  const db = await getDb();
  const r = await db.getFirstAsync<{ t: number | null; n: number }>(
    'SELECT SUM(qty) AS t, COUNT(*) AS n FROM lines WHERE sessionId = ? AND variationId = ? AND deleted = 0',
    sessionId,
    variationId,
  );
  return { total: round4(r?.t ?? 0), lines: r?.n ?? 0 };
}

export async function linesForVariation(sessionId: number, variationId: number) {
  const db = await getDb();
  return db.getAllAsync<LineRow>(
    'SELECT * FROM lines WHERE sessionId = ? AND variationId = ? AND deleted = 0 ORDER BY countedAt DESC',
    sessionId,
    variationId,
  );
}

export async function countedItems(sessionId: number): Promise<CountedItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CountedItem>(
    `SELECT l.variationId, p.name, p.variationName, p.sku, p.subSku,
            SUM(l.qty) AS total, COUNT(*) AS lineCount,
            SUM(CASE WHEN l.synced = 0 THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN l.synced = 2 THEN 1 ELSE 0 END) AS rejected,
            MAX(l.countedAt) AS lastAt
     FROM lines l LEFT JOIN products p ON p.variationId = l.variationId
     WHERE l.sessionId = ? AND l.deleted = 0
     GROUP BY l.variationId
     ORDER BY lastAt DESC`,
    sessionId,
  );
  return rows.map((r) => ({ ...r, total: round4(r.total) }));
}

// ---------- unknown items ----------
export async function addUnknown(u: {
  id: string;
  sessionId: number;
  scannedCode: string | null;
  description: string;
  qty: number;
  countedByName: string;
  userId: number;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO unknown_items (id, sessionId, scannedCode, description, qty, countedAt, countedByName, userId, deleted, synced, onServer, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
    u.id,
    u.sessionId,
    u.scannedCode,
    u.description,
    u.qty,
    now,
    u.countedByName,
    u.userId,
    now,
  );
}

export async function deleteUnknown(id: string, userId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM unknown_items WHERE id = ? AND onServer = 0', id);
  await db.runAsync(
    'UPDATE unknown_items SET deleted = 1, userId = ?, synced = 0, error = NULL, updatedAt = ? WHERE id = ? AND onServer = 1',
    userId,
    new Date().toISOString(),
    id,
  );
}

export async function unknownItems(sessionId: number) {
  const db = await getDb();
  return db.getAllAsync<UnknownRow>(
    'SELECT * FROM unknown_items WHERE sessionId = ? AND deleted = 0 ORDER BY countedAt DESC',
    sessionId,
  );
}

// ---------- upload queue ----------
/** Queue of THIS user on this phone (another user's rows are never sent with this token). */
export async function queueCounts(sessionId: number, userId: number) {
  const db = await getDb();
  const r = await db.getFirstAsync<{ pending: number; rejected: number }>(
    `SELECT
       (SELECT COUNT(*) FROM lines WHERE sessionId = ?1 AND userId = ?2 AND synced = 0) +
       (SELECT COUNT(*) FROM unknown_items WHERE sessionId = ?1 AND userId = ?2 AND synced = 0) AS pending,
       (SELECT COUNT(*) FROM lines WHERE sessionId = ?1 AND userId = ?2 AND synced = 2) +
       (SELECT COUNT(*) FROM unknown_items WHERE sessionId = ?1 AND userId = ?2 AND synced = 2) AS rejected`,
    sessionId,
    userId,
  );
  return { pending: r?.pending ?? 0, rejected: r?.rejected ?? 0 };
}

/** Not-uploaded rows that cannot be sent now: other sessions or other users (kept, never auto-deleted). */
export async function strandedCount(sessionId: number | null, userId: number) {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM lines WHERE synced != 1 AND (sessionId != ?1 OR IFNULL(userId, -1) != ?2)) +
            (SELECT COUNT(*) FROM unknown_items WHERE synced != 1 AND (sessionId != ?1 OR IFNULL(userId, -1) != ?2)) AS n`,
    sessionId ?? -1,
    userId,
  );
  return r?.n ?? 0;
}

export async function pendingBatch(sessionId: number, userId: number) {
  const db = await getDb();
  const lines = await db.getAllAsync<LineRow>(
    'SELECT * FROM lines WHERE sessionId = ? AND userId = ? AND synced = 0 ORDER BY updatedAt LIMIT 500',
    sessionId,
    userId,
  );
  const unknowns = await db.getAllAsync<UnknownRow>(
    'SELECT * FROM unknown_items WHERE sessionId = ? AND userId = ? AND synced = 0 ORDER BY updatedAt LIMIT 500',
    sessionId,
    userId,
  );
  return { lines, unknowns };
}

/**
 * Marks rows as uploaded. `sent` maps id -> updatedAt at send time, so a row
 * edited again while the upload was in flight stays "waiting".
 */
export async function markResult(
  table: 'lines' | 'unknown_items',
  sent: Map<string, string>,
  accepted: Set<string>,
  rejected: Map<string, string>,
) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [id, updatedAt] of sent) {
      if (accepted.has(id)) {
        await tx.runAsync(`UPDATE ${table} SET onServer = 1 WHERE id = ?`, id);
        await tx.runAsync(
          `UPDATE ${table} SET synced = 1, error = NULL WHERE id = ? AND updatedAt = ?`,
          id,
          updatedAt,
        );
      } else if (rejected.has(id)) {
        await tx.runAsync(
          `UPDATE ${table} SET synced = 2, error = ? WHERE id = ? AND updatedAt = ?`,
          rejected.get(id) || 'Rejected by server',
          id,
          updatedAt,
        );
      }
    }
  });
}

/**
 * Replaces the uploaded copy of the session with the server's list (all
 * counters). Rows still waiting / rejected on this phone are kept as they are.
 */
export async function applyServerLines(sessionId: number, lines: ServerLine[], unknowns: ServerUnknown[]) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM lines WHERE synced = 1');
    await tx.runAsync('DELETE FROM unknown_items WHERE synced = 1');
    for (const l of lines) {
      await tx.runAsync(
        `INSERT INTO lines (id, sessionId, variationId, qty, spot, countedAt, countedByName, userId, deleted, synced, onServer, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 1, 1, ?)
         ON CONFLICT(id) DO UPDATE SET onServer = 1`,
        l.id,
        sessionId,
        l.variationId,
        num(l.qty),
        l.spot ?? null,
        l.countedAt,
        l.countedByName ?? null,
        l.countedAt,
      );
    }
    for (const u of unknowns) {
      await tx.runAsync(
        `INSERT INTO unknown_items (id, sessionId, scannedCode, description, qty, countedAt, countedByName, userId, deleted, synced, onServer, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, 1, 1, ?)
         ON CONFLICT(id) DO UPDATE SET onServer = 1`,
        u.id,
        sessionId,
        u.scannedCode ?? null,
        u.description ?? '',
        num(u.qty),
        u.countedAt,
        u.countedByName ?? null,
        u.countedAt,
      );
    }
  });
}

/** Philippine day (UTC+8) as YYYY-MM-DD. Same rule as the server (src/lib/mobileCountRules.ts). */
const phDay = (d: Date) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10);

/** Counts saved on an earlier day are locked: no edit or delete, only new counts. */
export function isPastDay(countedAtIso: string) {
  const d = new Date(countedAtIso);
  return !isNaN(d.getTime()) && phDay(d) < phDay(new Date());
}
