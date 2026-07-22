// Traduz erros de chamadas de API/IA (Edge Functions, rede, provedores) pra
// mensagens em pt-BR — sem isso, erros técnicos em inglês (SDK do Supabase,
// resposta crua do Gemini/OpenAI, timeout de rede) apareciam direto pro
// lojista no toast. Mesmo padrão de src/lib/authErrors.ts.
//
// Estratégia: em vez de tentar reconhecer TODO erro técnico possível, só
// deixa passar mensagens que a GENTE mesma escreveu em pt-BR (a Edge Function
// já devolve texto amigável pra saldo insuficiente, prompt vazio etc.) —
// qualquer coisa não reconhecida cai num fallback genérico, nunca mostra
// texto cru (inglês, stack trace, JSON de erro de provedor).

interface ApiLikeError {
  message?: string;
}

// Mensagens que a própria Edge Function/serviços já escrevem em pt-BR e são
// seguras de mostrar direto (passam pelo filtro sem alteração).
const KNOWN_SAFE_MESSAGES: RegExp[] = [
  /^saldo de tokens insuficiente/i,
  /^você já usou todas as gerações/i,
  /^escolha um fundo/i,
  /^envie (ao menos|a foto)/i,
  /^selecione uma foto/i,
  /^são necessários \d+/i,
  /^informe um link válido/i,
  /^este endereço não é permitido/i,
];

// Padrões técnicos conhecidos (SDK, rede, provedor) → mensagem amigável.
const MESSAGE_PATTERNS: [RegExp, string][] = [
  [/non-2xx status code/i, "Não foi possível completar a operação. Tente de novo em instantes."],
  [/failed to send a request|failed to fetch|network|load failed/i, "Sem conexão. Confira sua internet e tente de novo."],
  [/timeout|timed out|aborted/i, "A operação demorou demais. Tente de novo."],
  [/não autenticado/i, "Sua sessão expirou. Saia e entre de novo."],
];

export function describeApiError(err: unknown, fallback: string): string {
  const e = err as ApiLikeError | undefined;
  const msg = e?.message?.trim();
  if (!msg) return fallback;

  for (const pattern of KNOWN_SAFE_MESSAGES) {
    if (pattern.test(msg)) return msg;
  }
  for (const [pattern, friendly] of MESSAGE_PATTERNS) {
    if (pattern.test(msg)) return friendly;
  }
  return fallback;
}
