import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@/types";
import { AuthService } from "@/services/AuthService";
import { TokenService } from "@/services/TokenService";
import { StoreService } from "@/services/StoreService";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: {
    storeName: string;
    ownerName?: string;
    email: string;
    password: string;
    cnpj?: string;
  }) => Promise<void>;
  signOut: () => void;
  refresh: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap assíncrono: lê a sessão do Supabase e escuta mudanças de auth.
  useEffect(() => {
    let active = true;
    AuthService.loadSession()
      .then((s) => {
        if (active) setSession(s);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = AuthService.onAuthStateChange((s) => {
      if (active) setSession(s);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(() => {
    const s = AuthService.getSession();
    if (s) {
      // Re-sync store snapshot for fresh token balance.
      setSession({ ...s, store: StoreService.get() });
    }
  }, []);

  // Re-render on token changes so badges stay in sync.
  useEffect(() => TokenService.subscribe(refresh), [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await AuthService.signIn(email, password);
    setSession(s);
  }, []);

  const signUp = useCallback(
    async (params: {
      storeName: string;
      ownerName?: string;
      email: string;
      password: string;
      cnpj?: string;
    }) => {
      const s = await AuthService.signUp(params);
      setSession(s);
    },
    [],
  );

  const signOut = useCallback(() => {
    void AuthService.signOut().then(() => setSession(null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, signIn, signUp, signOut, refresh }),
    [session, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
