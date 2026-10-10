// Edge Function: storage-faxina
// -----------------------------------------------------------------------------
// Apaga do Storage o arquivo que NENHUMA linha do banco referencia.
//
// POR QUE ISTO EXISTE
// O app apaga a linha e deixa o arquivo. Excluir um look, um item do catálogo
// ou um ativo da biblioteca remove só o registro — o arquivo fica ocupando
// espaço, invisível, para sempre. Somado à importação de catálogo que sobe a
// imagem antes de o lojista salvar o item, isso encheu 543 MB de 985 MB.
//
// POR QUE EDGE FUNCTION, E NÃO UM SCRIPT NA MINHA MÁQUINA
// Apagar no Storage exige a service_role. Aqui ela já está no ambiente e não
// precisa sair do projeto para lugar nenhum.
//
// SEGURANÇA DA OPERAÇÃO
// - Só admin (secret ADMIN_EMAILS), como o admin-stats.
// - ENSAIO por padrão: sem `confirmar: true` ele lista e não apaga nada.
// - Quem decide o que é órfão é o SQL da migration 0033, não este arquivo.
// - Ignora arquivo com menos de 24h, pela janela entre o upload e o INSERT
//   da linha que o referencia.
// - Grava em storage_faxina_log tudo que apagou.
//
// Secrets: ADMIN_EMAILS
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// O Storage aceita mais por chamada, mas em lote pequeno um erro no meio
// custa pouco e o progresso fica visível na resposta.
const LOTE = 100;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
    } = await authed.auth.getUser();
    if (!user?.email) return json({ error: "Não autenticado." }, 401);
    if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return json({ error: "Sem permissão." }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const acao = body.action ?? "medir";

    if (acao === "medir") {
      const { data, error } = await admin.rpc("storage_uso");
      if (error) return json({ error: error.message }, 500);
      return json({ uso: data });
    }

    if (acao === "apagar") {
      const bucket = String(body.bucket ?? "");
      if (!bucket) return json({ error: "Informe o bucket." }, 400);

      const limite = Math.min(Number(body.limite ?? LOTE), 500);
      const idade = Number(body.idadeHoras ?? 24);

      const { data: orfaos, error } = await admin.rpc("storage_orfaos", {
        p_bucket: bucket,
        p_limite: limite,
        p_idade_horas: idade,
      });
      if (error) return json({ error: error.message }, 500);

      const lista = (orfaos ?? []) as { name: string; bytes: number }[];
      const mb = +(lista.reduce((s, o) => s + Number(o.bytes), 0) / 1048576).toFixed(1);

      // Ensaio: é o padrão. Só apaga quem pedir explicitamente.
      if (body.confirmar !== true) {
        return json({
          ensaio: true,
          bucket,
          encontrados: lista.length,
          mb,
          exemplos: lista.slice(0, 10).map((o) => o.name),
        });
      }

      const caminhos = lista.map((o) => o.name);
      if (caminhos.length === 0) return json({ bucket, apagados: 0, mb: 0 });

      const { error: delErr } = await admin.storage.from(bucket).remove(caminhos);
      if (delErr) return json({ error: `Falha ao apagar: ${delErr.message}` }, 500);

      // Registra DEPOIS de apagar: o log diz o que de fato sumiu, não o que
      // se pretendia apagar.
      await admin.from("storage_faxina_log").insert(
        lista.map((o) => ({ bucket, name: o.name, bytes: Number(o.bytes) })),
      );

      return json({ bucket, apagados: caminhos.length, mb, restam: null });
    }

    return json({ error: `Ação desconhecida: ${acao}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
