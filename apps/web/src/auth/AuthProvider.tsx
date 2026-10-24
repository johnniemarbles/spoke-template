import React, { createContext, useContext, useEffect, useState } from 'react';
import { platform } from '../platform/index.ts';
import type { Me } from '../platform/sdk.ts';

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  error: Error | null;
  can: (permissionKey: string) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await platform.me();
      setMe(data);
      setError(null);
    } catch (e: any) {
      setMe(null);
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const can = (permissionKey: string): boolean => {
    if (!me) return false;
    return me.permissions.includes(permissionKey);
  };

  return (
    <AuthContext.Provider value={{ me, loading, error, can, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
