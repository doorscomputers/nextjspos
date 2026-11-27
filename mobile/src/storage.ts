// Secrets and login details live in SecureStore (encrypted by Android).
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { AuthResult } from './api';

const K = {
  baseUrl: 'it_count_base_url',
  auth: 'it_count_auth', // JSON of AuthResult (includes the token)
  username: 'it_count_username',
  locationCode: 'it_count_location_code',
};

export const DEFAULT_BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'https://CHANGE-ME.vercel.app';

async function get(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export const secure = {
  getBaseUrl: async () => (await get(K.baseUrl)) || DEFAULT_BASE_URL,
  setBaseUrl: (v: string) => SecureStore.setItemAsync(K.baseUrl, v),

  getAuth: async (): Promise<AuthResult | null> => {
    const raw = await get(K.auth);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthResult;
    } catch {
      return null;
    }
  },
  setAuth: (a: AuthResult) => SecureStore.setItemAsync(K.auth, JSON.stringify(a)),
  clearAuth: () => SecureStore.deleteItemAsync(K.auth),

  getUsername: async () => (await get(K.username)) ?? '',
  setUsername: (v: string) => SecureStore.setItemAsync(K.username, v),
  getLocationCode: async () => (await get(K.locationCode)) ?? '',
  setLocationCode: (v: string) => SecureStore.setItemAsync(K.locationCode, v),
};
