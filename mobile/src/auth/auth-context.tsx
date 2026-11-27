import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '../api/client';
import { ApiError, toNetworkError, unwrap } from '../api/errors';
import { queryClient } from '../api/query-client';
import { isSupportedMobileRole, type User } from '../api/types';
import { clearToken, getToken, loadUser, saveToken, saveUser } from './token-store';

type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  user: User | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'restoring', user: null });

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = await getToken();
      if (!token) {
        if (!cancelled) setState({ status: 'signedOut', user: null });
        return;
      }

      const cachedUser = await loadUser<User>();

      try {
        const result = await api.GET('/api/auth/me');
        const data = unwrap(result);
        const user = data.user as User;

        if (!isSupportedMobileRole(user.role)) {
          await clearToken();
          if (!cancelled) setState({ status: 'signedOut', user: null });
          return;
        }

        await saveUser(user);
        if (!cancelled) setState({ status: 'signedIn', user });
      } catch (error) {
        // Offline or backend hiccup: keep a cached session so the gate stays
        // usable; only an explicit auth rejection clears it.
        const rejected =
          error instanceof ApiError && (error.status === 401 || error.status === 403);
        if (cachedUser && isSupportedMobileRole(cachedUser.role) && !rejected) {
          if (!cancelled) setState({ status: 'signedIn', user: cachedUser });
          return;
        }
        if (rejected) {
          await clearToken();
        }
        if (!cancelled) setState({ status: 'signedOut', user: null });
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await api.POST('/api/auth/login', {
        body: { email: email.trim().toLowerCase(), password },
      });
      const data = unwrap(result);
      const user = data.user as User;

      if (!isSupportedMobileRole(user.role)) {
        throw new ApiError(
          403,
          'ROLE_NOT_SUPPORTED',
          'Tài khoản host dùng web console, không dùng app di động.'
        );
      }

      await saveToken(data.token);
      await saveUser(user);
      queryClient.clear();
      setState({ status: 'signedIn', user });
      return user;
    } catch (error) {
      throw toNetworkError(error);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    queryClient.clear();
    setState({ status: 'signedOut', user: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
