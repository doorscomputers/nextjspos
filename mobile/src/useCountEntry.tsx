import React, { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useApp } from './AppContext';
import { addLine, kvGet, kvSet, Product, variationTotal } from './db';
import { CountEntryModal } from './components/CountEntryModal';

/**
 * Qty entry + Confirm pop-up for a NEW line. The line is written to SQLite
 * only when the user taps Confirm (or the scanner sends Enter).
 */
export function useCountEntry(onSaved: (nextCode?: string) => void) {
  const app = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [other, setOther] = useState({ total: 0, lines: 0 });
  const [spot, setSpot] = useState('');

  const open = useCallback(
    async (p: Product) => {
      if (!app.session) return;
      const [t, lastSpot] = await Promise.all([
        variationTotal(app.session.id, p.variationId),
        kvGet('lastSpot'),
      ]);
      setOther(t);
      setSpot(lastSpot ?? '');
      setProduct(p);
    },
    [app.session],
  );

  const element = (
    <CountEntryModal
      visible={!!product}
      product={product}
      title="Count item"
      initialQty={null}
      initialSpot={spot}
      otherTotal={other.total}
      otherLines={other.lines}
      onCancel={() => setProduct(null)}
      onConfirm={async (qty, spotText, nextCode) => {
        if (!product || !app.session) return;
        await addLine({
          id: Crypto.randomUUID(),
          sessionId: app.session.id,
          variationId: product.variationId,
          qty,
          spot: spotText || null,
          countedByName: app.auth.user.name,
          userId: app.auth.user.id,
        });
        await kvSet('lastSpot', spotText);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setProduct(null);
        app.bumpData();
        app.engine?.trigger();
        onSaved(nextCode);
      }}
    />
  );

  return { open, element, isOpen: !!product };
}
