// /divulgar — gerador de posts para DIVULGAR A VEST AI.
//
// Ferramenta interna dos donos do app, não um recurso do produto: o cliente
// aqui é a lojista e o produto é o app. Não aparece no menu; o atalho fica no
// Perfil, só para quem é dono/gerente da loja da Vest Ai (ver
// @/constants/admins). O gate que conta é o da Edge Function admin-showcase.
//
// Duas formas de montar o post:
//   • Antes/depois — pega uma geração REAL já feita (a linha guarda a foto de
//     origem) e monta o post no canvas. Prova de verdade, e não gasta geração.
//   • Do zero — a IA cria uma imagem de anúncio a partir de um tema. Custa 1
//     crédito e serve para o post conceitual, quando não se quer expor foto
//     de cliente nenhuma.
//
// Os posts vão para o Instagram, quase sempre como story ou carrossel — por
// isso o story é o padrão e o carrossel tem as duas montagens que a conta usa:
// a revelação no deslize e a vitrine de vários looks.

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Megaphone, Sparkles } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ShowcaseService, type ShowcaseItem } from "@/services/ShowcaseService";
import { composeBrandCard, composePair, composeSlide, type PostFormat } from "@/lib/composePost";
import { isAppAdmin } from "@/constants/admins";
import { describeApiError } from "@/lib/apiErrors";
import { useAuth } from "@/hooks/useAuth";
import { thumbUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { SocialCopySet } from "@/types";

export const Route = createFileRoute("/divulgar")({
  head: () => ({ meta: [{ title: "Divulgar o app — Vest Ai" }] }),
  component: DivulgarPage,
});

type Aba = "par" | "zero";
type Canal = "instagram" | "whatsapp" | "facebook";
/** Montagem do carrossel: revelação no deslize, ou vitrine de vários looks. */
type Carrossel = "revela" | "looks";

const MAX_LOOKS = 5;
const CHAMADA = "Sua cliente prova a roupa sem sair de casa.";

interface Resultado {
  /** Um item = post simples. Vários = slides do carrossel, na ordem. */
  imagens: string[];
  copies: SocialCopySet;
}

function DivulgarPage() {
  const { session, loading } = useAuth();
  const [aba, setAba] = useState<Aba>("par");
  // Story primeiro: é onde a maior parte dos posts sai.
  const [formato, setFormato] = useState<PostFormat>("story");
  const [carrossel, setCarrossel] = useState<Carrossel>("revela");

  const [material, setMaterial] = useState<ShowcaseItem[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [escolhidos, setEscolhidos] = useState<ShowcaseItem[]>([]);
  const [angulo, setAngulo] = useState("");

  const [tema, setTema] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [canal, setCanal] = useState<Canal>("instagram");

  const podeVer = isAppAdmin(session);
  // Só a vitrine de looks usa vários; o resto trabalha em cima de um resultado.
  const varios = formato === "carrossel" && carrossel === "looks";
  const principal = escolhidos[0] ?? null;

  useEffect(() => {
    if (!podeVer || material || carregando) return;
    setCarregando(true);
    ShowcaseService.material()
      .then(setMaterial)
      .catch((e) => toast.error(describeApiError(e, "Não foi possível carregar o material.")))
      .finally(() => setCarregando(false));
  }, [podeVer, material, carregando]);

  // Só serve de antes/depois o que tem as DUAS pontas: a foto que entrou e o
  // resultado. Geração feita a partir de peça avulsa não tem "antes".
  const pares = useMemo(() => (material ?? []).filter((m) => !!m.clientPhotoUrl), [material]);

  if (loading) return null;
  if (!podeVer) return <Navigate to="/home" />;

  const alternar = (m: ShowcaseItem) => {
    setEscolhidos((atual) => {
      const dentro = atual.some((x) => x.id === m.id);
      if (!varios) return dentro ? [] : [m];
      if (dentro) return atual.filter((x) => x.id !== m.id);
      if (atual.length >= MAX_LOOKS) {
        toast.info(`No máximo ${MAX_LOOKS} looks por carrossel.`);
        return atual;
      }
      return [...atual, m];
    });
  };

  const montarPar = async () => {
    if (!principal?.clientPhotoUrl) return;
    setBusy(true);
    setBusyLabel("Montando as imagens…");
    try {
      let imagens: string[];
      if (formato !== "carrossel") {
        imagens = [
          await composePair({
            antesUrl: principal.clientPhotoUrl,
            depoisUrl: principal.resultUrl,
            formato,
          }),
        ];
      } else if (carrossel === "revela") {
        // O deslize É a revelação: cada foto ocupa um slide inteiro, e quem vê
        // descobre o depois no gesto. Lado a lado num slide só entregaria tudo
        // de uma vez e desperdiçaria o formato.
        imagens = [
          await composeSlide({
            url: principal.clientPhotoUrl,
            formato,
            rotulo: "ANTES",
            assinar: false,
          }),
          await composeSlide({ url: principal.resultUrl, formato, rotulo: "DEPOIS" }),
          composeBrandCard(formato, CHAMADA),
        ];
      } else {
        // Vitrine: abre com o par, para prender, e segue com um look por slide.
        const slides = [
          await composePair({
            antesUrl: principal.clientPhotoUrl,
            depoisUrl: principal.resultUrl,
            formato,
          }),
        ];
        for (const m of escolhidos.slice(1)) {
          slides.push(await composeSlide({ url: m.resultUrl, formato, assinar: false }));
        }
        slides.push(composeBrandCard(formato, CHAMADA));
        imagens = slides;
      }

      setBusyLabel("Escrevendo a legenda…");
      const copies = await ShowcaseService.copyAntesDepois(principal.resultUrl, angulo);
      setResultado({ imagens, copies });
    } catch (e) {
      toast.error(describeApiError(e, "Não foi possível montar o post."));
    } finally {
      setBusy(false);
    }
  };

  const criarDoZero = async () => {
    if (!tema.trim()) return;
    setBusy(true);
    setBusyLabel("Criando a imagem do anúncio…");
    try {
      const url = await ShowcaseService.imagemTema(tema, formato);
      // Uma imagem só é gerada mesmo no carrossel: cada imagem nova custaria
      // outro crédito. O segundo slide é o cartão da marca, montado aqui.
      const imagens =
        formato === "carrossel"
          ? [
              await composeSlide({ url, formato, assinar: false }),
              composeBrandCard(formato, CHAMADA),
            ]
          : [await composeSlide({ url, formato })];

      setBusyLabel("Escrevendo a legenda…");
      const copies = await ShowcaseService.copyTema(tema);
      setResultado({ imagens, copies });
    } catch (e) {
      toast.error(describeApiError(e, "Não foi possível criar o anúncio."));
    } finally {
      setBusy(false);
    }
  };

  if (resultado) {
    return (
      <ResultadoView
        resultado={resultado}
        canal={canal}
        setCanal={setCanal}
        onChangeTexto={(t) =>
          setResultado({ ...resultado, copies: { ...resultado.copies, [canal]: t } })
        }
        onVoltar={() => {
          setResultado(null);
          // Limpa a escolha: voltando para "fazer outro", a seleção antiga
          // ainda marcada faz o próximo clique DESMARCAR em vez de escolher,
          // e o botão fica inerte sem explicação.
          setEscolhidos([]);
        }}
      />
    );
  }

  return (
    <AppLayout title="Divulgar o app" subtitle="Só para os donos da Vest Ai">
      {busy ? <LoadingOverlay label={busyLabel} /> : null}

      <div className="space-y-5">
        <Segmentado
          valor={aba}
          onChange={setAba}
          opcoes={[
            { id: "par", label: "Antes/depois" },
            { id: "zero", label: "Do zero" },
          ]}
        />

        <div className="flex gap-2">
          {[
            { id: "story" as PostFormat, label: "Story" },
            { id: "carrossel" as PostFormat, label: "Carrossel" },
            { id: "feed" as PostFormat, label: "Feed" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFormato(f.id)}
              className={cn(
                "flex-1 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors",
                formato === f.id
                  ? "border-clay bg-clay/10 text-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {formato === "carrossel" && aba === "par" ? (
          <Segmentado
            valor={carrossel}
            onChange={(v) => {
              setCarrossel(v);
              // Trocar de montagem muda quantos resultados fazem sentido:
              // guarda só o primeiro em vez de deixar uma seleção inválida.
              setEscolhidos((atual) => atual.slice(0, 1));
            }}
            opcoes={[
              { id: "revela", label: "Revela no deslize" },
              { id: "looks", label: "Vários looks" },
            ]}
          />
        ) : null}

        {aba === "par" ? (
          <>
            <p className="text-sm text-muted-foreground">
              {varios
                ? `Escolha até ${MAX_LOOKS} resultados. O primeiro abre o carrossel como antes/depois; os outros entram como um look por slide.`
                : "Escolha um resultado real. O antes é a foto que entrou; o depois é o que o app devolveu. Montar não gasta crédito."}
            </p>

            {carregando && !material ? (
              <p className="text-sm text-muted-foreground">Carregando resultados…</p>
            ) : pares.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhuma geração com foto de origem ainda. Gere um look no Provador usando a foto de
                uma cliente e ele aparece aqui.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {pares.map((m) => {
                  const posicao = escolhidos.findIndex((x) => x.id === m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => alternar(m)}
                      className={cn(
                        "relative overflow-hidden rounded-2xl border-2 transition-all",
                        posicao >= 0
                          ? "border-clay shadow-soft"
                          : "border-transparent opacity-80 hover:opacity-100",
                      )}
                    >
                      <img
                        src={thumbUrl(m.resultUrl, { width: 220 })}
                        alt=""
                        className="aspect-[3/4] w-full object-cover object-top"
                      />
                      {posicao >= 0 && varios ? (
                        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-clay text-xs font-semibold text-clay-foreground">
                          {posicao + 1}
                        </span>
                      ) : null}
                      <span className="block truncate px-2 py-1 text-[10px] text-muted-foreground">
                        {m.ownStore ? "sua loja" : m.storeName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {escolhidos.some((m) => !m.ownStore) ? (
              <p className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground">
                Você escolheu foto de cliente de outra loja (
                {[...new Set(escolhidos.filter((m) => !m.ownStore).map((m) => m.storeName))].join(
                  ", ",
                )}
                ). Peça autorização à loja e à pessoa antes de publicar — é a imagem de alguém, não
                um material seu.
              </p>
            ) : null}

            <input
              value={angulo}
              onChange={(e) => setAngulo(e.target.value)}
              placeholder="Ângulo da legenda (opcional): ex. atender pelo WhatsApp"
              className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-clay"
            />

            <button
              onClick={montarPar}
              disabled={!principal || busy}
              className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-50"
            >
              {formato === "carrossel" ? "Montar carrossel" : "Montar post"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Descreva a cena do anúncio. A IA cria a imagem do zero — não é prova do produto, mas
              não expõe foto de cliente nenhuma. Custa 1 crédito
              {formato === "carrossel"
                ? ": o carrossel sai com essa imagem e o cartão da marca."
                : "."}
            </p>
            <textarea
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              rows={4}
              placeholder="Ex.: lojista sorrindo atrás do balcão mostrando o celular para uma cliente, arara de roupas ao fundo"
              className="w-full rounded-2xl border border-input bg-card p-4 text-sm outline-none focus:border-clay"
            />
            <button
              onClick={criarDoZero}
              disabled={!tema.trim() || busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-50"
            >
              <Sparkles className="h-5 w-5" /> Criar anúncio · 1 crédito
            </button>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Segmentado<T extends string>({
  valor,
  onChange,
  opcoes,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { id: T; label: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-1">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${opcoes.length}, 1fr)` }}>
        {opcoes.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              valor === o.id
                ? "bg-clay text-clay-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultadoView({
  resultado,
  canal,
  setCanal,
  onChangeTexto,
  onVoltar,
}: {
  resultado: Resultado;
  canal: Canal;
  setCanal: (c: Canal) => void;
  onChangeTexto: (t: string) => void;
  onVoltar: () => void;
}) {
  const { imagens, copies } = resultado;
  const legenda = [copies[canal], copies.hashtags.join(" ")].filter(Boolean).join("\n\n");
  const carrossel = imagens.length > 1;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(legenda);
      toast.success("Legenda copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  // Link direto com `download`: as imagens são data URLs montadas aqui no
  // navegador, então não há o que buscar na rede. Um clique por slide, na
  // ordem — é assim que elas entram no carrossel depois.
  const baixar = (indice?: number) => {
    const alvos = indice === undefined ? imagens.map((_, i) => i) : [indice];
    alvos.forEach((i) => {
      const a = document.createElement("a");
      a.href = imagens[i];
      a.download = carrossel
        ? `vestai-slide-${String(i + 1).padStart(2, "0")}.jpg`
        : `vestai-divulgacao-${Date.now()}.jpg`;
      a.click();
    });
    toast.success(alvos.length > 1 ? `${alvos.length} imagens salvas.` : "Imagem salva.");
  };

  return (
    <AppLayout title={carrossel ? "Carrossel pronto" : "Post pronto"}>
      <div className="space-y-5">
        {carrossel ? (
          <>
            <p className="text-sm text-muted-foreground">
              {imagens.length} slides, nesta ordem. No Instagram, envie na mesma sequência.
            </p>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
              {imagens.map((img, i) => (
                <button
                  key={i}
                  onClick={() => baixar(i)}
                  className="relative w-40 shrink-0 overflow-hidden rounded-2xl bg-card shadow-soft"
                >
                  <img src={img} alt={`slide ${i + 1}`} className="w-full" />
                  <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
            <img src={imagens[0]} alt="post de divulgação" className="w-full" />
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-1">
          <div className="grid grid-cols-3 gap-1">
            {(["instagram", "whatsapp", "facebook"] as Canal[]).map((c) => (
              <button
                key={c}
                onClick={() => setCanal(c)}
                className={cn(
                  "rounded-xl px-2 py-2 text-xs font-medium capitalize transition-colors",
                  canal === c
                    ? "bg-clay text-clay-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={copies[canal]}
          onChange={(e) => onChangeTexto(e.target.value)}
          rows={7}
          className="w-full rounded-2xl border border-input bg-card p-4 text-sm outline-none focus:border-clay"
        />

        <div className="flex flex-wrap gap-2">
          {copies.hashtags.map((h) => (
            <span
              key={h}
              className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
            >
              {h}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={copiar}
            className="flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
          >
            <Copy className="h-4 w-4" /> Copiar legenda
          </button>
          <button
            onClick={() => baixar()}
            className="flex items-center justify-center gap-2 rounded-full bg-clay px-4 py-3 text-sm font-semibold text-clay-foreground shadow-soft"
          >
            <Download className="h-4 w-4" /> {carrossel ? "Baixar todas" : "Baixar imagem"}
          </button>
        </div>

        <button
          onClick={onVoltar}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
        >
          <Megaphone className="h-4 w-4" /> Fazer outro
        </button>
      </div>
    </AppLayout>
  );
}
