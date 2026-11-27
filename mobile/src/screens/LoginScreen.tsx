import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { api, ApiError, AuthResult, cleanBaseUrl, errorText } from '../api';
import { secure } from '../storage';
import { Banner, Button, Card, Field, Header, styles as ui } from '../components/ui';
import { ScanInput } from '../components/ScanInput';
import { CameraScanner } from '../components/CameraScanner';
import { colors } from '../theme';

function loginError(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Wrong username or password.';
    if (e.status === 403)
      return e.message || 'You are not allowed to count with the app, or this card is not one of your branches.';
    if (e.status === 404 && e.data) return e.message || 'Location card not found.';
  }
  return errorText(e);
}

/**
 * Step 1: username + password. Step 2: scan the branch LOCATION card
 * (scanner types into the box and presses Enter, or use the camera).
 */
export function LoginScreen(props: {
  initialBaseUrl: string;
  onLoggedIn: (a: AuthResult, baseUrl: string) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(props.initialBaseUrl);
  const [showServer, setShowServer] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'cred' | 'card'>('cred');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);

  useEffect(() => {
    void secure.getUsername().then((u) => u && setUsername(u));
  }, []);

  const placeholderUrl = /CHANGE-ME/i.test(baseUrl);

  const next = () => {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(baseUrl.trim()) || placeholderUrl) {
      setShowServer(true);
      setError('Set the server address first (ask the office for it).');
      return;
    }
    setError(null);
    setStep('card');
  };

  const login = async (code: string) => {
    if (busy) return;
    const locationCode = code.trim();
    if (!locationCode) return;
    setBusy(true);
    setError(null);
    const url = cleanBaseUrl(baseUrl);
    try {
      const a = await api.auth(url, { username: username.trim(), password, locationCode });
      await secure.setBaseUrl(url);
      await secure.setAuth(a);
      await secure.setUsername(username.trim());
      await secure.setLocationCode(locationCode);
      setPassword('');
      props.onLoggedIn(a, url);
    } catch (e) {
      setError(loginError(e));
      if (e instanceof ApiError && e.status === 401) setStep('cred');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={ui.screen}>
      <Header title="IT Inventory Count" subtitle="Physical stock count" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
          {error && <Banner kind="error" text={error} />}

          {step === 'cred' ? (
            <Card>
              <Text style={ui.h2}>Step 1 of 2 — Log in</Text>
              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={next}
              />
              <Button title="Next: scan location card" onPress={next} />
            </Card>
          ) : (
            <Card>
              <Text style={ui.h2}>Step 2 of 2 — Scan your branch card</Text>
              <Text style={[ui.body, { marginBottom: 12 }]}>
                Scan the LOCATION card of the branch you are counting. Use the scanner, or tap 📷
                to use the camera.
              </Text>
              <ScanInput
                placeholder="Scan location card…"
                keepFocus={!busy && !camera}
                onSubmit={(c) => void login(c)}
                onCamera={() => setCamera(true)}
              />
              {busy && (
                <Banner kind="info" text="Checking your login and card…" style={{ marginTop: 14 }} />
              )}
              <Button
                title="Back"
                kind="secondary"
                onPress={() => {
                  setStep('cred');
                  setError(null);
                }}
                disabled={busy}
                style={{ marginTop: 14 }}
              />
            </Card>
          )}

          <Card>
            <Pressable
              onPress={() => setShowServer((v) => !v)}
              style={{ minHeight: 48, justifyContent: 'center' }}
              accessibilityRole="button"
            >
              <Text style={[ui.body, { color: colors.secondary, fontWeight: '700' }]}>
                {showServer ? '▾' : '▸'} Server settings
              </Text>
              {!showServer && (
                <Text style={ui.muted} numberOfLines={1}>
                  {baseUrl}
                </Text>
              )}
            </Pressable>
            {showServer && (
              <View style={{ marginTop: 8 }}>
                <Field
                  label="Server address (web app URL)"
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://your-app.vercel.app"
                />
                {placeholderUrl && (
                  <Banner kind="warning" text="This is a placeholder. Type the real server address." />
                )}
                <Text style={ui.muted}>Saved on this phone when you log in.</Text>
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <CameraScanner
        visible={camera}
        title="Scan location card"
        onClose={() => setCamera(false)}
        onScan={(c) => {
          setCamera(false);
          void login(c);
        }}
      />
    </View>
  );
}
