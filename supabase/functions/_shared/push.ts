// Web Push (VAPID + RFC 8291) para Edge Functions.
//
// Portado do send-push-notifications do Missao1ENEM, que já roda em produção.
// A criptografia é feita à mão com WebCrypto porque a lib `web-push` do Node
// não roda no Deno das Edge Functions.
//
// Usado para avisar "sua imagem está pronta" com o app FECHADO — a geração
// virou assíncrona (ver migration 0025) e o caso real do balcão é o lojista
// disparar e ir atender outra pessoa.

interface Assinatura {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function b64urlParaBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const normal = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normal), (c) => c.charCodeAt(0));
}

function bytesParaB64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// JWT ES256 assinado com a chave VAPID — é o que autoriza o push no serviço
// do navegador (FCM, Mozilla, WNS...).
async function montarJwtVapid(
  audiencia: string,
  assunto: string,
  publicaB64: string,
  privadaB64: string,
): Promise<string> {
  const pub = b64urlParaBytes(publicaB64);
  if (pub[0] !== 0x04) throw new Error("chave VAPID pública precisa ser uncompressed");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: bytesParaB64url(b64urlParaBytes(privadaB64)),
    x: bytesParaB64url(pub.slice(1, 33)),
    y: bytesParaB64url(pub.slice(33, 65)),
  };
  const chave = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const enc = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = enc(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const corpo = enc(JSON.stringify({ aud: audiencia, exp: agora + 43200, sub: assunto }));
  const semAssinatura = `${cabecalho}.${corpo}`;
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      chave,
      new TextEncoder().encode(semAssinatura),
    ),
  );
  return `${semAssinatura}.${bytesParaB64url(assinatura)}`;
}

// RFC 8291 (aes128gcm): o payload vai criptografado com uma chave derivada do
// ECDH entre um par efêmero nosso e a chave pública do navegador.
async function criptografar(texto: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const te = new TextEncoder();
  const clientePub = b64urlParaBytes(p256dh);
  const authSecret = b64urlParaBytes(auth);

  const parEfemero = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const servidorPub = new Uint8Array(await crypto.subtle.exportKey("raw", parEfemero.publicKey));
  const clienteKey = await crypto.subtle.importKey(
    "raw",
    clientePub,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const segredo = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clienteKey }, parEfemero.privateKey, 256),
  );

  const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number) => {
    const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8),
    );
  };

  const infoChave = new Uint8Array([
    ...te.encode("WebPush: info\0"),
    ...clientePub,
    ...servidorPub,
  ]);
  const ikm = await hkdf(segredo, authSecret, infoChave, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(ikm, salt, te.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const dados = te.encode(texto);
  const comPad = new Uint8Array(dados.length + 1);
  comPad.set(dados);
  comPad[dados.length] = 0x02; // delimitador RFC 8188

  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aes, comPad),
  );

  // Cabeçalho: salt(16) + rs(4, big-endian) + tamanho da chave(1) + chave(65)
  const cabecalho = new Uint8Array(16 + 4 + 1 + servidorPub.length);
  cabecalho.set(salt, 0);
  new DataView(cabecalho.buffer).setUint32(16, 4096, false);
  cabecalho[20] = servidorPub.length;
  cabecalho.set(servidorPub, 21);

  const saida = new Uint8Array(cabecalho.length + cifrado.length);
  saida.set(cabecalho, 0);
  saida.set(cifrado, cabecalho.length);
  return saida;
}

/**
 * Envia um push. Devolve o status HTTP do serviço de push.
 * 404/410 significam assinatura morta — quem chama deve apagá-la do banco.
 */
export async function enviarPush(
  assinatura: Assinatura,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<number> {
  const publica = Deno.env.get("VAPID_PUBLIC_KEY");
  const privada = Deno.env.get("VAPID_PRIVATE_KEY");
  const email = Deno.env.get("VAPID_EMAIL") ?? "contato@vestaiapp.com";
  if (!publica || !privada) {
    console.warn("[push] VAPID não configurado — pulando envio");
    return 500;
  }
  try {
    const url = new URL(assinatura.endpoint);
    const jwt = await montarJwtVapid(
      `${url.protocol}//${url.host}`,
      `mailto:${email}`,
      publica,
      privada,
    );
    const corpo = await criptografar(JSON.stringify(payload), assinatura.p256dh, assinatura.auth);
    const res = await fetch(assinatura.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        Authorization: `vapid t=${jwt},k=${publica}`,
        TTL: "86400",
      },
      body: corpo,
    });
    return res.status;
  } catch (e) {
    console.warn("[push] falha ao enviar:", (e as Error)?.message);
    return 500;
  }
}

/** Envia para todos os aparelhos do usuário e limpa as assinaturas mortas. */
export async function avisarUsuario(
  admin: { from: (t: string) => any },
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", userId);
  const assinaturas: Assinatura[] = data ?? [];
  if (!assinaturas.length) return;

  for (const a of assinaturas) {
    const status = await enviarPush(a, payload);
    // 404/410: o navegador descartou essa assinatura — não adianta insistir.
    if (status === 404 || status === 410) {
      await admin.from("push_subscriptions").delete().eq("endpoint", a.endpoint);
    }
  }
}
