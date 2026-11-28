import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, ApiError, ReportRow, cleanBaseUrl, errorText } from '../api';
import { useApp } from '../AppContext';
import { Badge, Banner, Button, Card, Field, Header, styles as ui } from '../components/ui';
import { fmtQty } from '../components/CountEntryModal';
import { colors, font, radius } from '../theme';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Philippine calendar day (UTC+8), `daysAgo` days before today. */
const phDay = (daysAgo = 0) => new Date(Date.now() + 8 * 3600000 - daysAgo * 86400000).toISOString().slice(0, 10);
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'Today', range: () => [phDay(), phDay()] },
  { label: 'Yesterday', range: () => [phDay(1), phDay(1)] },
  { label: 'Last 7 days', range: () => [phDay(6), phDay()] },
  { label: 'This month', range: () => [phDay().slice(0, 8) + '01', phDay()] },
];

const STATUS: Record<string, { kind: 'info' | 'warning' | 'success' | 'error'; text: string }> = {
  open: { kind: 'info', text: 'Open' },
  submitted: { kind: 'warning', text: 'Submitted' },
  sent_back: { kind: 'error', text: 'Sent back' },
  approving: { kind: 'warning', text: 'Approving' },
  approved: { kind: 'success', text: 'Approved' },
};

/** What was counted at this branch on a day or date range, with Excel / PDF download. */
export function ReportScreen() {
  const app = useApp();
  const { auth, baseUrl } = app;
  const [from, setFrom] = useState(phDay());
  const [to, setTo] = useState(phDay());
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = DAY.test(from) && DAY.test(to) && from <= to;

  const load = useCallback(
    async (f: string, t: string) => {
      setLoading(true);
      setError(null);
      try {
        const r = await api.report(baseUrl, auth.token, f, t);
        setRows(r.rows);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) app.requireRelogin();
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, auth.token, app],
  );

  useEffect(() => {
    void load(phDay(), phDay());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    void load(f, t);
  };

  const download = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    setError(null);
    try {
      const name = `counted-items-${from}${from === to ? '' : '_' + to}.${format}`;
      const file = await File.downloadFileAsync(
        `${cleanBaseUrl(baseUrl)}/api/mobile/count/report?from=${from}&to=${to}&format=${format}`,
        new File(Paths.cache, name),
        { headers: { Authorization: `Bearer ${auth.token}` }, idempotent: true },
      );
      if (!(await Sharing.isAvailableAsync())) {
        setError('This phone cannot open or share files.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType:
          format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Open, save or send the report',
      });
    } catch (e) {
      setError(`Download failed: ${errorText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const totalQty = (rows ?? []).reduce((s, r) => s + r.counted, 0);
  const isPreset = (p: (typeof PRESETS)[number]) => {
    const [f, t] = p.range();
    return f === from && t === to;
  };

  return (
    <View style={ui.screen}>
      <Header title="Counted report" subtitle={auth.location.name} onBack={() => app.go({ name: 'session' })} />
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.key}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshing={loading}
        onRefresh={() => valid && void load(from, to)}
        ListHeaderComponent={
          <>
            <Card>
              <Text style={ui.label}>Date counted</Text>
              <View style={s.chips}>
                {PRESETS.map((p) => {
                  const on = isPreset(p);
                  return (
                    <Pressable
                      key={p.label}
                      onPress={() => pick(...p.range())}
                      style={[s.chip, on && s.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} keyboardType="numbers-and-punctuation" maxLength={10} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} keyboardType="numbers-and-punctuation" maxLength={10} />
                </View>
              </View>
              <Button title="Show report" small onPress={() => void load(from, to)} loading={loading} disabled={!valid || loading} />
              {!valid && <Text style={[ui.muted, { color: colors.dangerText, marginTop: 6 }]}>Type dates like 2026-11-28. From must be on or before To.</Text>}
            </Card>

            {error && <Banner kind="error" text={error} />}

            {rows && (
              <Card>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={s.stat}>
                    <Text style={s.statNum}>{rows.length}</Text>
                    <Text style={ui.muted}>items counted</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statNum}>{fmtQty(totalQty)}</Text>
                    <Text style={ui.muted}>total qty</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Button
                    title="Excel"
                    kind="secondary"
                    small
                    onPress={() => void download('xlsx')}
                    loading={busy === 'xlsx'}
                    disabled={!!busy || rows.length === 0}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="PDF"
                    kind="secondary"
                    small
                    onPress={() => void download('pdf')}
                    loading={busy === 'pdf'}
                    disabled={!!busy || rows.length === 0}
                    style={{ flex: 1 }}
                  />
                </View>
                <Text style={[ui.muted, { marginTop: 8 }]}>
                  Uploaded counts only. Counts still waiting on a phone appear after they upload.
                </Text>
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          rows && !loading ? (
            <View style={s.empty}>
              <Text style={[ui.body, { textAlign: 'center' }]}>Nothing was counted in this period.</Text>
            </View>
          ) : undefined
        }
        renderItem={({ item: r }) => {
          const st = STATUS[r.status] ?? { kind: 'info' as const, text: r.status };
          return (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={2}>{r.item}</Text>
                <Text style={ui.muted}>SKU {r.sku || '—'} · Count #{r.sessionId}</Text>
                <Text style={ui.muted}>{fmtTime(r.countedAt)}</Text>
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <Badge kind={st.kind} text={st.text} />
                </View>
              </View>
              <Text style={s.total}>{fmtQty(r.counted)}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.brand },
  chipText: { fontSize: font.small, fontWeight: '700', color: colors.brandDark },
  chipTextOn: { color: colors.onBrand },
  stat: {
    flex: 1,
    padding: 12,
    borderRadius: radius,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
  },
  statNum: { fontSize: 28, fontWeight: '900', color: colors.brandDark },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    borderLeftColor: colors.brand,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 1,
  },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  total: { fontSize: 26, fontWeight: '900', color: colors.brandDark, minWidth: 56, textAlign: 'right' },
  empty: {
    padding: 24,
    borderRadius: radius,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
});
