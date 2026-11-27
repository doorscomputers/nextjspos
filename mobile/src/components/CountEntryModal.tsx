import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { Banner, Button, Field, styles as ui } from './ui';
import { colors, font, radius } from '../theme';

export type EntryProduct = {
  name: string;
  variationName: string | null;
  sku: string | null;
  subSku: string | null;
};

export const fmtQty = (n: number) =>
  (Math.round(n * 10000) / 10000).toLocaleString('en-US', { maximumFractionDigits: 4 });

/** Returns the number, or an error message. */
export function parseQty(text: string): number | string {
  const t = text.trim().replace(',', '.');
  if (!t) return 'Enter the quantity you counted.';
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return 'Use numbers only (up to 4 decimals).';
  const n = parseFloat(t);
  if (n > 1000000) return 'That is too large (maximum 1,000,000).';
  return n;
}

export function productLabel(p: EntryProduct) {
  const v = p.variationName && p.variationName.toUpperCase() !== 'DUMMY' ? ` — ${p.variationName}` : '';
  return p.name + v;
}

/**
 * Two steps: (1) type qty (+ optional spot) → (2) CONFIRM pop-up with the qty
 * very large and the running total. Nothing is saved before Confirm.
 * Hardware Enter: on the qty box opens the confirm step; Enter again confirms.
 * If a scanner sends a new code while the confirm step is open, the entry is
 * confirmed and the new code is handed back as `nextCode`.
 */
export function CountEntryModal(props: {
  visible: boolean;
  product: EntryProduct | null;
  title: string; // "Count item" / "Edit count"
  initialQty?: number | null;
  initialSpot: string;
  otherTotal: number; // total of all OTHER lines of this item
  otherLines: number;
  onConfirm: (qty: number, spot: string, nextCode?: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'qty' | 'confirm'>('qty');
  const [qtyText, setQtyText] = useState('');
  const [spot, setSpot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enterBox, setEnterBox] = useState('');
  const confirmShownAt = useRef(0);
  const qtyRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (props.visible) {
      setStep('qty');
      setQtyText(props.initialQty != null ? String(props.initialQty) : '');
      setSpot(props.initialSpot);
      setError(null);
      setSaving(false);
      setEnterBox('');
    }
  }, [props.visible, props.initialQty, props.initialSpot]);

  const qty = parseQty(qtyText);

  const goConfirm = () => {
    if (typeof qty === 'string') {
      setError(qty);
      return;
    }
    setError(null);
    Keyboard.dismiss(); // the number pad must not cover the Confirm button
    confirmShownAt.current = Date.now();
    setEnterBox('');
    setStep('confirm');
  };

  const confirm = async (nextCode?: string) => {
    if (typeof qty === 'string' || saving) return;
    setSaving(true);
    try {
      await props.onConfirm(qty, spot.trim(), nextCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  };

  const onHardwareEnter = () => {
    const extra = enterBox.trim();
    setEnterBox('');
    // Ignore an Enter that arrives right after the confirm step opened (key repeat).
    if (Date.now() - confirmShownAt.current < 400 && !extra) return;
    void confirm(extra || undefined);
  };

  if (!props.product) return null;
  const p = props.product;
  const newTotal = typeof qty === 'number' ? props.otherTotal + qty : props.otherTotal;

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      <View style={s.backdrop}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{step === 'qty' ? props.title : 'Please confirm'}</Text>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={s.name}>{productLabel(p)}</Text>
              <Text style={s.sku}>
                SKU: {p.sku || '—'}
                {p.subSku ? `   Sub-SKU: ${p.subSku}` : ''}
              </Text>
              {error && <Banner kind="error" text={error} style={{ marginTop: 12 }} />}

              {step === 'qty' ? (
                <View style={{ marginTop: 14 }}>
                  <Field
                    label="Quantity counted"
                    inputRef={qtyRef}
                    value={qtyText}
                    onChangeText={(t) => {
                      setQtyText(t);
                      setError(null);
                    }}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectTextOnFocus
                    onSubmitEditing={goConfirm}
                    submitBehavior="submit"
                    returnKeyType="next"
                    placeholder="0"
                    style={s.qtyInput}
                  />
                  <Field
                    label="Spot (optional, e.g. Shelf A, Stockroom)"
                    value={spot}
                    onChangeText={setSpot}
                    autoCapitalize="words"
                    onSubmitEditing={goConfirm}
                    submitBehavior="submit"
                  />
                  {props.otherLines > 0 && (
                    <Text style={ui.muted}>
                      Already counted for this item: {fmtQty(props.otherTotal)} ({props.otherLines}{' '}
                      {props.otherLines === 1 ? 'entry' : 'entries'})
                    </Text>
                  )}
                  <View style={s.btnRow}>
                    <Button title="Cancel" kind="ghost" onPress={props.onCancel} style={{ flex: 1 }} />
                    <Button title="Next" onPress={goConfirm} style={{ flex: 1 }} />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.qtyLabel}>Quantity</Text>
                  <Text style={s.bigQty} adjustsFontSizeToFit numberOfLines={1}>
                    {fmtQty(qty as number)}
                  </Text>
                  {spot.trim() ? <Text style={s.spot}>Spot: {spot.trim()}</Text> : null}
                  <View style={s.totalBox}>
                    <Text style={s.totalText}>
                      Total now {fmtQty(newTotal)}
                      {props.otherLines > 0
                        ? ` (${fmtQty(props.otherTotal)} + ${fmtQty(qty as number)})`
                        : ''}
                    </Text>
                  </View>
                  {/* Invisible box that catches the hardware scanner's Enter = Confirm. */}
                  <TextInput
                    value={enterBox}
                    onChangeText={setEnterBox}
                    onSubmitEditing={onHardwareEnter}
                    submitBehavior="submit"
                    autoFocus
                    showSoftInputOnFocus={false}
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={s.hidden}
                  />
                  <View style={s.btnRow}>
                    <Button
                      title="Edit"
                      kind="secondary"
                      onPress={() => setStep('qty')}
                      disabled={saving}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Confirm"
                      onPress={() => void confirm()}
                      loading={saving}
                      style={{ flex: 1 }}
                    />
                  </View>
                  <Text style={[ui.muted, { marginTop: 10, textAlign: 'center' }]}>
                    Scanner Enter = Confirm
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)' },
  scroll: { padding: 16, paddingTop: 40, flexGrow: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius + 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 8,
  },
  sheetHead: { backgroundColor: colors.brand, padding: 14 },
  sheetTitle: { color: colors.onBrand, fontSize: font.title, fontWeight: '800' },
  name: { fontSize: font.large, fontWeight: '800', color: colors.text },
  sku: { fontSize: font.body, color: colors.textMuted, marginTop: 4 },
  qtyInput: { fontSize: 32, fontWeight: '800', minHeight: 64 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  qtyLabel: { fontSize: font.body, color: colors.textMuted, textAlign: 'center' },
  bigQty: {
    fontSize: font.huge,
    lineHeight: font.huge + 8,
    fontWeight: '900',
    color: colors.brandDark,
    textAlign: 'center',
  },
  spot: { fontSize: font.body, color: colors.text, textAlign: 'center', marginTop: 4 },
  totalBox: {
    marginTop: 12,
    backgroundColor: colors.successSoft,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radius,
    padding: 12,
  },
  totalText: { fontSize: font.large, fontWeight: '800', color: colors.successText, textAlign: 'center' },
  hidden: { height: 1, width: 1, opacity: 0, position: 'absolute' },
});
