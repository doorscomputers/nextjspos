import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useApp, canCount } from '../AppContext';
import { deleteLine, discardLine, editLine, getProduct, isPastDay, LineRow, linesForVariation, Product, round4 } from '../db';
import { Badge, Banner, Button, Card, Header, styles as ui } from '../components/ui';
import { CountEntryModal, fmtQty, productLabel } from '../components/CountEntryModal';
import { colors, font, radius } from '../theme';

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** All lines of one item; edit (with Confirm pop-up) or delete while the count is open. */
export function ItemDetailScreen(props: { variationId: number }) {
  const app = useApp();
  const { session, auth } = app;
  const [product, setProduct] = useState<Product | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [editing, setEditing] = useState<LineRow | null>(null);
  const allowed = canCount(session);

  const load = useCallback(async () => {
    if (!session) return;
    const [p, l] = await Promise.all([getProduct(props.variationId), linesForVariation(session.id, props.variationId)]);
    setProduct(p);
    setLines(l);
  }, [session, props.variationId]);

  useEffect(() => {
    void load();
  }, [load, app.dataVersion]);

  const total = round4(lines.reduce((a, l) => a + l.qty, 0));
  const p = product ?? {
    variationId: props.variationId,
    productId: 0,
    name: `Item #${props.variationId}`,
    variationName: null,
    sku: null,
    subSku: null,
  };

  const changed = () => {
    app.bumpData();
    app.engine?.trigger();
  };

  const remove = (l: LineRow) =>
    Alert.alert('Delete this count line?', `Qty ${fmtQty(l.qty)}${l.spot ? ` at ${l.spot}` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLine(l.id, auth.user.id);
          changed();
        },
      },
    ]);

  const discard = (l: LineRow) =>
    Alert.alert(
      'Discard this rejected change?',
      'The change is removed from this phone. If the server has an older copy, it comes back on the next refresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardLine(l.id);
            changed();
          },
        },
      ],
    );

  return (
    <View style={ui.screen}>
      <Header title="Item detail" onBack={() => app.go({ name: 'counting' })} />
      <FlatList
        data={lines}
        keyExtractor={(l) => l.id}
        contentContainerStyle={ui.content}
        ListHeaderComponent={
          <>
            <Card>
              <Text style={ui.h2}>{productLabel(p)}</Text>
              <Text style={ui.muted}>
                SKU {p.sku || '—'}
                {p.subSku ? ` · Sub-SKU ${p.subSku}` : ''}
              </Text>
              <View style={s.totalBox}>
                <Text style={s.totalLabel}>Counted total</Text>
                <Text style={s.total}>{fmtQty(total)}</Text>
                <Text style={ui.muted}>
                  {lines.length} {lines.length === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
            </Card>
            {!allowed && <Banner kind="warning" text="The count is not open: lines can only be viewed." />}
          </>
        }
        ListEmptyComponent={<Text style={[ui.muted, { textAlign: 'center' }]}>No lines for this item.</Text>}
        renderItem={({ item: l }) => (
          <View style={[s.line, l.synced === 2 && { borderColor: colors.danger }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.spot}>{l.spot || 'No spot'}</Text>
                <Text style={ui.muted}>
                  {l.countedByName ?? '—'} · {fmtTime(l.countedAt)}
                </Text>
              </View>
              <Text style={s.qty}>{fmtQty(l.qty)}</Text>
            </View>
            <View style={{ marginTop: 6 }}>
              {l.synced === 0 && <Badge kind="warning" text="⏳ Waiting to upload" />}
              {l.synced === 1 && <Badge kind="success" text="✓ Uploaded" />}
              {l.synced === 2 && <Badge kind="error" text={`⚠ Rejected: ${l.error ?? ''}`} />}
            </View>
            {allowed && isPastDay(l.countedAt) && l.synced !== 2 && (
              <Text style={[ui.muted, { marginTop: 8 }]}>🔒 Counted on an earlier day: locked. Scan the item again to add a new count.</Text>
            )}
            {allowed && (!isPastDay(l.countedAt) || l.synced === 2) && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Button title="Edit qty" kind="secondary" small onPress={() => setEditing(l)} style={{ flex: 1 }} />
                {l.synced === 2 ? (
                  <Button title="Discard" kind="danger" small onPress={() => discard(l)} style={{ flex: 1 }} />
                ) : (
                  <Button title="Delete" kind="danger" small onPress={() => remove(l)} style={{ flex: 1 }} />
                )}
              </View>
            )}
          </View>
        )}
      />
      <CountEntryModal
        visible={!!editing}
        product={p}
        title="Edit count"
        initialQty={editing?.qty ?? null}
        initialSpot={editing?.spot ?? ''}
        otherTotal={editing ? round4(total - editing.qty) : 0}
        otherLines={editing ? lines.length - 1 : 0}
        onCancel={() => setEditing(null)}
        onConfirm={async (qty, spot) => {
          if (!editing) return;
          await editLine(editing.id, qty, spot || null, auth.user.id);
          setEditing(null);
          changed();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  totalBox: {
    marginTop: 12,
    backgroundColor: colors.brandSoft,
    borderRadius: radius,
    padding: 12,
    alignItems: 'center',
  },
  totalLabel: { fontSize: font.body, color: colors.brandDark, fontWeight: '700' },
  total: { fontSize: 44, fontWeight: '900', color: colors.brandDark },
  line: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  spot: { fontSize: font.body, fontWeight: '700', color: colors.text },
  qty: { fontSize: 28, fontWeight: '900', color: colors.brandDark },
});
