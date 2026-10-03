import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "ORGANIZER" | "STAFF" | "ATTENDEE" | "SPEAKER";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUserManually: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const storedToken = await api.loadStoredToken();
        if (storedToken) {
          setToken(storedToken);
          const res = await api.getMe();
          if (res?.user) {
            setUser(res.user);
          }
        }
      } catch (err) {
        console.warn("Session restore failed, logging out:", err);
        await api.setToken(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.login(email, password);
    setUser(res.user);
    setToken(res.token);
    return res.user;
  };

  const logout = async () => {
    await api.setToken(null);
    setUser(null);
    setToken(null);
    try {
      router.replace("/(auth)/login");
    } catch (e) {
      console.warn("Logout navigation error:", e);
    }
  };

  const setUserManually = (u: User, t: string) => {
    setUser(u);
    setToken(t);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        setUserManually,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
