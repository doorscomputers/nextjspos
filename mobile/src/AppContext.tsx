import { createContext, useContext } from 'react';
import type { AuthResult, Session } from './api';
import type { Product } from './db';
import type { SyncEngine } from './sync';

export type Screen =
  | { name: 'boot' }
  | { name: 'login' }
  | { name: 'session' }
  | { name: 'counting'; scan?: string; scanKey?: number }
  | { name: 'notfound'; code: string; matches?: Product[] }
  | { name: 'item'; variationId: number }
  | { name: 'report' };

export type AppCtx = {
  baseUrl: string;
  auth: AuthResult;
  session: Session | null;
  /** Server copy of the session. Saved to SQLite so the app can resume offline. */
  setSession: (s: Session | null) => void;
  /** Re-reads GET sessions/current. Returns the session, or undefined when offline. */
  refreshSession: () => Promise<Session | null | undefined>;
  go: (s: Screen) => void;
  engine: SyncEngine | null;
  /** Ask for the password again (token expired / revoked). */
  requireRelogin: () => void;
  logout: () => Promise<void>;
  /** bumps when SQLite data changed (sync, confirm, edit) so lists re-read. */
  dataVersion: number;
  bumpData: () => void;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp outside AppContext');
  return c;
}

/** Session is open and I have joined it: counting, edits and uploads allowed. */
export function canCount(s: Session | null) {
  return !!s && s.status === 'open' && s.joined;
}
