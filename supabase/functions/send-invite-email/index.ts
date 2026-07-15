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
  <body style="margin:0;padding:0;background:#0B0D16;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0D16;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141622;border:1px solid #262a3d;border-radius:24px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:40px 32px 8px;">
                <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#FF37B6;font-weight:700;">Vest · IA</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px;">
                <h1 style="font-size:24px;font-weight:700;color:#F4F5F9;margin:0 0 12px;text-align:center;">Você foi convidado(a) para a equipe</h1>
                <p style="font-size:15px;line-height:1.6;color:#A3A6B8;margin:0 0 8px;text-align:center;">
                  <strong style="color:#F4F5F9;">${storeName}</strong> te convidou para fazer parte da equipe no Vest IA, como <strong style="color:#F4F5F9;">${roleLabel}</strong>.
                </p>
                <p style="font-size:15px;line-height:1.6;color:#A3A6B8;margin:0;text-align:center;">
                  Toque no botão abaixo para criar sua conta — você já entra direto na loja, sem precisar preencher nada além do seu nome, e-mail e senha.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 32px 8px;">
                <a href="${link}" style="display:inline-block;background:#FF37B6;color:#0B0D16;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:999px;">
                  Criar minha conta
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 40px;">
                <p style="font-size:12px;line-height:1.6;color:#6E7186;margin:0;text-align:center;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br />
                  <a href="${link}" style="color:#FF37B6;word-break:break-all;">${link}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="font-size:11px;color:#6E7186;margin:16px 0 0;">© Vest IA</p>
        </td>
      </tr>
    </table>
  </body>`;
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
