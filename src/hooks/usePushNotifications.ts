// Web Push — aviso de "sua imagem está pronta" com o app FECHADO.
//
// Portado do padrão que já roda em produção no Missao1ENEM, com as mesmas
// travas que aquele app aprendeu na prática:
//
//  • A permissão só é pedida a partir de um GESTO do usuário (toque/clique).
//    No iOS/Safari isso não é preferência, é exigência: pedir fora de um
//    gesto simplesmente não funciona.
//  • No iPhone, Web Push só existe com o app INSTALADO na tela inicial. Numa
//    aba normal do Safari não há push, e a UI precisa dizer isso em vez de
//    deixar o lojista achar que ativou.
//  • O service worker só é registrado em produção — em dev ele intercepta as
//    respostas do Vite e serve versão obsoleta.
//
// Uma pessoa pode ter várias assinaturas (uma por navegador/aparelho); a
// chave é o endpoint, não o usuário.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PushPermission = NotificationPermission | "unsupported";

export interface PushState {
  suportado: boolean;
  /** iPhone/iPad: só há push com o app instalado na tela inicial. */
  isIOS: boolean;
  /** App aberto instalado (standalone), não numa aba do navegador. */
  isStandalone: boolean;
  permissao: PushPermission;
  ativando: boolean;
  /** Pede permissão e inscreve. Chame a partir de um toque do usuário. */
  ativar: () => Promise<boolean>;
}

function base64UrlParaBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const normal = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = window.atob(normal);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function detectarStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const display = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return ios || display;
}

async function salvarAssinatura(userId: string, sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const chaves = json.keys as { p256dh: string; auth: string } | undefined;
  if (!chaves) return false;
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh: chaves.p256dh, auth: chaves.auth },
      { onConflict: "endpoint" },
    );
  if (error) {
    console.warn("[push] não salvou a assinatura:", error.message);
    return false;
  }
  return true;
}

export function usePushNotifications(userId: string | undefined): PushState {
  const suportado =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const isIOS =
    typeof navigator !== "undefined" &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      // iPadOS 13+ se identifica como Mac; só o touch denuncia.
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const [permissao, setPermissao] = useState<PushPermission>(
    suportado ? Notification.permission : "unsupported",
  );
  const [isStandalone, setIsStandalone] = useState(detectarStandalone);
  const [ativando, setAtivando] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => setIsStandalone(detectarStandalone()), []);

  // Cria (ou reaproveita) a assinatura e grava no banco. NÃO pede permissão:
  // assume que já foi concedida.
  const inscrever = useCallback(async (): Promise<boolean> => {
    if (!userId || !suportado) return false;
    const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!chavePublica) {
      console.warn("[push] VITE_VAPID_PUBLIC_KEY não definida");
      return false;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const existente = await reg.pushManager.getSubscription();
      const sub =
        existente ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // cast: o lib.dom desta versão do TS tipa BufferSource sem
          // Uint8Array<ArrayBufferLike>, que é o que o Node 24 produz.
          applicationServerKey: base64UrlParaBytes(chavePublica) as BufferSource,
        }));
      return salvarAssinatura(userId, sub);
    } catch (e) {
      console.warn("[push] falha ao inscrever:", (e as Error)?.message);
      return false;
    }
  }, [userId, suportado]);

  const ativar = useCallback(async (): Promise<boolean> => {
    if (!suportado || ocupado.current) return false;
    ocupado.current = true;
    setAtivando(true);
    try {
      const perm = await Notification.requestPermission();
      setPermissao(perm);
      if (perm !== "granted") return false;
      return await inscrever();
    } finally {
      setAtivando(false);
      ocupado.current = false;
    }
  }, [suportado, inscrever]);

  // Se a permissão JÁ existe, ressincroniza a assinatura em silêncio — o
  // endpoint muda sozinho de tempos em tempos e a linha antiga vira lixo.
  useEffect(() => {
    if (!userId || !suportado) return;
    if (Notification.permission !== "granted") return;
    void inscrever();
  }, [userId, suportado, inscrever]);

  return { suportado, isIOS, isStandalone, permissao, ativando, ativar };
}
