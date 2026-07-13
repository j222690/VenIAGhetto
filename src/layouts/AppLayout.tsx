import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";

interface Props {
  title?: string;
  subtitle?: string;
  showTokens?: boolean;
  children: ReactNode;
}

export function AppLayout({ title, subtitle, showTokens, children }: Props) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!session) return <Navigate to="/welcome" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title={title} subtitle={subtitle} showTokens={showTokens} />
      <main className="mx-auto max-w-md px-5 pb-28 pt-5">{children}</main>
      <BottomNav />
    </div>
  );
}
