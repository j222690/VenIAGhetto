// Traduz erros do Supabase Auth para mensagens específicas em pt-BR. Sem
// isso, toda tela mostrava sempre "Não foi possível entrar/criar a conta" —
// não dizia se era e-mail já cadastrado, senha curta, credenciais erradas etc.
//
// Usa `error.code` (supabase-js expõe isso desde a v2 recente) quando
// disponível — mais confiável que casar substring de mensagem em inglês.

interface AuthLikeError {
  code?: string;
  message?: string;
  status?: number;
}

const CODE_MESSAGES: Record<string, string> = {
  email_exists: "Esse e-mail já tem uma conta. Tente entrar em vez de criar uma nova.",
  user_already_exists: "Esse e-mail já tem uma conta. Tente entrar em vez de criar uma nova.",
  invalid_credentials: "E-mail ou senha incorretos.",
  weak_password: "Senha muito curta — use pelo menos 6 caracteres.",
  email_address_invalid: "Digite um e-mail válido.",
  email_address_not_authorized: "Esse e-mail não pode ser usado para cadastro.",
  over_email_send_rate_limit:
    "Muitos e-mails pedidos em pouco tempo. Aguarde alguns minutos e tente de novo.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.",
  user_not_found: "Não encontramos uma conta com esse e-mail.",
  same_password: "A nova senha precisa ser diferente da atual.",
  signup_disabled: "Novos cadastros estão temporariamente desativados.",
};

// Fallback por substring — para erros sem `.code` (SDKs antigas) ou vindos de
// outro lugar (rede, etc.).
const MESSAGE_PATTERNS: [RegExp, string][] = [
  [/already registered|already exists/i, CODE_MESSAGES.email_exists],
  [/invalid login credentials/i, CODE_MESSAGES.invalid_credentials],
  [/password.*(least|characters|short)/i, "Senha muito curta — use pelo menos 6 caracteres."],
  [/rate limit/i, CODE_MESSAGES.over_request_rate_limit],
  [/invalid email/i, CODE_MESSAGES.email_address_invalid],
  [/user not found/i, CODE_MESSAGES.user_not_found],
  [/network|fetch failed|failed to fetch/i, "Sem conexão. Confira sua internet e tente de novo."],
];

export function describeAuthError(err: unknown, fallback: string): string {
  const e = err as AuthLikeError | undefined;
  if (!e) return fallback;

  if (e.code && CODE_MESSAGES[e.code]) return CODE_MESSAGES[e.code];

  const msg = e.message ?? "";
  for (const [pattern, friendly] of MESSAGE_PATTERNS) {
    if (pattern.test(msg)) return friendly;
  }

  return fallback;
}
