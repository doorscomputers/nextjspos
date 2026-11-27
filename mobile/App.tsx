import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, AuthResult, Session } from './src/api';
import { AppContext, AppCtx, Screen, canCount } from './src/AppContext';
import { getDb, kvGet, kvSet } from './src/db';
import { DEFAULT_BASE_URL, secure } from './src/storage';
import { SyncEngine } from './src/sync';
import { colors } from './src/theme';
import { styles as ui } from './src/components/ui';
import { LoginScreen } from './src/screens/LoginScreen';
import { SessionScreen } from './src/screens/SessionScreen';
import { CountingScreen } from './src/screens/CountingScreen';
import { NotFoundScreen } from './src/screens/NotFoundScreen';
import { ItemDetailScreen } from './src/screens/ItemDetailScreen';
import { ReloginModal } from './src/screens/ReloginModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.brand }} edges={['top', 'bottom']}>
        <View style={ui.screen}>
          <Root />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const COUNTING_SCREENS = new Set<Screen['name']>(['counting', 'notfound', 'item']);

function Root() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [auth, setAuthState] = useState<AuthResult | null>(null);
  const authRef = useRef<AuthResult | null>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'boot' });
  const [relogin, setRelogin] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const setAuth = useCallback((a: AuthResult | null) => {
    authRef.current = a;
    setAuthState(a);
  }, []);

  const setSession = useCallback((s: Session | null) => {
    sessionRef.current = s;
    setSessionState(s);
    void kvSet('session', s ? JSON.stringify(s) : null);
  }, []);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    if (s.name === 'counting' || s.name === 'session') void kvSet('screen', s.name);
  }, []);

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  // ---- start-up: restore where the user left off ----
  useEffect(() => {
    (async () => {
      try {
        await getDb();
        const [b, a] = await Promise.all([secure.getBaseUrl(), secure.getAuth()]);
        setBaseUrl(b);
        if (!a) {
          setScreen({ name: 'login' });
          return;
        }
        setAuth(a);
        const cached = await kvGet('session');
        let s: Session | null = null;
        try {
          s = cached ? (JSON.parse(cached) as Session) : null;
        } catch {
          s = null;
        }
        sessionRef.current = s;
        setSessionState(s);
        const last = await kvGet('screen');
        setScreen(last === 'counting' && s ? { name: 'counting' } : { name: 'session' });
        if (a.expiresAt && Date.parse(a.expiresAt) < Date.now()) setRelogin(true);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : 'Could not open the phone database.');
      }
    })();
  }, [setAuth]);

  const refreshSession = useCallback(async (): Promise<Session | null | undefined> => {
    const a = authRef.current;
    if (!a) return undefined;
    try {
      const r = await api.currentSession(baseUrl, a.token);
      const prev = sessionRef.current;
      let next = r.session;
      // The count we were in is no longer active (approved / closed): keep it
      // on screen as "closed" so its queued lines stay visible.
      if (!next && prev && prev.status !== 'approved') next = { ...prev, status: 'approved' };
      if (!next && prev && prev.status === 'approved') next = prev;
      setSession(next);
      if (next && canCount(next) && !canCount(prev) && engineRef.current?.status.locked) {
        engineRef.current.unlock();
      }
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setRelogin(true);
      return undefined;
    }
  }, [baseUrl, setSession]);

  // ---- upload loop: runs while on the counting screens ----
  const inCounting = COUNTING_SCREENS.has(screen.name);
  const sessionId = session?.id ?? null;
  const userId = auth?.user.id ?? null;
  const refreshRef = useRef(refreshSession);
  refreshRef.current = refreshSession;
  useEffect(() => {
    if (!inCounting || sessionId == null || userId == null) return;
    const e = new SyncEngine({
      baseUrl,
      getToken: () => authRef.current?.token ?? null,
      sessionId,
      userId,
      onUnauthorized: () => setRelogin(true),
      onLocked: () => void refreshRef.current(),
      onDataChanged: bumpData,
    });
    if (!canCount(sessionRef.current)) e.status = { ...e.status, locked: true };
    engineRef.current = e;
    setEngine(e);
    e.start();
    return () => {
      e.stop();
      engineRef.current = null;
      setEngine(null);
    };
  }, [inCounting, sessionId, userId, baseUrl, bumpData]);

  // Android back button: go one step back instead of closing the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name === 'notfound' || screen.name === 'item') {
        go({ name: 'counting' });
        return true;
      }
      if (screen.name === 'counting') {
        go({ name: 'session' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [screen.name, go]);

  const logout = useCallback(async () => {
    await secure.clearAuth();
    setAuth(null);
    setSession(null);
    await kvSet('screen', null);
    setRelogin(false);
    setScreen({ name: 'login' });
  }, [setAuth, setSession]);

  const onLoggedIn = useCallback(
    async (a: AuthResult, url: string) => {
      setBaseUrl(url);
      setAuth(a);
      const prev = sessionRef.current;
      // Another branch or user: forget the cached session (its queue stays in SQLite).
      if (prev) setSession(null);
      setRelogin(false);
      go({ name: 'session' });
    },
    [setAuth, setSession, go],
  );

  const onRelogged = useCallback(
    (a: AuthResult) => {
      setAuth(a);
      setRelogin(false);
      engineRef.current?.unlock();
      void refreshSession();
    },
    [setAuth, refreshSession],
  );

  const ctx: AppCtx | null = useMemo(
    () =>
      auth
        ? {
            baseUrl,
            auth,
            session,
            setSession,
            refreshSession,
            go,
            engine,
            requireRelogin: () => setRelogin(true),
            logout,
            dataVersion,
            bumpData,
          }
        : null,
    [auth, baseUrl, session, setSession, refreshSession, go, engine, logout, dataVersion, bumpData],
  );

  if (bootError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={[ui.h2, { color: colors.danger }]}>The app could not start</Text>
        <Text style={ui.body}>{bootError}</Text>
      </View>
    );
  }

  if (screen.name === 'boot') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={ui.body}>Starting…</Text>
      </View>
    );
  }

  if (screen.name === 'login' || !ctx) {
    return <LoginScreen initialBaseUrl={baseUrl} onLoggedIn={onLoggedIn} />;
  }

  return (
    <AppContext.Provider value={ctx}>
      {screen.name === 'session' && <SessionScreen />}
      {screen.name === 'counting' && <CountingScreen scan={screen.scan} scanKey={screen.scanKey} />}
      {screen.name === 'notfound' && <NotFoundScreen code={screen.code} matches={screen.matches} />}
      {screen.name === 'item' && <ItemDetailScreen variationId={screen.variationId} />}
      <ReloginModal
        visible={relogin}
        baseUrl={baseUrl}
        onDone={onRelogged}
        onLogout={() => void logout()}
      />
    </AppContext.Provider>
  );
}
