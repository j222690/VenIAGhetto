// Edge Function: admin-stats
// -----------------------------------------------------------------------------
// Painel de uso da PLATAFORMA INTEIRA (todas as lojas) — só pra quem está na
// lista de admins (secret ADMIN_EMAILS, e-mails separados por vírgula). Usa
// service_role pra ler além do RLS (que isola por loja). Só leitura agregada
// (contagens/somas) — nunca devolve dado individual de outra loja.
//
// Secrets: ADMIN_EMAILS (ex.: "victor@styledesk.app,outro@email.com")
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user?.email) return json({ error: "Não autenticado." }, 401);
    if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return json({ error: "Sem permissão." }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const [stores, users, tryonCount, postCount, scannerCount, debits] = await Promise.all([
      admin.from("stores").select("id", { count: "exact", head: true }),
      admin.from("users").select("id", { count: "exact", head: true }),
      admin.from("generations").select("id", { count: "exact", head: true }).eq("type", "tryon"),
      admin.from("generations").select("id", { count: "exact", head: true }).eq("type", "post"),
      admin.from("generations").select("id", { count: "exact", head: true }).eq("type", "scanner"),
      admin.from("token_transactions").select("amount").eq("type", "debit"),
    ]);

    const tokensConsumed = (debits.data ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);

    // Lojas criadas nos últimos 7 dias — sinal simples de crescimento.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newStoresWeek } = await admin
      .from("stores")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo);

    return json({
      totalStores: stores.count ?? 0,
      totalUsers: users.count ?? 0,
      newStoresLast7Days: newStoresWeek ?? 0,
      generationsByType: {
        tryon: tryonCount.count ?? 0,
        post: postCount.count ?? 0,
        scanner: scannerCount.count ?? 0,
      },
      totalGenerations: (tryonCount.count ?? 0) + (postCount.count ?? 0) + (scannerCount.count ?? 0),
      tokensConsumed,
      note:
        "Requisições por minuto/segundo não são registradas hoje (precisaria de um log próprio) — " +
        "estes números são contagens totais do banco, não uma taxa em tempo real.",
    });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
