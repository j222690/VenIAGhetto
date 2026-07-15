// Edge Function: send-invite-email
// -----------------------------------------------------------------------------
// Manda o e-mail de convite de funcionário via Resend. A RESEND_API_KEY nunca
// vai para o frontend — fica como secret aqui (servidor).
//
// body: { inviteId: string } — a função busca o convite (e o nome da loja)
// usando o token de quem chamou, então a RLS de store_invites (só owner/
// manager da própria loja) já garante que ninguém manda e-mail em nome de
// convite de outra loja.
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const APP_URL = "https://vestaiapp.com";
const FROM = "Vest IA <convites@vestaiapp.com>";

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono",
  manager: "Gerente",
  seller: "Vendedor",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function buildHtml(storeName: string, role: string, link: string): string {
  const roleLabel = ROLE_LABEL[role] ?? role;
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
    <p style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #b8763f; margin: 0 0 16px;">Vest · IA</p>
    <h1 style="font-size: 22px; margin: 0 0 16px;">Você foi convidado(a) para a equipe</h1>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
      <strong>${storeName}</strong> te convidou para fazer parte da equipe no Vest IA, como <strong>${roleLabel}</strong>.
    </p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
      Clique no botão abaixo para criar sua conta — você já entra direto na loja, sem precisar preencher nada além do seu nome, e-mail e senha.
    </p>
    <a href="${link}" style="display: inline-block; background: #b8763f; color: #fff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 999px; font-size: 15px;">
      Criar minha conta
    </a>
    <p style="font-size: 12px; color: #888; margin: 24px 0 0; line-height: 1.5;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <a href="${link}" style="color: #b8763f;">${link}</a>
    </p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    if (!RESEND_KEY) return json({ error: "RESEND_API_KEY não configurada" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json().catch(() => ({}));
    const inviteId: string = body.inviteId ?? "";
    if (!inviteId) return json({ error: "inviteId ausente." }, 400);

    // RLS (store_invites_select) já restringe a owner/manager da própria loja.
    const { data: invite, error: inviteErr } = await authed
      .from("store_invites")
      .select("email, role, token, stores(name)")
      .eq("id", inviteId)
      .maybeSingle();
    if (inviteErr || !invite) return json({ error: "Convite não encontrado." }, 404);
    if (!invite.email) return json({ error: "Este convite não tem e-mail (é um convite por link)." }, 400);

    const storeName = (invite.stores as unknown as { name?: string } | null)?.name ?? "sua loja";
    const link = `${APP_URL}/register?invite=${invite.token}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [invite.email],
        subject: `Você foi convidado(a) para a equipe de ${storeName} no Vest IA`,
        html: buildHtml(storeName, invite.role, link),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
