-- StyleDesk AI — convite de funcionário por LINK (além do convite por e-mail)
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Hoje (0003) o convite exige o e-mail exato de quem vai entrar. Aqui
-- adicionamos um 2º modo: o dono/gerente gera um LINK (sem e-mail definido) e
-- manda por WhatsApp/Instagram; quem abrir o link e se cadastrar entra
-- automaticamente na loja, no papel do convite — sem precisar bater e-mail.
--
-- O que faz:
--   1. store_invites.email vira opcional; store_invites.token identifica o
--      convite (usado na URL /register?invite=<token>).
--   2. handle_new_user passa a checar primeiro o invite_token (metadata do
--      signup); se não vier ou não bater, cai no fluxo por e-mail (0003).
--   3. get_invite_by_token — RPC pública (anon) só com nome da loja + papel,
--      para a tela de cadastro mostrar "convite de <loja>" antes do login.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Coluna token + e-mail opcional
-- ===========================================================================
alter table public.store_invites
  alter column email drop not null;

alter table public.store_invites
  add column if not exists token uuid not null default gen_random_uuid();

create unique index if not exists idx_store_invites_token
  on public.store_invites (token);

-- ===========================================================================
-- 2. handle_new_user — invite_token tem prioridade sobre o match por e-mail
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id   uuid;
  pending_invite public.store_invites%rowtype;
  resolved_name  text;
  meta_token     text;
begin
  resolved_name := coalesce(
    nullif(new.raw_user_meta_data->>'owner_name', ''),
    initcap(replace(split_part(new.email, '@', 1), '.', ' '))
  );

  meta_token := nullif(new.raw_user_meta_data->>'invite_token', '');

  -- 1) Convite por LINK (token) — ignora e-mail.
  if meta_token is not null then
    begin
      select * into pending_invite
        from public.store_invites
       where token = meta_token::uuid
         and status = 'pending'
       limit 1;
    exception when invalid_text_representation then
      -- token malformado: segue para o fluxo por e-mail abaixo.
      null;
    end;
  end if;

  -- 2) Sem token válido: convite por E-MAIL mais recente (fluxo original).
  if not found then
    select * into pending_invite
      from public.store_invites
     where lower(email) = lower(new.email)
       and status = 'pending'
     order by created_at desc
     limit 1;
  end if;

  if found then
    insert into public.users (id, store_id, email, role, name)
    values (new.id, pending_invite.store_id, new.email, pending_invite.role, resolved_name);

    update public.store_invites
       set status = 'accepted', accepted_at = now()
     where id = pending_invite.id;
  else
    insert into public.stores (name, cnpj, plan, tokens_balance)
    values (
      coalesce(new.raw_user_meta_data->>'store_name', 'Minha Loja'),
      new.raw_user_meta_data->>'cnpj',
      'starter',
      0
    )
    returning id into new_store_id;

    insert into public.users (id, store_id, email, role, name)
    values (new.id, new_store_id, new.email, 'owner', resolved_name);
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- 3. get_invite_by_token — preview público (anon) para a tela de cadastro
-- ===========================================================================
-- Só devolve o NOME da loja e o PAPEL do convite pendente — nada sensível.
-- SECURITY DEFINER pois quem chama ainda não está autenticado (RLS bloquearia).
create or replace function public.get_invite_by_token(p_token uuid)
returns table(store_name text, role user_role)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, i.role
    from public.store_invites i
    join public.stores s on s.id = i.store_id
   where i.token = p_token
     and i.status = 'pending'
   limit 1;
$$;

revoke all on function public.get_invite_by_token(uuid) from public;
grant execute on function public.get_invite_by_token(uuid) to anon, authenticated;
