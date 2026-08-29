-- Vest Ai — assinaturas de Web Push (aviso com o app FECHADO)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- POR QUE: a Notification API sozinha só avisa com o app ABERTO (mesmo que em
-- outra aba). Como a geração passou a rodar em segundo plano (migration 0025),
-- o lojista pode fechar o app e voltar depois — e é justamente aí que o aviso
-- importa. Web Push entrega com o app fechado, mas exige guardar a assinatura
-- que o navegador emite (endpoint + chaves) pra o servidor conseguir empurrar.
--
-- Uma pessoa pode ter VÁRIAS linhas: um endpoint por navegador/dispositivo.
-- A chave natural é o endpoint, não o usuário.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada um administra as PRÓPRIAS assinaturas. O envio roda com service_role,
-- que ignora RLS — então o servidor lê todas sem precisar de policy extra.
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
