-- 0030 — creditar pagamento numa transação só
--
-- O PROBLEMA
-- As funções de pagamento creditavam assim, em JavaScript:
--
--   saldo = select tokens_balance ...      -- lê
--   update stores set tokens_balance = saldo + n   -- escreve
--
-- Entre a leitura e a escrita cabe outra execução. Dois webhooks do mesmo
-- lojista chegando juntos (um pacote de créditos e a cobrança da assinatura,
-- por exemplo) leem o MESMO saldo e escrevem por cima um do outro: um dos dois
-- créditos some, sem erro nenhum no log. O Mercado Pago entrega notificações
-- em paralelo, então isso não é hipótese remota.
--
-- Havia ainda uma segunda janela: a trava de idempotência era gravada ANTES do
-- crédito, em outra instrução. Se o processo morresse no meio, a chave ficava
-- marcada como processada e o dinheiro entrava sem o crédito — e a reentrega
-- do Mercado Pago seria ignorada. O lojista paga e não recebe.
--
-- POR QUE NÃO USAR credit_tokens (migration 0011)
-- Ela descobre a loja por current_store_id(), que sai de auth.uid(). Webhook
-- roda com service_role e sem usuário: auth.uid() é nulo e a função levanta
-- "Nenhuma loja no contexto". Daí a loja precisar vir por parâmetro aqui.
--
-- A SOLUÇÃO
-- Uma função só, uma transação só: grava a chave, credita e registra o extrato.
-- Ou acontece tudo, ou não acontece nada. O retorno diz qual foi o caso —
-- null significa "esta chave já tinha sido processada", que é resposta normal
-- e não erro (o Mercado Pago reentrega de propósito).

create or replace function public.credit_payment_once(
  p_store_id uuid,
  p_amount   int,
  p_key      text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  bal int;
begin
  if p_store_id is null or p_key is null or p_key = '' then
    raise exception 'Parâmetros inválidos para creditar pagamento';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Valor de crédito inválido';
  end if;

  insert into public.processed_payments (session_id, store_id)
    values (p_key, p_store_id)
    on conflict (session_id) do nothing;

  -- FOUND fica falso quando o ON CONFLICT não inseriu nada: alguém já tratou
  -- este pagamento.
  if not found then
    return null;
  end if;

  if p_amount = 0 then
    select tokens_balance into bal from public.stores where id = p_store_id;
    return coalesce(bal, 0);
  end if;

  -- Incremento no próprio banco, não em cima de um valor lido antes: é isto
  -- que fecha a corrida.
  update public.stores
     set tokens_balance = tokens_balance + p_amount
   where id = p_store_id
   returning tokens_balance into bal;

  if bal is null then
    raise exception 'Loja % não encontrada', p_store_id;
  end if;

  insert into public.token_transactions (store_id, type, amount)
    values (p_store_id, 'credit', p_amount);

  return bal;
end;
$$;

-- Só o back-end de pagamentos chama. Liberar para authenticated seria dar um
-- botão de auto-recarga a qualquer usuário logado.
revoke all on function public.credit_payment_once(uuid, int, text) from public;
revoke execute on function public.credit_payment_once(uuid, int, text) from anon, authenticated;
grant execute on function public.credit_payment_once(uuid, int, text) to service_role;
