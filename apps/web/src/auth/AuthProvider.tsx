import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { observeAuth } from './authService';
import { AuthContext } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      observeAuth((nextUser) => {
        setUser(nextUser);
        setLoading(false);
      }),
    [],
  );

  const value = useMemo(() => ({ user, loading }), [loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
