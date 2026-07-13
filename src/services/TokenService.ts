// TokenService — saldo e extrato de tokens.
//
// LEITURA e ESCRITA reais no Supabase: saldo em stores.tokens_balance, extrato
// em token_transactions. `debit`/`credit` atualizam o cache de forma otimista
// (UI reativa na hora) e persistem no banco em seguida. A atomicidade ideal
// (RPC/Edge Function para evitar corrida) fica para a fase de IA — ver TEMPORÁRIO.
//
// A UI lê de forma síncrona (`balance()`, `transactions()`) e se inscreve em
// `subscribe()` para re-render; mantemos esse contrato com cache + notify.

import type { TokenTransaction } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { mapTransaction } from "@/integrations/supabase/mappers";
import { StoreService } from "./StoreService";

let txs: TokenTransaction[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

// Lançamento local (otimista) para o extrato da UI. `reason` é só de exibição
// (a tabela token_transactions guarda type/amount/ref_id, não o motivo).
function localTx(storeId: string, amount: number, reason: string): TokenTransaction {
  return {
    id: `t_${Date.now()}`,
    storeId,
    amount,
    reason,
    createdAt: new Date().toISOString(),
  };
}

// Soma dos débitos do mês corrente (deriva tokensUsedThisMonth, que não tem
// coluna própria no banco).
function computeUsedThisMonth(list: TokenTransaction[]): number {
  const now = new Date();
  return list.reduce((acc, t) => {
    const d = new Date(t.createdAt);
    const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return sameMonth && t.amount < 0 ? acc + Math.abs(t.amount) : acc;
  }, 0);
}

export const TokenService = {
  balance(): number {
    return StoreService.get().tokensBalance;
  },
  usedThisMonth(): number {
    return StoreService.get().tokensUsedThisMonth;
  },
  transactions(): TokenTransaction[] {
    return txs;
  },

  // Há saldo suficiente para gastar `amount`?
  hasBalance(amount: number): boolean {
    return StoreService.get().tokensBalance >= amount;
  },

  // Carrega o extrato da loja e sincroniza o tokensUsedThisMonth no cache da
  // StoreService. O saldo (tokensBalance) já vem de StoreService.getCurrentStore.
  async load(storeId?: string): Promise<TokenTransaction[]> {
    let query = supabase
      .from("token_transactions")
      .select("*")
      .order("created_at", { ascending: false });
    if (storeId) query = query.eq("store_id", storeId);

    const { data, error } = await query;
    if (error) throw error;

    txs = (data ?? []).map(mapTransaction);
    StoreService.update({ tokensUsedThisMonth: computeUsedThisMonth(txs) });
    notify();
    return txs;
  },

  // Débito real por geração. Atualiza cache (otimista) e persiste no banco.
  // TEMPORÁRIO: idealmente atômico via RPC/Edge Function (evita corrida de
  // saldo) — fica para a fase de IA. `refId` liga o débito à geração.
  async debit(amount: number, reason: string, refId?: string): Promise<void> {
    const store = StoreService.get();
    const next = Math.max(0, store.tokensBalance - amount);
    StoreService.update({
      tokensBalance: next,
      tokensUsedThisMonth: store.tokensUsedThisMonth + amount,
    });
    txs = [localTx(store.id, -amount, reason), ...txs];
    notify();

    try {
      await supabase.from("stores").update({ tokens_balance: next }).eq("id", store.id);
      await supabase
        .from("token_transactions")
        .insert({ store_id: store.id, type: "debit", amount, ref_id: refId ?? null });
    } catch {
      // Mantém o estado otimista mesmo se a persistência falhar.
    }
  },

  // Crédito real (recarga). A compra via pagamento fica para depois; por ora é
  // usado pelo botão de teste do owner.
  async credit(amount: number, reason: string): Promise<void> {
    const store = StoreService.get();
    const next = store.tokensBalance + amount;
    StoreService.update({ tokensBalance: next });
    txs = [localTx(store.id, amount, reason), ...txs];
    notify();

    try {
      await supabase.from("stores").update({ tokens_balance: next }).eq("id", store.id);
      await supabase
        .from("token_transactions")
        .insert({ store_id: store.id, type: "credit", amount });
    } catch {
      // Mantém o estado otimista mesmo se a persistência falhar.
    }
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  reset(): void {
    txs = [];
    notify();
  },
};
