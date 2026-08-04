-- Vest Ai — Bloqueia escalonamento de privilégio via alteração de cargo
-- ---------------------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute UMA vez.
--
-- Problema: UserService.updateRole() faz update({role}) direto do cliente.
-- A policy users_update_managers (0001_init.sql) só confere se QUEM ESTÁ
-- AGINDO já é owner/manager da própria loja — ela não olha o VALOR que está
-- sendo gravado nem se a linha alterada é a do próprio usuário. Resultado:
-- um manager (ou até um seller, se algum dia essa policy afrouxar) consegue
-- chamar supabase.from("users").update({role:"owner"}).eq("id", <qualquer
-- id da própria loja, inclusive o próprio>) e se promover a dono.
--
-- A mitigação em src/routes/profile.tsx (TeamSection.changeRole) é só
-- client-side — não protege contra chamada direta à API. Este trigger é a
-- barreira de verdade, no banco: só um owner (agindo em linha QUE NÃO é a
-- dele mesmo) pode mudar o campo `role` de outra linha.
-- ---------------------------------------------------------------------------

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() = old.id then
      raise exception 'Você não pode alterar seu próprio cargo.';
    end if;
    if (select role from public.users where id = auth.uid()) is distinct from 'owner' then
      raise exception 'Apenas o dono da loja pode alterar cargos.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_self_escalation_trigger on public.users;
create trigger prevent_role_self_escalation_trigger
before update on public.users
for each row execute function public.prevent_role_self_escalation();
