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
import {
  composeCta,
  composeFoto,
  composeHook,
  composePair,
  type PostFormat,
  type PostStyle,
} from "@/lib/composePost";
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
// Fecho do carrossel, no molde da referência: pergunta curta com a palavra do
// destaque, botão em pílula e uma linha discreta embaixo.
const CTA_TITULO = "Quer ver *funcionando*?";
const CTA_BOTAO = "Saiba mais";
const CTA_RODAPE = "vestaiapp.com";

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
  // Começa ligado: o dono marca no Álbum o que presta para post, e essa é a
  // única forma de a tela saber disso — escolher pela ordem de geração punha
  // no ar resultado que ele não teria escolhido.
  const [soFavoritos, setSoFavoritos] = useState(true);
  const [titulo, setTitulo] = useState("");
  // Linha pequena acima da manchete, como na referência ("Sua cliente olha a
  // foto do catálogo e pensa:"). Opcional: só entra quando a frase precisa de
  // contexto para fazer sentido sozinha.
  const [chapeu, setChapeu] = useState("");
  const [estilo, setEstilo] = useState<PostStyle>("referencia");

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
  const comPar = useMemo(() => (material ?? []).filter((m) => !!m.clientPhotoUrl), [material]);
  const favoritos = useMemo(() => comPar.filter((m) => m.favorito), [comPar]);
  // Sem nenhum favorito ainda, mostra tudo — melhor que uma tela vazia sem
  // explicação para quem abriu antes de favoritar qualquer coisa.
  const pares = soFavoritos && favoritos.length > 0 ? favoritos : comPar;

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
            estilo,
            antesUrl: principal.clientPhotoUrl,
            depoisUrl: principal.resultUrl,
            formato,
            titulo,
            chapeu: chapeu.trim() || undefined,
          }),
        ];
      } else {
        // O carrossel ABRE com o gancho (que é o que faz parar o dedo), mostra
        // a prova no meio e FECHA com a chamada. Slide de foto sem texto não
        // entra. O gancho leva a foto da geração por trás, bem escurecida: é a
        // mesma pessoa que aparece revelada logo em seguida, então o slide 1
        // já planta quem é a história antes de a frase ser lida.
        const slides = [
          await composeHook({
            estilo,
            formato,
            titulo,
            chapeu: chapeu.trim() || undefined,
            fundoUrl: principal.resultUrl,
          }),
        ];

        if (carrossel === "revela") {
          slides.push(
            await composeFoto({
              estilo,
              url: principal.clientPhotoUrl,
              formato,
              chapeu: "A foto que a cliente mandou",
              titulo: "É só isso que você *precisa*.",
            }),
            await composeFoto({
              estilo,
              url: principal.resultUrl,
              formato,
              chapeu: "A mesma pessoa, a peça da sua loja",
              titulo: "E isso é o que ela *recebe*.",
            }),
          );
        } else {
          slides.push(
            await composePair({
              estilo,
              antesUrl: principal.clientPhotoUrl,
              depoisUrl: principal.resultUrl,
              formato,
              chapeu: "Uma foto, a peça da sua loja",
              titulo: "A mesma pessoa, *vestida*.",
            }),
          );
          const falas = [
            "Outra peça, *sem* nova foto.",
            "O catálogo inteiro *nela*.",
            "Combinações que ela *não imaginava*.",
            "E o estoque parado *girando*.",
          ];
          for (const [i, m] of escolhidos.slice(1).entries()) {
            slides.push(
              await composeFoto({
                estilo,
                url: m.resultUrl,
                formato,
                titulo: falas[i % falas.length],
              }),
            );
          }
        }

        slides.push(
          await composeCta({
            estilo,
            formato,
            titulo: CTA_TITULO,
            botao: CTA_BOTAO,
            rodape: CTA_RODAPE,
          }),
        );
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
              await composeHook({
                estilo,
                formato,
                titulo,
                chapeu: chapeu.trim() || undefined,
                fundoUrl: url,
              }),
              await composeFoto({
                estilo,
                url,
                formato,
                titulo: "É assim que a sua loja *vende* hoje.",
                ancora: 0.5,
              }),
              await composeCta({
                estilo,
                formato,
                titulo: CTA_TITULO,
                botao: CTA_BOTAO,
                rodape: CTA_RODAPE,
              }),
            ]
          : [
              await composeFoto({
                estilo,
                url,
                formato,
                titulo,
                chapeu: chapeu.trim() || undefined,
                ancora: 0.5,
              }),
            ];

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

        <Segmentado
          valor={estilo}
          onChange={setEstilo}
          opcoes={[
            { id: "referencia" as PostStyle, label: "Branco + destaque" },
            { id: "neon" as PostStyle, label: "Neon rosa" },
            { id: "neon-azul" as PostStyle, label: "Neon azul" },
          ]}
        />

        {/* Fora das abas de propósito: a manchete é a maior peça da arte nos
            dois caminhos. Ficando só na aba de antes/depois, o post "do zero"
            herdava calado o título do post anterior. */}
        <div className="space-y-1.5">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Manchete: ex. Ela não compra porque não consegue *se ver* na roupa"
            className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-clay"
          />
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            A palavra entre <span className="font-medium text-foreground">*asteriscos*</span> sai em
            maiúscula, inclinada e em rosa — é o único destaque da arte.
          </p>
        </div>

        <input
          value={chapeu}
          onChange={(e) => setChapeu(e.target.value)}
          placeholder="Linha de cima (opcional): ex. Sua cliente olha a foto e pensa:"
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-clay"
        />

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

            {favoritos.length > 0 ? (
              <label className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
                <input
                  type="checkbox"
                  checked={soFavoritos}
                  onChange={(e) => setSoFavoritos(e.target.checked)}
                  className="h-4 w-4 accent-clay"
                />
                <span className="flex-1 text-foreground">
                  Só os favoritos
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {favoritos.length} de {comPar.length} marcados com ♥ no Álbum
                  </span>
                </span>
              </label>
            ) : (
              <p className="rounded-2xl border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground">
                Marque com ♥ no Álbum os resultados que ficaram bons: a partir daí esta tela mostra
                só eles, e o post nunca sai com uma imagem escolhida no chute.
              </p>
            )}

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
