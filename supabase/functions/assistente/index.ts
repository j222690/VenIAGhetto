// Edge Function: assistente
// -----------------------------------------------------------------------------
// Responde dúvidas do lojista SOBRE O APP: o que cada tela faz, como usar,
// quanto custa, por que uma geração demorou.
//
// NÃO consulta dado nenhum da loja. Foi decisão de produto: a maior parte das
// dúvidas é de uso, e um assistente que lê o banco precisaria de cuidado
// redobrado para nunca cruzar a linha entre uma loja e outra. O saldo e o
// histórico já estão na tela; aqui a régua é ensinar.
//
// A BASE DE CONHECIMENTO vem do cliente (src/constants/assistantKnowledge.ts).
// Parece estranho o cliente mandar o que o servidor deve saber, mas é o que
// mantém a base viva: quem muda uma tela edita o arquivo no mesmo commit. Numa
// cópia aqui dentro, ela envelheceria calada. O texto não é segredo — é a
// documentação do app — e a resposta não depende de o cliente ser honesto:
// mentir na base só faz o assistente errar para quem mentiu.
//
// Só texto: não gera imagem e NÃO cobra crédito. O gate é estar autenticado.
//
// Secrets: GEMINI_API_KEY
// -----------------------------------------------------------------------------
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TEXT_MODEL = "gemini-3.6-flash";
const GENAI = "https://generativelanguage.googleapis.com/v1beta/models";

// Tetos. Uma conversa de ajuda não precisa de mais que isso, e sem eles a
// função vira um modelo de texto de graça para quem tiver um login.
const MAX_MENSAGENS = 20;
const MAX_CARACTERES = 1500;

const REGRAS = `
Você é o assistente do Vest Ai, falando com a LOJISTA que usa o app.

COMO RESPONDER
- Português do Brasil, direto, sem jargão. Trate por "você".
- Curto: 2 a 5 frases. Se for um passo a passo, use lista curta.
- Diga o nome da tela e do botão como aparecem no app ("Provador", "Adicionar peça").
- ACENTUAÇÃO CORRETA, sempre: "não", "você", "é", "possível". Texto sem acento
  parece descuido para quem lê em português.
- Dê o NÚMERO quando a base tem um: "até 4 peças", "R$ 97", "7 dias". Responder
  "o limite é menor" quando você sabe o limite deixa a pessoa sem resposta.
- Sem emoji, sem saudação floreada, sem "como assistente de IA".
- TEXTO PURO. Nada de markdown: sem **negrito**, sem # títulos, sem \`código\`.
  A tela mostra o texto como veio, então um asterisco aparece como asterisco.
  Para listar, use "1." ou "-" no começo da linha e nada mais.

O QUE VOCÊ NÃO PODE FAZER
- NÃO invente recurso, preço, prazo ou atalho. Se não está na base abaixo, você
  não sabe — diga isso e ofereça o WhatsApp do suporte.
- NÃO afirme nada sobre a loja de quem pergunta: você não vê saldo, clientes,
  catálogo nem histórico. Se perguntarem, diga onde a informação aparece na tela.
- NÃO prometa resultado de vendas.
- Assunto fora do Vest Ai: recuse em uma frase e volte ao app.

BASE DE CONHECIMENTO — é a única fonte da verdade:
`.trim();

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

    const body = await req.json().catch(() => ({}));
    const base: string = (body.knowledge ?? "").toString();
    const tela: string = (body.screen ?? "").toString().slice(0, 60);
    const mensagens: { role: string; content: string }[] = Array.isArray(body.messages)
      ? body.messages.slice(-MAX_MENSAGENS)
      : [];
    if (!base.trim() || mensagens.length === 0) {
      return json({ error: "Pergunta vazia." }, 400);
    }

    // A tela em que o lojista está entra como contexto: "como faço isso?" no
    // Provador e no Catálogo são perguntas diferentes.
    const contexto = tela ? `\n\nO lojista está agora na tela: ${tela}.` : "";
    const sistema = `${REGRAS}\n\n${base}${contexto}`;

    const contents = mensagens.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: (m.content ?? "").toString().slice(0, MAX_CARACTERES) }],
    }));

    const res = await fetch(`${GENAI}/${TEXT_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents,
        // 700 cortava a resposta no meio da frase: este modelo gasta parte do
        // orçamento de saída raciocinando antes de escrever, então o teto não
        // é só o tamanho do texto. 2048 dá folga; o tamanho de verdade quem
        // limita é a instrução de responder em 2 a 5 frases.
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    });
    const data = await res.json();
    if (data.error) return json({ error: data.error.message ?? "Erro no assistente." }, 502);

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    if (!text) return json({ error: "Não consegui responder agora." }, 502);

    return json({ text });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
