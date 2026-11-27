import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api, ApiError, errorText } from '../api';
import { useApp, canCount } from '../AppContext';
import { countedItems, CountedItem, deleteUnknown, findByCode, unknownItems, UnknownRow } from '../db';
import type { SyncStatus } from '../sync';
import { Badge, Banner, Button, Header, styles as ui } from '../components/ui';
import { ScanInput, ScanInputHandle } from '../components/ScanInput';
import { CameraScanner } from '../components/CameraScanner';
import { fmtQty, productLabel } from '../components/CountEntryModal';
import { useCountEntry } from '../useCountEntry';
import { colors, font, radius } from '../theme';

type Row = { kind: 'item'; item: CountedItem } | { kind: 'unknown'; item: UnknownRow } | { kind: 'title'; text: string };

export function CountingScreen(props: { scan?: string; scanKey?: number }) {
  const app = useApp();
  const { session, auth, baseUrl, engine } = app;
  const [items, setItems] = useState<CountedItem[]>([]);
  const [unknowns, setUnknowns] = useState<UnknownRow[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(engine?.status ?? null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanRef = useRef<ScanInputHandle>(null);
  const handleScanRef = useRef<(code: string) => void>(() => {});

  const entry = useCountEntry((nextCode) => {
    if (nextCode) setTimeout(() => handleScanRef.current(nextCode), 50);
    else setTimeout(() => scanRef.current?.focus(), 300);
  });

  const allowed = canCount(session);

  // ---- data ----
  const reload = useCallback(async () => {
    if (!session) return;
    const [a, b] = await Promise.all([countedItems(session.id), unknownItems(session.id)]);
    setItems(a);
    setUnknowns(b);
    await engine?.refreshCounts();
  }, [session, engine]);

  useEffect(() => {
    void reload();
  }, [reload, app.dataVersion]);

  useEffect(() => engine?.subscribe(setSync), [engine]);

  // Session status (counters done, locked, sent back) every 15 s.
  useEffect(() => {
    const t = setInterval(() => void app.refreshSession(), 15000);
    void app.refreshSession();
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- scanning ----
  const handleScan = useCallback(
    async (code: string) => {
      setError(null);
      if (!allowed) {
        setError('Counting is locked for this session. Your saved counts are kept.');
        return;
      }
      const matches = await findByCode(code);
      if (matches.length === 1) {
        void entry.open(matches[0]);
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        app.go({ name: 'notfound', code, matches: matches.length > 1 ? matches : undefined });
      }
    },
    [allowed, entry, app],
  );
  handleScanRef.current = (c) => void handleScan(c);

  // A code handed over from another screen (scanner Enter during confirm).
  useEffect(() => {
    if (props.scan) void handleScan(props.scan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scanKey]);

  // ---- actions ----
  const pending = sync?.pending ?? 0;
  const rejected = sync?.rejected ?? 0;
  const queueEmpty = pending === 0 && rejected === 0;
  const allDone =
    !!session && session.status === 'open' && session.counters.length > 0 && session.counters.every((c) => c.done);

  const sessionAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) app.requireRelogin();
      else setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const done = () =>
    Alert.alert("Finished counting?", 'This tells the team your part is done. You can still add more later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: "I'm done",
        onPress: () =>
          void sessionAction('done', async () => {
            const r = await api.done(baseUrl, auth.token, session!.id);
            app.setSession(r.session);
          }),
      },
    ]);

  const submit = () =>
    Alert.alert('Submit for approval?', 'After submitting, nobody can change the counts unless the approver sends it back.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: () =>
          void sessionAction('submit', async () => {
            const r = await api.submit(baseUrl, auth.token, session!.id);
            app.setSession(r.session);
          }),
      },
    ]);

  const checkAgain = () =>
    void sessionAction('check', async () => {
      const s = await app.refreshSession();
      if (s && canCount(s)) engine?.unlock();
      else engine?.trigger();
    });

  const removeUnknown = (u: UnknownRow) => {
    if (!allowed) return;
    Alert.alert('Delete this unknown item?', `${u.description} — qty ${fmtQty(u.qty)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteUnknown(u.id, auth.user.id);
          app.bumpData();
          engine?.trigger();
        },
      },
    ]);
  };

  if (!session) {
    return (
      <View style={ui.screen}>
        <Header title="Counting" onBack={() => app.go({ name: 'session' })} />
        <View style={ui.content}>
          <Banner kind="warning" text="No count session. Go back and start or join a count." />
        </View>
      </View>
    );
  }

  const lockText =
    session.status === 'submitted'
      ? 'This count was submitted for approval. Counting is locked.'
      : session.status === 'approved'
        ? 'This count is closed (approved). Counting is locked.'
        : session.status === 'sent_back'
          ? 'This count was sent back. Go back and tap "Reopen and continue counting".'
          : !session.joined
            ? 'You have not joined this count. Go back and join it.'
            : sync?.locked
              ? `The server refused the upload: ${sync.lastError ?? 'session not open'}`
              : null;

  const rows: Row[] = [
    ...items.map((i) => ({ kind: 'item' as const, item: i })),
    ...(unknowns.length ? [{ kind: 'title' as const, text: 'Unknown items' }] : []),
    ...unknowns.map((u) => ({ kind: 'unknown' as const, item: u })),
  ];

  return (
    <View style={ui.screen}>
      <Header
        title={`Count #${session.id} · ${auth.location.name}`}
        subtitle={auth.user.name}
        onBack={() => app.go({ name: 'session' })}
      />

      <View style={s.top}>
        {lockText && <Banner kind="error" text={lockText} />}
        {lockText && (
          <Button
            title="Check again"
            kind="secondary"
            small
            onPress={checkAgain}
            loading={busy === 'check'}
            style={{ marginBottom: 10 }}
          />
        )}
        {error && <Banner kind="error" text={error} />}
        {sync?.lastError && !sync.locked && <Banner kind="warning" text={sync.lastError} />}

        <View style={[ui.row, { flexWrap: 'wrap', marginBottom: 10 }]}>
          {pending > 0 ? (
            <Badge kind="warning" text={`⏳ ${pending} waiting to upload`} />
          ) : (
            <Badge kind="success" text="✓ All uploaded" />
          )}
          {rejected > 0 && <Badge kind="error" text={`⚠ ${rejected} rejected — open the item to fix`} />}
          {sync?.syncing && <Badge kind="info" text="Uploading…" />}
          {sync && !sync.online && <Badge kind="error" text="Offline" />}
        </View>

        {allowed && (
          <ScanInput
            ref={scanRef}
            placeholder="Scan or type barcode / SKU…"
            keepFocus={!entry.isOpen && !camera}
            onSubmit={(c) => void handleScan(c)}
            onCamera={() => setCamera(true)}
          />
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'item' ? `v${r.item.variationId}` : r.kind === 'unknown' ? r.item.id : `t${i}`)}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text style={[ui.label, { marginTop: 6 }]}>
            {items.length} item{items.length === 1 ? '' : 's'} counted
          </Text>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={[ui.body, { textAlign: 'center' }]}>
              Nothing counted yet. Scan a barcode to start.
            </Text>
          </View>
        }
        renderItem={({ item: r }) => {
          if (r.kind === 'title') return <Text style={[ui.label, { marginTop: 14 }]}>{r.text}</Text>;
          if (r.kind === 'unknown') {
            const u = r.item;
            return (
              <Pressable onPress={() => removeUnknown(u)} style={[s.row, { borderLeftColor: colors.warning }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{u.description}</Text>
                  <Text style={ui.muted}>
                    {u.scannedCode ? `Code ${u.scannedCode} · ` : ''}
                    {u.countedByName ?? ''}
                    {u.synced === 0 ? ' · ⏳ waiting' : u.synced === 2 ? ` · ⚠ ${u.error ?? 'rejected'}` : ''}
                  </Text>
                </View>
                <Text style={s.total}>{fmtQty(u.qty)}</Text>
              </Pressable>
            );
          }
          const it = r.item;
          return (
            <Pressable
              onPress={() => app.go({ name: 'item', variationId: it.variationId })}
              style={[s.row, it.rejected > 0 && { borderLeftColor: colors.danger }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={2}>
                  {it.name
                    ? productLabel({ name: it.name, variationName: it.variationName, sku: it.sku, subSku: it.subSku })
                    : `Item #${it.variationId} (not in product list)`}
                </Text>
                <Text style={ui.muted}>
                  SKU {it.sku || '—'} · {it.lineCount} {it.lineCount === 1 ? 'entry' : 'entries'}
                  {it.pending > 0 ? ' · ⏳ waiting' : ''}
                  {it.rejected > 0 ? ' · ⚠ rejected' : ''}
                </Text>
              </View>
              <Text style={s.total}>{fmtQty(it.total)}</Text>
            </Pressable>
          );
        }}
      />

      <View style={s.footer}>
        {session.myDone && session.status === 'open' && (
          <Text style={[ui.muted, { textAlign: 'center', marginBottom: 8 }]}>
            ✓ You marked your part done. Waiting for:{' '}
            {session.counters.filter((c) => !c.done).map((c) => c.name).join(', ') || 'nobody'}
          </Text>
        )}
        {!queueEmpty && session.status === 'open' && (
          <Text style={[ui.muted, { textAlign: 'center', marginBottom: 8 }]}>
            "I'm done" unlocks when everything is uploaded{rejected > 0 ? ' and rejected lines are fixed' : ''}.
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {allowed && (
            <Button
              title={session.myDone ? "I'm done ✓" : "I'm done"}
              kind={session.myDone ? 'secondary' : 'primary'}
              onPress={done}
              loading={busy === 'done'}
              disabled={!sync || !queueEmpty || !!busy || sync.online === false}
              style={{ flex: 1 }}
            />
          )}
          {allDone && (
            <Button
              title="Submit for Approval"
              onPress={submit}
              loading={busy === 'submit'}
              disabled={!queueEmpty || !!busy}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </View>

      {entry.element}
      <CameraScanner
        visible={camera}
        title="Scan item barcode"
        onClose={() => setCamera(false)}
        onScan={(c) => {
          setCamera(false);
          void handleScan(c);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 14 },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    borderLeftColor: colors.brand,
    padding: 14,
    marginTop: 10,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
  },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  total: { fontSize: 26, fontWeight: '900', color: colors.brandDark, minWidth: 56, textAlign: 'right' },
  empty: {
    marginTop: 20,
    padding: 24,
    borderRadius: radius,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
