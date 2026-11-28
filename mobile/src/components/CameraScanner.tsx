import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { Button, styles as ui } from './ui';
import { colors, font } from '../theme';

const TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'itf14',
  'codabar',
  'qr',
];

/** Full-screen camera barcode reader. Calls onScan once per new code. */
export function CameraScanner(props: {
  visible: boolean;
  title: string;
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const handle = (data: string) => {
    const code = (data ?? '').trim();
    if (!code) return;
    const now = Date.now();
    // The camera reports the same code many times per second: ignore repeats for 1.5 s.
    if (code === last.current.code && now - last.current.at < 1500) return;
    if (now - last.current.at < 600) return;
    last.current = { code, at: now };
    props.onScan(code);
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={s.wrap}>
        <View style={s.top}>
          <Text style={s.title}>{props.title}</Text>
          <Text style={s.hint}>Point the camera at the barcode.</Text>
        </View>
        {!permission ? (
          <View style={s.center} />
        ) : !permission.granted ? (
          <View style={s.center}>
            <Text style={[ui.body, s.permText]}>
              The app needs the camera to read barcodes. You can still type the code or use a
              scanner without the camera.
            </Text>
            {permission.canAskAgain ? (
              <Button title="Allow camera" onPress={requestPermission} />
            ) : (
              <Text style={[ui.body, s.permText]}>
                Camera is blocked. Open Android Settings → Apps → PCINET Inventory Count App → Permissions →
                Camera → Allow.
              </Text>
            )}
          </View>
        ) : (
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: TYPES }}
            onBarcodeScanned={props.visible ? (r) => handle(r.data) : undefined}
          >
            <View style={s.frame} pointerEvents="none" />
          </CameraView>
        )}
        <View style={s.bottom}>
          <Button title="Close camera" kind="secondary" onPress={props.onClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  top: { backgroundColor: colors.brand, padding: 16 },
  title: { color: colors.onBrand, fontSize: font.title, fontWeight: '800' },
  hint: { color: colors.brandSoft, fontSize: font.small, marginTop: 4 },
  center: {
    flex: 1,
    backgroundColor: colors.page,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  permText: { textAlign: 'center' },
  camera: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '80%',
    height: 180,
    borderWidth: 4,
    borderColor: '#22c55e',
    borderRadius: 16,
  },
  bottom: { backgroundColor: colors.page, padding: 16 },
});
