-- StyleDesk AI — F1: integridade de tokens e plano
-- ---------------------------------------------------------------------------
-- Impede que uma loja altere o próprio saldo/plano pela API (RLS não filtra
-- coluna). O cliente passa a só editar o PERFIL; saldo e plano mudam apenas por
-- funções server-side (SECURITY DEFINER) validadas. Idempotente.
-- ---------------------------------------------------------------------------

-- 1) Trava colunas sensíveis de `stores`: cliente edita só o perfil.
revoke update on public.stores from anon, authenticated;
grant update (name, cnpj, logo_url, description, location, phone, email, instagram, segment)
  on public.stores to anon, authenticated;

-- 2) token_transactions: cliente só LÊ (o extrato). Escrita só via RPC/service_role.
revoke insert, update, delete on public.token_transactions from anon, authenticated;

-- 3) Débito atômico e escopado à loja do usuário (valida saldo).
create or replace function public.debit_tokens(
  p_amount int,
  p_reason text default null,
  p_ref uuid default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := current_store_id();
  bal int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor de débito inválido';
  end if;
  if sid is null then
    raise exception 'Nenhuma loja no contexto';
  end if;
  select tokens_balance into bal from public.stores where id = sid for update;
  if bal is null then
    raise exception 'Loja não encontrada';
  end if;
  if bal < p_amount then
    raise exception 'Saldo de tokens insuficiente';
  end if;
  update public.stores
    set tokens_balance = tokens_balance - p_amount
    where id = sid
    returning tokens_balance into bal;
  insert into public.token_transactions (store_id, type, amount, ref_id)
    values (sid, 'debit', p_amount, p_ref);
  return bal;
end;
$$;

-- 4) Crédito atômico — NÃO exposto ao cliente (só service_role / pagamentos).
create or replace function public.credit_tokens(
  p_amount int,
  p_reason text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := current_store_id();
  bal int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor de crédito inválido';
  end if;
  if sid is null then
    raise exception 'Nenhuma loja no contexto';
  end if;
  update public.stores
    set tokens_balance = tokens_balance + p_amount
    where id = sid
    returning tokens_balance into bal;
  insert into public.token_transactions (store_id, type, amount)
    values (sid, 'credit', p_amount);
  return bal;
end;
$$;

-- Permissões de execução: débito pode ser chamado pelo app; crédito NÃO
-- (evita auto-recarga) — fica para o back-end de pagamentos com service_role.
revoke all on function public.debit_tokens(int, text, uuid) from public;
revoke all on function public.credit_tokens(int, text) from public;
-- O Supabase concede EXECUTE a anon/authenticated por default privileges; revoga
-- explicitamente o crédito desses papéis (evita auto-recarga pela API).
revoke execute on function public.credit_tokens(int, text) from anon, authenticated;
grant execute on function public.debit_tokens(int, text, uuid) to authenticated;
