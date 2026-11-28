import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api, ApiError, Session, errorText } from '../api';
import { useApp, canCount } from '../AppContext';
import { refreshProducts } from '../products';
import { kvGet, productCount, strandedCount } from '../db';
import { Badge, Banner, Button, Card, Header, styles as ui } from '../components/ui';
import { colors } from '../theme';

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** Start a new count or join the branch's active count. */
export function SessionScreen() {
  const app = useApp();
  const { auth, baseUrl, session } = app;
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prod, setProd] = useState<{ state: 'loading' | 'ok' | 'error'; text: string }>({
    state: 'loading',
    text: 'Checking product list…',
  });
  const [stranded, setStranded] = useState(0);

  const active = session && session.status !== 'approved' ? session : null;

  const loadProducts = useCallback(async () => {
    setProd({ state: 'loading', text: 'Downloading product list…' });
    try {
      const r = await refreshProducts(baseUrl, auth.token, auth.businessName);
      setProd({ state: 'ok', text: `${r.total.toLocaleString()} products on this phone` });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) app.requireRelogin();
      const n = await productCount();
      const at = await kvGet('productsAt');
      setProd({
        state: n > 0 ? 'ok' : 'error',
        text:
          n > 0
            ? `${n.toLocaleString()} products on this phone (could not refresh${at ? `, last ${fmtTime(at)}` : ''})`
            : `Product list not downloaded: ${errorText(e)}`,
      });
    }
  }, [baseUrl, auth.token, auth.businessName, app]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const s = await app.refreshSession();
    setOffline(s === undefined);
    setStranded(await strandedCount(s?.id ?? session?.id ?? null, auth.user.id));
    setLoading(false);
  }, [app, auth.user.id, session?.id]);

  useEffect(() => {
    void load();
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (label: string, fn: () => Promise<{ session: Session }>) => {
    setBusy(label);
    setError(null);
    try {
      const r = await fn();
      app.setSession(r.session);
      if (canCount(r.session)) app.go({ name: 'counting' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) app.requireRelogin();
      else if (e instanceof ApiError && e.status === 409) {
        setError(e.message || 'This branch already has an active count. Join it instead.');
        await app.refreshSession();
      } else setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const start = () =>
    Alert.alert('Start a new count?', `This starts a new physical count at ${auth.location.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start', onPress: () => void act('start', () => api.startSession(baseUrl, auth.token)) },
    ]);

  const logout = () =>
    Alert.alert(
      'Log out?',
      'Counts not yet uploaded stay saved on this phone and upload when you log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => void app.logout() },
      ],
    );

  const noProducts = prod.state === 'error';

  return (
    <View style={ui.screen}>
      <Header
        title={auth.location.name}
        subtitle={`${auth.user.name} · ${auth.businessName}`}
        right={<Button title="Log out" kind="ghost" small onPress={logout} />}
      />
      <ScrollView
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void load();
              void loadProducts();
            }}
            colors={[colors.brand]}
          />
        }
      >
        {error && <Banner kind="error" text={error} />}
        {offline && (
          <Banner
            kind="warning"
            text="No connection to the server. Pull down to try again. Showing the last saved status."
          />
        )}
        {stranded > 0 && (
          <Banner
            kind="warning"
            text={`${stranded} count line(s) from an earlier count or another user are still saved on this phone and were not uploaded. They are kept safe; ask the office if they are needed.`}
          />
        )}

        <Card>
          <View style={ui.row}>
            <Badge
              kind={prod.state === 'error' ? 'error' : prod.state === 'loading' ? 'info' : 'success'}
              text={prod.state === 'loading' ? 'Products…' : prod.state === 'ok' ? 'Products ready' : 'No products'}
            />
          </View>
          <Text style={[ui.body, { marginTop: 8 }]}>{prod.text}</Text>
          {prod.state !== 'loading' && (
            <Button
              title="Download product list again"
              kind="secondary"
              small
              onPress={() => void loadProducts()}
              style={{ marginTop: 10 }}
            />
          )}
        </Card>

        {loading && !session ? null : active ? (
          <SessionCard s={active} />
        ) : (
          <Card>
            <Text style={ui.h2}>No active count at this branch</Text>
            <Text style={ui.body}>Start a new count. Other counters can join it from their phones.</Text>
          </Card>
        )}

        {active?.status === 'sent_back' && (
          <View style={{ borderWidth: 3, borderColor: colors.danger, borderRadius: 14, padding: 16, backgroundColor: colors.dangerSoft, marginBottom: 14 }}>
            <Text style={[ui.h2, { color: colors.dangerText }]}>Sent back by the approver</Text>
            <Text style={[ui.body, { color: colors.dangerText, fontSize: 19 }]}>
              {active.sendBackNote || '(no note)'}
            </Text>
            <Text style={[ui.muted, { color: colors.dangerText, marginTop: 8 }]}>
              Fix the counts, then tap "Done Counting" again.
            </Text>
          </View>
        )}

        {noProducts && (
          <Banner kind="error" text="Download the product list before counting (needs signal once)." />
        )}

        {!active && (
          <Button
            title="Start new count"
            onPress={start}
            loading={busy === 'start'}
            disabled={!!busy || offline || noProducts}
          />
        )}

        {active && canCount(active) && (
          <Button title="Continue counting" onPress={() => app.go({ name: 'counting' })} disabled={noProducts} />
        )}

        {active && (active.status === 'open' || active.status === 'sent_back') && !canCount(active) && (
          <Button
            title={active.status === 'sent_back' ? 'Reopen and continue counting' : 'Join this count'}
            onPress={() => void act('join', () => api.join(baseUrl, auth.token, active.id))}
            loading={busy === 'join'}
            disabled={!!busy || offline || noProducts}
          />
        )}

        {active?.status === 'submitted' && (
          <>
            <Banner
              kind="info"
              text="This count was submitted and is waiting for approval on the web. Nothing more to do here."
            />
            <Button title="View my counts" kind="secondary" onPress={() => app.go({ name: 'counting' })} />
          </>
        )}

        {session?.status === 'approved' && (
          <Banner kind="success" text={`Count #${session.id} is closed (approved). You can start a new count.`} style={{ marginTop: 14 }} />
        )}
      </ScrollView>
    </View>
  );
}

function SessionCard({ s }: { s: Session }) {
  const statusBadge =
    s.status === 'open'
      ? { kind: 'info' as const, text: 'Open' }
      : s.status === 'submitted'
        ? { kind: 'warning' as const, text: 'Submitted' }
        : { kind: 'error' as const, text: 'Sent back' };
  return (
    <Card>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.h2}>Count #{s.id}</Text>
        <Badge kind={statusBadge.kind} text={statusBadge.text} />
      </View>
      <Text style={ui.body}>Started by {s.startedByName}</Text>
      <Text style={ui.muted}>{fmtTime(s.startedAt)} · {s.lineCount} lines so far</Text>
      <Text style={[ui.label, { marginTop: 12 }]}>Counters</Text>
      {s.counters.length === 0 && <Text style={ui.muted}>Nobody has joined yet.</Text>}
      {s.counters.map((c) => (
        <View key={c.userId} style={[ui.row, { justifyContent: 'space-between', minHeight: 36 }]}>
          <Text style={ui.body}>{c.name}</Text>
          <Badge kind={c.done ? 'success' : 'warning'} text={c.done ? '✓ Done' : 'Counting'} />
        </View>
      ))}
    </Card>
  );
}
