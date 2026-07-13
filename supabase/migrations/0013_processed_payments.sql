-- Vest IA — trava de idempotência de pagamentos Stripe
-- ---------------------------------------------------------------------------
-- Garante que cada sessão de checkout do Stripe credite tokens UMA única vez,
-- mesmo que o webhook e a confirmação-no-retorno rodem os dois. Só a service_role
-- (Edge Functions) acessa; o cliente não tem policy (acesso negado por RLS).
-- ---------------------------------------------------------------------------

create table if not exists public.processed_payments (
  session_id text primary key,
  store_id uuid,
  created_at timestamptz not null default now()
);

alter table public.processed_payments enable row level security;
-- Sem policies: anon/authenticated ficam sem acesso; service_role ignora o RLS.
