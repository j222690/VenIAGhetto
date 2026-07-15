-- StyleDesk AI — excluir cliente é restrito ao DONO da loja
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
-- Idempotente.
--
-- Antes (0003): qualquer papel podia fazer QUALQUER operação em clients
-- (policy única "for all"). Agora: adicionar/editar/ver continua liberado
-- pra equipe toda (são quem mais atende cliente no dia a dia); excluir passa
-- a ser só do dono — reforça no BANCO a mesma regra já aplicada na tela
-- (clients.tsx usa a permissão `clients:delete`), pra não dar pra excluir
-- direto pela API ignorando a UI.
-- ---------------------------------------------------------------------------

drop policy if exists clients_all_same_store on public.clients;

drop policy if exists clients_select_same_store on public.clients;
create policy clients_select_same_store on public.clients
  for select using (store_id = public.current_store_id());

drop policy if exists clients_insert_same_store on public.clients;
create policy clients_insert_same_store on public.clients
  for insert with check (store_id = public.current_store_id());

drop policy if exists clients_update_same_store on public.clients;
create policy clients_update_same_store on public.clients
  for update
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

drop policy if exists clients_delete_owner_only on public.clients;
create policy clients_delete_owner_only on public.clients
  for delete using (
    store_id = public.current_store_id()
    and public.current_user_role() = 'owner'
  );
