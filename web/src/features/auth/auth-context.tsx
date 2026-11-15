import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { TOKEN_EXPIRED_EVENT, clearToken, readToken, writeToken } from "@/lib/api/token";
import type { User } from "@/lib/api/types";
import { qk } from "@/lib/query/keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthStatus = "loading" | "anonymous" | "authenticated";

type AuthValue = {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  /** Set when the gateway ends the session; LoginPage shows it once. */
  sessionMessage: string | null;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => readToken());
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: qk.me(),
    queryFn: async () => unwrap(await api.GET("/api/auth/me")),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const onExpired = () => {
      queryClient.clear();
      setToken(null);
      setSessionMessage("Phiên đã hết hạn. Đăng nhập lại để tiếp tục.");
    };
    window.addEventListener(TOKEN_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(TOKEN_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

  useEffect(() => {
    if (!token) return;
    if (meQuery.isError) {
      // A stored token the gateway no longer accepts is not a session.
      clearToken();
      setToken(null);
      setSessionMessage("Phiên đã hết hạn. Đăng nhập lại để tiếp tục.");
    }
  }, [token, meQuery.isError]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = unwrap(await api.POST("/api/auth/login", { body: { email, password } }));
      writeToken(result.token);
      setToken(result.token);
      setSessionMessage(null);
      queryClient.setQueryData(qk.me(), { user: result.user });
      return result.user;
    },
    [queryClient],
  );

  const value = useMemo<AuthValue>(() => {
    const user = meQuery.data?.user ?? null;
    const status: AuthStatus = !token
      ? "anonymous"
      : meQuery.isLoading
        ? "loading"
        : user
          ? "authenticated"
          : "anonymous";
    return { user, status, login, logout, sessionMessage };
  }, [meQuery.data, meQuery.isLoading, token, login, logout, sessionMessage]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải nằm trong AuthProvider");
  return context;
}
