import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAutoLogout } from '../hooks/useAutoLogout';

interface AuthContextValue {
  isAuthenticated: boolean;
  confirmAuth: () => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    api.iphoneAuth.sessionCheck()
      .then(result => setIsAuthenticated(result?.authenticated ?? false))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const confirmAuth = useCallback(async (): Promise<boolean> => {
    const result = await api.iphoneAuth.sessionCheck();
    const authenticated = result?.authenticated ?? false;
    setIsAuthenticated(authenticated);
    return authenticated;
  }, []);

  const logout = useCallback(() => {
    api.iphoneAuth.logout().catch(console.error);
    setIsAuthenticated(false);
  }, []);

  useAutoLogout(logout, isAuthenticated);

  return (
    <AuthContext.Provider value={{ isAuthenticated, confirmAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
