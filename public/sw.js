// Service Worker do Vest Ai.
//
// Existe por UM motivo: entregar o aviso de "sua imagem está pronta" com o app
// FECHADO. A geração passou a rodar em segundo plano no servidor (ver
// migration 0025), e o caso real do balcão é o lojista disparar a geração e ir
// atender outra pessoa — muitas vezes fechando o app. A Notification API
// sozinha não cobre isso; só Web Push cobre.
//
// De propósito NÃO faz cache de nada. Um SW que cacheia exige estratégia de
// invalidação e costuma servir versão velha do app depois de um deploy — custo
// alto para um ganho que aqui não é necessário.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = { title: "Vest Ai", body: "Sua imagem está pronta!", url: "/album" };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Substitui um aviso anterior em vez de empilhar vários.
      tag: payload.tag ?? "vestai-geracao",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alvo = event.notification.data?.url ?? "/album";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // Já tem o app aberto? foca e navega, em vez de abrir outra janela.
      for (const janela of janelas) {
        if (janela.url.includes(self.location.origin) && "focus" in janela) {
          janela.focus();
          if ("navigate" in janela) janela.navigate(alvo);
          return;
        }
      }
      return self.clients.openWindow(alvo);
    }),
  );
});
