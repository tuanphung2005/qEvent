import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { E2E_TOKEN } from '../api/env';

const TOKEN_KEY = 'qevent.auth.token';
const USER_KEY = 'qevent.auth.user';
const DEVICE_KEY = 'qevent.device.id';

/**
 * SecureStore is native-only. Web is a dev convenience and never ships, so a
 * module-level map is enough there instead of pulling AsyncStorage.
 */
const webStore = new Map<string, string>();

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStore.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  if (E2E_TOKEN) return E2E_TOKEN;
  return getSecureItem(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await setSecureItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await deleteSecureItem(TOKEN_KEY);
  await deleteSecureItem(USER_KEY);
}

export async function saveUser(user: unknown): Promise<void> {
  await setSecureItem(USER_KEY, JSON.stringify(user));
}

export async function loadUser<T>(): Promise<T | null> {
  const raw = await getSecureItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await deleteSecureItem(USER_KEY);
    return null;
  }
}

/** Stable per-install gate identity; survives app restarts, not reinstalls. */
export async function getDeviceId(): Promise<string> {
  const existing = await getSecureItem(DEVICE_KEY);
  if (existing) return existing;

  const created = `device-${Crypto.randomUUID()}`;
  await setSecureItem(DEVICE_KEY, created);
  return created;
}
