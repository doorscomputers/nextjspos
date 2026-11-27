import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, AuthResult, errorText } from '../api';
import { secure } from '../storage';
import { Banner, Button, Field, styles as ui } from '../components/ui';
import { colors, font, radius } from '../theme';

/**
 * Shown when the server says the login expired (401). Keeps the username,
 * the branch card and the whole upload queue; only the password is asked.
 */
export function ReloginModal(props: {
  visible: boolean;
  baseUrl: string;
  onDone: (a: AuthResult) => void;
  onLogout: () => void;
}) {
  const [username, setUsername] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!props.visible) return;
    setPassword('');
    setError(null);
    void Promise.all([secure.getUsername(), secure.getLocationCode()]).then(([u, l]) => {
      setUsername(u);
      setLocationCode(l);
    });
  }, [props.visible]);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await api.auth(props.baseUrl, { username, password, locationCode });
      await secure.setAuth(a);
      setPassword('');
      props.onDone(a);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401 ? 'Wrong password. Try again.' : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
          <View style={s.sheet}>
            <View style={s.head}>
              <Text style={s.title}>Login expired</Text>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={[ui.body, { marginBottom: 12 }]}>
                Enter your password again to keep uploading. Your counts are safe on this phone.
              </Text>
              <Text style={[ui.muted, { marginBottom: 12 }]}>
                User: {username || '—'}   Card: {locationCode || '—'}
              </Text>
              {error && <Banner kind="error" text={error} />}
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
                autoCapitalize="none"
                onSubmitEditing={() => void submit()}
              />
              <Button title="Log in again" onPress={() => void submit()} loading={busy} disabled={!password} />
              <Button
                title="Log out instead"
                kind="ghost"
                onPress={props.onLogout}
                disabled={busy}
                style={{ marginTop: 12 }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)' },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius + 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { backgroundColor: colors.warning, padding: 14 },
  title: { color: colors.onBrand, fontSize: font.title, fontWeight: '800' },
});
