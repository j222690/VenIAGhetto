// Edge Function: admin-showcase
// -----------------------------------------------------------------------------
// Material para os posts de DIVULGAÇÃO DO APP (tela /divulgar) — não é uma
// função do produto que o lojista usa, e sim uma ferramenta interna dos donos
// da Vest Ai.
//
// Devolve gerações já prontas de QUALQUER loja para servirem de prova real num
// antes/depois. Precisa de service_role porque o RLS isola por loja: uma conta
// normal só enxerga o que a própria loja gerou.
//
// QUEM PODE: só a loja da Vest Ai (secret ADMIN_STORE_ID) e, dentro dela, só
// quem é owner ou manager. Vendedor da mesma loja é equipe da operação, não
// dono do app, e não entra. O gate do frontend é só UX — a permissão de
// verdade é esta, no servidor.
//
// Só leitura: nunca escreve nada.
//
// Secrets: ADMIN_STORE_ID (uuid da loja dos donos do app)
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_STORE_ID = (Deno.env.get("ADMIN_STORE_ID") ?? "").trim();
const ADMIN_ROLES = ["owner", "manager"];

// Teto do que devolvemos de uma vez. A tela é uma galeria de escolha, não um
// relatório: mais que isso só pesaria o carregamento.
const LIMITE = 60;

interface Item {
  id: string;
  resultUrl: string;
  clientPhotoUrl: string | null;
  type: string;
  createdAt: string;
  storeName: string;
  ownStore: boolean;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado." }, 401);

    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: me } = await admin
      .from("users")
      .select("store_id, role")
      .eq("id", user.id)
      .single();

    if (
      !ADMIN_STORE_ID ||
      me?.store_id !== ADMIN_STORE_ID ||
      !ADMIN_ROLES.includes(me?.role ?? "")
    ) {
      return json({ error: "Sem permissão." }, 403);
    }

    const { data: rows, error } = await admin
      .from("generations")
      .select("id, store_id, type, input_refs, output_url, created_at")
      // status é NULL nas linhas anteriores à migration 0025 — todas já tinham
      // imagem, então valem como prontas (mesma regra do mapGeneration).
      .or("status.eq.pronta,status.is.null")
      .not("output_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(LIMITE);
    if (error) return json({ error: error.message }, 500);

    // Nome da loja junto, pra a tela deixar claro de quem é cada resultado —
    // importa na hora de pedir autorização antes de publicar.
    const ids = [...new Set((rows ?? []).map((r) => r.store_id as string))];
    const { data: lojas } = await admin.from("stores").select("id, name").in("id", ids);
    const nomes = new Map((lojas ?? []).map((l) => [l.id as string, (l.name as string) ?? ""]));

    const items: Item[] = (rows ?? []).map((r) => {
      const inputs = (r.input_refs ?? {}) as { clientPhotoUrl?: string };
      return {
        id: r.id as string,
        resultUrl: r.output_url as string,
        clientPhotoUrl: inputs.clientPhotoUrl ?? null,
        type: (r.type as string) ?? "",
        createdAt: r.created_at as string,
        storeName: nomes.get(r.store_id as string) ?? "",
        ownStore: (r.store_id as string) === ADMIN_STORE_ID,
      };
    });

    return json({ items });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
