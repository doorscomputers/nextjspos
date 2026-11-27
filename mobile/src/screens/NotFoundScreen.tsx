import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useApp, canCount } from '../AppContext';
import { addUnknown, findByCode, Product, searchProducts } from '../db';
import { refreshProducts } from '../products';
import { errorText } from '../api';
import { Banner, Button, Card, Field, Header, styles as ui } from '../components/ui';
import { parseQty, productLabel } from '../components/CountEntryModal';
import { useCountEntry } from '../useCountEntry';
import { colors, font, radius } from '../theme';

/**
 * Barcode not found: contains-search on the phone's product list, then
 * "Log as unknown item" if it is still not found.
 */
export function NotFoundScreen(props: { code: string; matches?: Product[] }) {
  const app = useApp();
  const multiple = !!props.matches?.length;
  const [q, setQ] = useState(multiple ? '' : props.code);
  const [results, setResults] = useState<Product[]>(props.matches ?? []);
  const [mode, setMode] = useState<'search' | 'unknown'>('search');
  const [desc, setDesc] = useState('');
  const [qtyText, setQtyText] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const back = (scan?: string) =>
    app.go({ name: 'counting', scan, scanKey: scan ? Date.now() : undefined });

  const entry = useCountEntry((nextCode) => back(nextCode));
  const allowed = canCount(app.session);

  useEffect(() => {
    if (multiple && !q.trim()) {
      setResults(props.matches ?? []);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      void searchProducts(q).then((r) => live && setResults(r));
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, multiple, props.matches]);

  const refresh = async () => {
    setRefreshing('Downloading product list…');
    try {
      await refreshProducts(app.baseUrl, app.auth.token, app.auth.businessName);
      const m = await findByCode(props.code);
      if (m.length === 1) {
        setRefreshing(null);
        void entry.open(m[0]);
        return;
      }
      setResults(m.length ? m : await searchProducts(q));
      setRefreshing(m.length ? null : 'Product list updated — the code is still not found.');
    } catch (e) {
      setRefreshing('Could not refresh: ' + errorText(e));
    }
  };

  const saveUnknown = async () => {
    if (!app.session || saving) return;
    if (!desc.trim()) {
      setError('Describe the item (for example: "Black USB hub, no box").');
      return;
    }
    const qty = parseQty(qtyText);
    if (typeof qty === 'string') {
      setError(qty);
      return;
    }
    setSaving(true);
    try {
      await addUnknown({
        id: Crypto.randomUUID(),
        sessionId: app.session.id,
        scannedCode: props.code || null,
        description: desc.trim(),
        qty,
        countedByName: app.auth.user.name,
        userId: app.auth.user.id,
      });
      app.bumpData();
      app.engine?.trigger();
      back();
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  };

  return (
    <View style={ui.screen}>
      <Header title={multiple ? 'Choose the item' : 'Barcode not found'} onBack={() => back()} />
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <View style={s.redBanner}>
          <Text style={s.redTitle}>{multiple ? 'Several items use this code' : 'Not found'}</Text>
          <Text style={s.code} selectable>
            {props.code}
          </Text>
        </View>
        {!allowed && <Banner kind="error" text="Counting is locked for this session." />}
        {error && <Banner kind="error" text={error} />}
      </View>

      {mode === 'search' ? (
        <>
          <View style={{ paddingHorizontal: 16 }}>
            <Field
              label="Search by name or SKU (at least 2 letters)"
              value={q}
              onChangeText={setQ}
              autoFocus={!multiple}
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="e.g. mouse logitech"
              returnKeyType="search"
            />
            {refreshing && <Banner kind="info" text={refreshing} />}
          </View>
          <FlatList
            data={results}
            keyExtractor={(p) => String(p.variationId)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
            ListEmptyComponent={
              <Text style={[ui.muted, { textAlign: 'center', marginTop: 12 }]}>
                {q.trim().length < 2 ? 'Type at least 2 letters to search.' : 'No product matches.'}
              </Text>
            }
            renderItem={({ item: p }) => (
              <Pressable
                style={s.result}
                disabled={!allowed}
                onPress={() => void entry.open(p)}
                accessibilityRole="button"
              >
                <Text style={s.resultName}>{productLabel(p)}</Text>
                <Text style={ui.muted}>
                  SKU {p.sku || '—'}
                  {p.subSku ? ` · Sub-SKU ${p.subSku}` : ''}
                </Text>
              </Pressable>
            )}
          />
          <View style={s.footer}>
            <Button
              title="Log as unknown item"
              kind="danger"
              onPress={() => {
                setError(null);
                setDesc(q.trim() && q.trim() !== props.code ? q.trim() : '');
                setMode('unknown');
              }}
              disabled={!allowed}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button title="Download products again" kind="secondary" small onPress={() => void refresh()} style={{ flex: 1 }} />
              <Button title="Back" kind="ghost" small onPress={() => back()} style={{ flex: 1 }} />
            </View>
          </View>
        </>
      ) : (
        <View style={{ padding: 16 }}>
          <Card>
            <Text style={ui.h2}>Unknown item</Text>
            <Text style={[ui.muted, { marginBottom: 12 }]}>
              Saved as a note for the approver. It does not change stock.
            </Text>
            <Field
              label="Description (required)"
              value={desc}
              onChangeText={(t) => {
                setDesc(t);
                setError(null);
              }}
              autoFocus
              placeholder="e.g. Black USB hub, no box"
            />
            <Field
              label="Quantity"
              value={qtyText}
              onChangeText={setQtyText}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={[ui.muted, { marginBottom: 12 }]}>Scanned code: {props.code || '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cancel" kind="ghost" onPress={() => setMode('search')} style={{ flex: 1 }} disabled={saving} />
              <Button title="Save" onPress={() => void saveUnknown()} loading={saving} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      )}
      {entry.element}
    </View>
  );
}

const s = StyleSheet.create({
  redBanner: {
    backgroundColor: colors.danger,
    borderRadius: radius,
    padding: 14,
    marginBottom: 14,
  },
  redTitle: { color: colors.onBrand, fontSize: font.large, fontWeight: '800' },
  code: { color: colors.onBrand, fontSize: 26, fontWeight: '900', marginTop: 4 },
  result: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 8,
    minHeight: 56,
  },
  resultName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
});
