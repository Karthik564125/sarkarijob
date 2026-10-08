import React, { createContext, useContext, useState, useCallback } from 'react';
import { authApi } from '../lib/api.js';
import type { SafeUser, AuthContextType, RegisterData } from '../types/api.types.js';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(() => {
    const saved = localStorage.getItem('sarkarijob_user');
    return saved ? (JSON.parse(saved) as SafeUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('sarkarijob_token');
  });
  const [isLoading, setIsLoading] = useState(false);

  const persistSession = (newToken: string, newUser: SafeUser) => {
    localStorage.setItem('sarkarijob_token', newToken);
    localStorage.setItem('sarkarijob_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await authApi.login({ usernameOrEmail, password });
      persistSession(data.token, data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const { data: res } = await authApi.register(data);
      persistSession(res.token, res.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sarkarijob_token');
    localStorage.removeItem('sarkarijob_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
