-- StyleDesk AI — corrige nome de loja vazio no fallback do cadastro
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Bug: a tela "Entrar com convite" (cadastro simplificado, sem campo "Nome
-- da loja") manda store_name = '' (string vazia) em vez de null. Se o e-mail
-- digitado não bater com nenhum convite pendente (ex.: digitou errado), o
-- trigger cai no fallback de criar loja nova — e `coalesce('', 'Minha Loja')`
-- NÃO substitui string vazia (só substitui NULL), então a loja nascia sem
-- nome. Troca para `nullif(...)` antes do coalesce, que trata '' como NULL.
-- ---------------------------------------------------------------------------

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
      coalesce(nullif(new.raw_user_meta_data->>'store_name', ''), 'Minha Loja'),
      nullif(new.raw_user_meta_data->>'cnpj', ''),
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
