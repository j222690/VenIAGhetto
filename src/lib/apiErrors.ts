// Traduz erros de chamadas de API/IA (Edge Functions, rede, provedores) pra
// mensagens em pt-BR - sem isso, erros técnicos em inglês (SDK do Supabase,
// resposta crua do Gemini/OpenAI, timeout de rede) apareciam direto pro
// lojista no toast. Mesmo padrão de src/lib/authErrors.ts.
//
// Estratégia: em vez de tentar reconhecer TODO erro técnico possível, só
// deixa passar mensagens que a GENTE mesma escreveu em pt-BR (a Edge Function
// já devolve texto amigável pra saldo insuficiente, prompt vazio etc.) -
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
  /^limite de usuários do plano atingido/i,
  /^o serviço de ia está sobrecarregado/i,
  // Recusa do filtro de conteúdo do modelo. Precisa passar inteira: é a única
  // mensagem que diz ao lojista o que FAZER (trocar a foto) em vez de mandar
  // tentar de novo - e repetir a mesma foto recusada dá sempre no mesmo.
  /^a ia recusou esta foto/i,
];

// Padrões técnicos conhecidos (SDK, rede, provedor) → mensagem amigável.
const MESSAGE_PATTERNS: [RegExp, string][] = [
  [/non-2xx status code/i, "Não foi possível completar a operação. Tente de novo em instantes."],
  [/failed to send a request|failed to fetch|network|load failed/i, "OFFLINE_OR_TIMEOUT"],
  [/timeout|timed out|aborted/i, "A operação demorou demais. Tente de novo."],
  [/não autenticado/i, "Sua sessão expirou. Saia e entre de novo."],
  [/payload|too large|entity too large|413/i, "A foto ficou pesada demais para enviar. Tente uma imagem menor."],
  [/quota|rate limit|resource_exhausted/i, "O serviço de IA atingiu o limite agora. Espere um minuto e tente de novo."],
  [/SAFETY|IMAGE_SAFETY|blocked|prohibited/i, "A IA bloqueou esta foto pelo filtro de conteúdo. Troque a foto e tente de novo."],
  [/sobrecarregado|não respondeu a tempo/i, "O serviço de IA está sobrecarregado no momento. Tente novamente em alguns instantes."],
];

export function describeApiError(err: unknown, fallback: string): string {
  const e = err as ApiLikeError | undefined;
  let msg = e?.message?.trim();
  if (!msg) return fallback;

  // Edge Function prefixa recusa do filtro com "RECUSA:" — tira o prefixo
  // técnico e devolve o texto amigável em pt-BR.
  if (/^RECUSA:/i.test(msg)) {
    msg = msg.replace(/^RECUSA:\s*/i, "").trim();
    if (/a ia recusou/i.test(msg)) return msg;
    return (
      "A IA recusou esta foto — o filtro de conteúdo bloqueou a imagem. " +
      "Troque a foto do cliente ou da peça e tente de novo."
    );
  }

  for (const pattern of KNOWN_SAFE_MESSAGES) {
    if (pattern.test(msg)) return msg;
  }
  for (const [pattern, friendly] of MESSAGE_PATTERNS) {
    if (pattern.test(msg)) {
      if (friendly === "OFFLINE_OR_TIMEOUT") {
        // "Failed to fetch" é genérico: só é FALTA DE INTERNET de verdade se o
        // navegador confirma que está offline. Senão, é timeout/erro de servidor
        // durante uma geração demorada - mensagem diferente pra não confundir o lojista.
        return typeof navigator !== "undefined" && navigator.onLine === false
          ? "Sem conexão. Confira sua internet e tente de novo."
          : "A geração demorou demais ou o servidor não respondeu. Tente de novo.";
      }
      return friendly;
    }
  }
  return fallback;
}