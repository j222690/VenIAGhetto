import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, Instagram, MessageCircle, Sparkles, Trash2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { RefinePanel } from "@/components/RefinePanel";
import { AIService } from "@/services/AIService";
import { GenerationService } from "@/services/GenerationService";
import { ShareService } from "@/services/ShareService";
import { TokenService } from "@/services/TokenService";
import { PRESET_MODELS } from "@/services/PresetLibrary";
import { useTokens } from "@/hooks/useTokens";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { composeQuadrant } from "@/lib/composeQuadrant";
import {
  buildQuadrantClause,
  buildQuadrantFromScratchClause,
  buildSequentialStepClause,
  COLOR_LIGHT_INDEPENDENCE_CLAUSE,
  fitExceptionClause,
  GARMENT_FIDELITY_CLAUSE,
  POSE_LOCK_CLAUSE,
  PRESERVE_PHOTO_CLAUSE,
  REALISM_CLAUSE,
  REF_APP_ANATOMY_CLAUSE,
  REF_APP_FIDELITY_CLOSING_CLAUSE,
  REF_APP_NO_COLLAGE_CLAUSE,
  REF_APP_NO_INVENT_CLAUSE,
} from "@/constants/prompts";
import { BACKGROUNDS, FITS, LENGTHS, SIZES } from "@/constants/lookOptions";
import type { Generation, StoreSegment } from "@/types";

export const Route = createFileRoute("/posts")({
  head: () => ({ meta: [{ title: "Criador de Posts — Vest IA" }] }),
  component: PostsPage,
});

type Channel = "instagram" | "whatsapp" | "facebook";

const AUDIENCES: { id: StoreSegment; label: string }[] = [
  { id: "feminina", label: "Feminino" },
  { id: "masculina", label: "Masculino" },
  { id: "unissex", label: "Os dois" },
];

function PostsPage() {
  const { session } = useAuth();
  const { balance } = useTokens();
  const [modelUrl, setModelUrl] = useState<string | undefined>();
  const [garments, setGarments] = useState<string[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [fit, setFit] = useState<string | null>(null);
  const [length, setLength] = useState<string | null>(null);
  const [audience, setAudience] = useState<StoreSegment>(session?.store.segment ?? "feminina");
  // Independentes: dá pra mudar só o fundo, só refinar, os dois, ou nenhum.
  const [changeSceneOn, setChangeSceneOn] = useState(false);
  const [background, setBackground] = useState<string>("estudio");
  const [bgCustom, setBgCustom] = useState("");
  const [refineOn, setRefineOn] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [aiCaption, setAiCaption] = useState(true);
  const [showModels, setShowModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Criando imagem…");
  const [result, setResult] = useState<Generation | null>(null);
  const [channel, setChannel] = useState<Channel>("instagram");

  // Custo é flat: 1 geração, não importa o nº de peças (ver GenerationService.ts).
  const cost = GenerationService.postCost(garments.length);

  const addGarment = (url: string) => setGarments((g) => [...g, url]);
  const removeGarment = (i: number) => setGarments((g) => g.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (garments.length === 0 || !session) {
      toast.error("Envie ao menos uma peça/look do post.");
      return;
    }
    if (!TokenService.hasBalance(cost)) {
      toast.error("Você já usou todas as gerações do mês. Adicione mais nas Configurações.");
      return;
    }
    setBusy(true);
    try {
      // Visão (OpenAI) — descreve as peças para dar fidelidade ao look, mesma
      // etapa usada no Provador (reforço em TEXTO além das fotos reais).
      setBusyLabel("Analisando as peças…");
      let pieces = "";
      try {
        pieces = await AIService.describe(
          "Analise as imagens a seguir. Para cada peça de roupa ou calçado, escreva uma linha em " +
            "pt-BR com: tipo, cor, tecido/estilo, MODELO/CORTE (ex.: calça reta/skinny/jogger/social, " +
            "camisa slim/oversized) e DETALHES CONSTRUTIVOS visíveis (posição do fechamento/braguilha " +
            "— reto e centralizado, ou lateral, com botão ou zíper; bolsos; costuras; tipo de bainha). " +
            "Seja objetivo, sem introdução.",
          garments.slice(0, 6),
        );
      } catch {
        /* segue sem descrição se a visão falhar */
      }

      const modelDesc =
        audience === "masculina" ? "modelo masculino" : audience === "feminina" ? "modelo feminino" : "modelo";
      const piecesPart = pieces ? ` Look completo (contexto): ${pieces}.` : "";
      const specText = [
        size ? `tamanho ${size}` : "",
        fit ? FITS.find((f) => f.id === fit)?.desc : "",
        length ? LENGTHS.find((l) => l.id === length)?.desc : "",
      ]
        .filter(Boolean)
        .join(", ");
      const specPart = specText ? fitExceptionClause(specText) : "";

      setBusyLabel(
        garments.length > 1 ? "Montando o look…" : aiCaption ? "Criando imagem e legenda…" : "Criando imagem…",
      );

      // Cauda comum (fundo/refino/realismo) — igual pro passo único (1 peça
      // ou quadrante 2-4) e pro último passo do fallback sequencial (5+).
      const buildFinishPart = (hasOwnPhoto: boolean): string => {
        let part = "";
        if (hasOwnPhoto && !changeSceneOn) {
          part += " " + PRESERVE_PHOTO_CLAUSE;
        } else if (changeSceneOn) {
          const bg = BACKGROUNDS.find((b) => b.id === background);
          const scenePart =
            (bg ? ` Cenário/fundo: ${bg.desc}.` : "") + (bgCustom.trim() ? ` Detalhes do fundo: ${bgCustom.trim()}.` : "");
          part += scenePart + " " + COLOR_LIGHT_INDEPENDENCE_CLAUSE;
          if (hasOwnPhoto) part += " " + POSE_LOCK_CLAUSE;
        }
        if (refineOn && refineText.trim()) part += ` Ajustes: ${refineText.trim()}.`;
        part +=
          " Composição vibrante e atraente, pronta para publicação, alta definição. " +
          REALISM_CLAUSE +
          (hasOwnPhoto ? "" : " " + GARMENT_FIDELITY_CLAUSE);
        return part;
      };

      let currentUrl: string;
      if (garments.length <= 4) {
        const hasOwnPhoto = !!modelUrl;
        let stepPrompt: string;
        if (hasOwnPhoto) {
          stepPrompt =
            (garments.length === 1 ? buildSequentialStepClause(0) : buildQuadrantClause(garments.length)) +
            (specPart ? " " + specPart : "") +
            " " +
            REF_APP_ANATOMY_CLAUSE +
            " " +
            REF_APP_NO_COLLAGE_CLAUSE +
            " " +
            REF_APP_NO_INVENT_CLAUSE +
            piecesPart;
        } else if (garments.length === 1) {
          stepPrompt =
            `Crie uma foto de moda profissional para redes sociais de um(a) ${modelDesc} vestindo a ` +
            "peça mostrada na imagem." +
            (specPart ? " " + specPart : "") +
            piecesPart;
        } else {
          stepPrompt =
            buildQuadrantFromScratchClause(garments.length, modelDesc) +
            (specPart ? " " + specPart : "") +
            piecesPart;
        }
        stepPrompt += buildFinishPart(hasOwnPhoto) + " " + REF_APP_FIDELITY_CLOSING_CLAUSE;

        if (hasOwnPhoto) {
          if (garments.length === 1) {
            const { url } = await AIService.image(stepPrompt, { imageUrls: [modelUrl!, garments[0]] });
            currentUrl = url;
          } else {
            const composite = await composeQuadrant(garments);
            const { url } = await AIService.image(stepPrompt, {
              imageUrls: [modelUrl!],
              images: [composite],
            });
            currentUrl = url;
          }
        } else if (garments.length === 1) {
          const { url } = await AIService.image(stepPrompt, {
            imageUrls: [garments[0]],
            aspectRatio: "3:4",
          });
          currentUrl = url;
        } else {
          const composite = await composeQuadrant(garments);
          const { url } = await AIService.image(stepPrompt, {
            images: [composite],
            aspectRatio: "3:4",
          });
          currentUrl = url;
        }
      } else {
        // Fallback sequencial pra 5+ peças (fora do escopo da grade 2x2).
        let running: string | undefined = modelUrl;
        for (let i = 0; i < garments.length; i++) {
          const isFirst = i === 0;
          const isLast = i === garments.length - 1;
          setBusyLabel(`Vestindo peça ${i + 1} de ${garments.length}…`);
          let stepPrompt: string;
          let imgs: string[];
          let stepAspectRatio: string | undefined;
          if (running) {
            stepPrompt =
              buildSequentialStepClause(isFirst ? 0 : 1) +
              (specPart ? " " + specPart : "") +
              " " +
              REF_APP_ANATOMY_CLAUSE +
              " " +
              REF_APP_NO_COLLAGE_CLAUSE +
              " " +
              REF_APP_NO_INVENT_CLAUSE +
              piecesPart;
            imgs = [running, garments[i]];
          } else {
            stepPrompt =
              `Crie uma foto de moda profissional para redes sociais de um(a) ${modelDesc} vestindo a ` +
              "peça mostrada na imagem." +
              (specPart ? " " + specPart : "") +
              piecesPart;
            imgs = [garments[i]];
            stepAspectRatio = "3:4";
          }
          stepPrompt += isLast ? buildFinishPart(!!running) : running ? " " + PRESERVE_PHOTO_CLAUSE : "";
          stepPrompt += " " + REF_APP_FIDELITY_CLOSING_CLAUSE;
          const { url } = await AIService.image(stepPrompt, { imageUrls: imgs, aspectRatio: stepAspectRatio });
          running = url;
        }
        currentUrl = running!;
      }

      const gen = await GenerationService.generate({
        type: "post",
        inputs: {
          clientPhotoUrl: modelUrl,
          notes: (refineOn ? refineText.trim() : "") || bgCustom.trim() || undefined,
        },
        resultUrl: currentUrl,
        audience,
        withCopy: aiCaption,
        tokenCost: cost,
        userId: session.user.id,
        storeId: session.store.id,
      });
      setResult(gen);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o post.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const copies = result.copies;
    const text = copies ? copies[channel] : "";
    const hashtags = copies ? copies.hashtags.join(" ") : "";
    const caption = [text, hashtags].filter(Boolean).join("\n\n");
    const filename = ShareService.lookFilename(result.resultUrl, { createdAt: result.createdAt });

    const copyText = () => {
      navigator.clipboard.writeText(caption);
      toast.success("Legenda copiada.");
    };
    const downloadImg = async () => {
      try {
        await ShareService.downloadImage(result.resultUrl, filename);
        toast.success("Imagem salva no aparelho.");
      } catch {
        toast.error("Não foi possível baixar a imagem.");
      }
    };
    const postInstagram = async () => {
      if (caption) {
        try {
          await navigator.clipboard.writeText(caption);
        } catch {
          /* ok */
        }
      }
      const r = await ShareService.shareToInstagram(result.resultUrl, filename);
      toast.success(
        r === "shared"
          ? "Escolha o Instagram para publicar." + (caption ? " Legenda copiada." : "")
          : "Imagem baixada e Instagram aberto." + (caption ? " Legenda copiada: é só colar." : ""),
      );
    };
    const shareWhatsapp = async () => {
      await ShareService.shareToWhatsApp(result.resultUrl, caption, filename);
    };

    return (
      <AppLayout title="Seu post">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
            <img src={result.resultUrl} alt="post" className="w-full" />
          </div>

          <RefinePanel
            imageUrl={result.resultUrl}
            onRefined={(url) => setResult({ ...result, resultUrl: url })}
          />

          {copies ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-1">
                <div className="grid grid-cols-3 gap-1">
                  {(["instagram", "whatsapp", "facebook"] as Channel[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={cn(
                        "rounded-xl px-2 py-2 text-xs font-medium capitalize transition-colors",
                        channel === c
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
                value={text}
                onChange={(e) =>
                  setResult({ ...result, copies: { ...copies, [channel]: e.target.value } })
                }
                rows={6}
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
            </>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
              Post sem legenda por IA. Baixe ou compartilhe a imagem.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={postInstagram}
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(90deg, #F58529, #DD2A7B 55%, #8134AF 90%, #515BD4)" }}
            >
              <Instagram className="h-4 w-4" /> Instagram
            </button>
            <button
              onClick={shareWhatsapp}
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
              style={{ background: "#25D366" }}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
          </div>

          <div className={cn("grid gap-2", copies ? "grid-cols-2" : "grid-cols-1")}>
            <ResultAction icon={Download} label="Baixar imagem" onClick={downloadImg} />
            {copies ? <ResultAction icon={Copy} label="Copiar legenda" onClick={copyText} /> : null}
          </div>

          <button
            onClick={() => setResult(null)}
            className="w-full rounded-full bg-clay px-6 py-3.5 text-sm font-semibold text-clay-foreground"
          >
            Novo post
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Criador de Posts" subtitle="Imagem + copy em segundos">
      <div className="space-y-6">
        <div>
          <ImageUploadField
            bucket="clients"
            value={modelUrl}
            onChange={setModelUrl}
            label="Modelo"
            hint="Opcional · sua foto"
            aspectClassName="aspect-square"
            fit="contain"
          />
          <button
            onClick={() => setShowModels(true)}
            className="mt-1.5 w-full text-center text-[11px] font-medium text-clay"
          >
            usar modelo do banco
          </button>
        </div>

        {/* Peças do look — uma ou várias (fotos separadas viram um look só) */}
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Peças do look</p>
            <p className="text-xs text-muted-foreground">
              Envie 1 peça, ou várias fotos separadas — a IA junta tudo no mesmo look.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {garments.map((url, i) => (
              <div key={url} className="relative overflow-hidden rounded-2xl border border-border">
                <img src={url} alt={`Peça ${i + 1}`} className="aspect-square w-full object-cover" />
                <button
                  onClick={() => removeGarment(i)}
                  aria-label="Remover peça"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/85 text-foreground shadow-soft backdrop-blur"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <ImageUploadField
              bucket="catalog"
              onChange={addGarment}
              label={garments.length ? "Adicionar" : "Adicionar peça"}
              hint="Galeria/câmera"
              aspectClassName="aspect-square"
            />
          </div>
        </section>

        {/* Tamanho, caimento e comprimento — opcionais, ajustam o look gerado */}
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Tamanho e caimento</p>
            <p className="text-xs text-muted-foreground">Opcional — ajusta o corte do look gerado.</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tamanho
            </p>
            <div className="flex flex-wrap gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize((cur) => (cur === s ? null : s))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    size === s
                      ? "border-accent bg-accent text-accent-foreground shadow-glow"
                      : "border-border bg-card text-foreground hover:border-accent/50",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Caimento
            </p>
            <div className="flex flex-wrap gap-2">
              {FITS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFit((cur) => (cur === f.id ? null : f.id))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    fit === f.id
                      ? "border-accent bg-accent text-accent-foreground shadow-glow"
                      : "border-border bg-card text-foreground hover:border-accent/50",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Comprimento (barra da peça — não a manga)
            </p>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLength((cur) => (cur === l.id ? null : l.id))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    length === l.id
                      ? "border-accent bg-accent text-accent-foreground shadow-glow"
                      : "border-border bg-card text-foreground hover:border-accent/50",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Liga/desliga INDEPENDENTES: mudar fundo e refinar não dependem um do outro */}
        <button
          onClick={() => setChangeSceneOn((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Mudar fundo/cenário</span>
            <span className="block text-xs text-muted-foreground">
              Desligue se a imagem gerada já basta.
            </span>
          </span>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              changeSceneOn ? "bg-clay" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                changeSceneOn ? "left-[22px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        {changeSceneOn ? (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Fundo / cenário</p>
            <div className="grid grid-cols-4 gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBackground(b.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 transition",
                    background === b.id
                      ? "border-2 border-accent bg-card shadow-glow"
                      : "border-border bg-card hover:border-accent/50",
                  )}
                >
                  <span className="text-lg">{b.emoji}</span>
                  <span className="text-[10px] font-medium text-foreground">{b.label}</span>
                </button>
              ))}
            </div>
            <input
              value={bgCustom}
              onChange={(e) => setBgCustom(e.target.value)}
              placeholder="Descreva outro fundo (opcional)…"
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
            />
          </section>
        ) : null}

        <button
          onClick={() => setRefineOn((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Refinar imagem</span>
            <span className="block text-xs text-muted-foreground">
              Ajustes extras, ex.: melhorar a luz, deixar mais vibrante.
            </span>
          </span>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              refineOn ? "bg-clay" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                refineOn ? "left-[22px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        {refineOn ? (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-clay" />
              <p className="text-sm font-semibold text-foreground">Refinar imagem (opcional)</p>
            </div>
            <input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Ex.: melhorar a luz, remover o fundo, deixar mais vibrante…"
              className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
            />
          </section>
        ) : null}

        {/* Público (dá contexto à legenda) */}
        <div className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Público
          </span>
          <div className="rounded-2xl border border-border bg-card p-1">
            <div className="grid grid-cols-3 gap-1">
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAudience(a.id)}
                  className={cn(
                    "rounded-xl px-2 py-2 text-xs font-medium transition-colors",
                    audience === a.id
                      ? "bg-clay text-clay-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legenda por IA on/off */}
        <button
          onClick={() => setAiCaption((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Legenda por IA</span>
            <span className="block text-xs text-muted-foreground">
              A IA olha a imagem gerada e escreve a legenda.
            </span>
          </span>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              aiCaption ? "bg-clay" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                aiCaption ? "left-[22px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        <button
          onClick={generate}
          disabled={busy || garments.length === 0}
          className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          Gerar post · {Math.floor(balance / cost)} gerações restantes
        </button>
      </div>

      {showModels ? (
        <ModelBankSheet
          onClose={() => setShowModels(false)}
          onSelect={(url) => {
            setModelUrl(url);
            setShowModels(false);
          }}
        />
      ) : null}

      {busy ? <LoadingOverlay label={busyLabel} /> : null}
    </AppLayout>
  );
}

function ResultAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-3 text-xs font-medium"
    >
      <Icon className="h-4 w-4 text-clay" />
      {label}
    </button>
  );
}

// Banco de modelos prontos — para lojas sem fotos próprias.
function ModelBankSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid items-end justify-items-center bg-foreground/30 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Banco de modelos</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">
            Cancelar
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Modelos prontos para usar quando você não tem fotos próprias.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {PRESET_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.url)}
              className="overflow-hidden rounded-xl border border-border"
            >
              <img src={m.url} alt={m.label} className="aspect-[3/4] w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
