/**
 * Public runtime configuration. Never put secrets in EXPO_PUBLIC_*.
 *
 * Android emulator: http://10.0.2.2:8000
 * iOS simulator:    http://localhost:8000
 * Real device:      http://<LAN-IP>:8000
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:8000';

export const WS_BASE_URL =
  process.env.EXPO_PUBLIC_WS_BASE_URL?.replace(/\/+$/, '') ?? API_BASE_URL.replace(/^http/, 'ws');

/** Maestro builds may inject a fixture token instead of driving the login form. */
export const E2E_MODE = process.env.EXPO_PUBLIC_E2E === '1';
export const E2E_TOKEN = E2E_MODE ? (process.env.EXPO_PUBLIC_E2E_TOKEN ?? null) : null;
