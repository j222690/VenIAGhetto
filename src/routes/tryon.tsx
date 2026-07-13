import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookImage, RotateCw, Sparkles, Trash2, Users } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { LookActions } from "@/components/LookActions";
import { RefinePanel } from "@/components/RefinePanel";
import { AIService } from "@/services/AIService";
import { CatalogService } from "@/services/CatalogService";
import { ClientService } from "@/services/ClientService";
import { GenerationService } from "@/services/GenerationService";
import { TokenService } from "@/services/TokenService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Client, Generation } from "@/types";
import {
  GARMENT_FIDELITY_CLAUSE,
  PRESERVE_PHOTO_CLAUSE,
  REALISM_CLAUSE,
} from "@/constants/prompts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tryon")({
  head: () => ({ meta: [{ title: "Provador — Vest IA" }] }),
  component: TryOnPage,
});

type Sheet = "client" | "item" | null;

// Cenários por ocasião — o look combina com o momento do cliente.
const BACKGROUNDS: { id: string; label: string; emoji: string; desc: string }[] = [
  { id: "praia", label: "Praia", emoji: "🏖️", desc: "em uma praia ensolarada, mar e areia ao fundo, luz natural quente" },
  { id: "estudio", label: "Estúdio", emoji: "📸", desc: "fundo de estúdio neutro e limpo, iluminação editorial de moda" },
  { id: "urbano", label: "Urbano", emoji: "🏙️", desc: "em uma rua urbana moderna, arquitetura ao fundo, luz de fim de tarde" },
  { id: "festa", label: "Festa", emoji: "🎉", desc: "em um ambiente de festa noturna com luzes coloridas e clima vibrante" },
  { id: "natureza", label: "Natureza", emoji: "🌳", desc: "em um parque verde ao ar livre, vegetação e luz do dia" },
  { id: "trabalho", label: "Trabalho", emoji: "💼", desc: "em um escritório corporativo elegante e bem iluminado" },
  { id: "casamento", label: "Evento", emoji: "🥂", desc: "em um evento formal sofisticado, ambiente elegante" },
  { id: "cafe", label: "Café", emoji: "☕", desc: "em um café aconchegante, ambiente casual e acolhedor" },
];

// Retoques de IA — presets prontos + campo livre.
const RETOUCHES: { id: string; label: string; instruction: string }[] = [
  { id: "amassados", label: "Tirar amassados", instruction: "remova amassados e vincos da roupa deixando o tecido liso" },
  { id: "tatuagens", label: "Remover tatuagens", instruction: "remova tatuagens visíveis da pele do modelo" },
  { id: "pele", label: "Suavizar pele", instruction: "suavize a pele de forma natural, sem exagero" },
  { id: "luz", label: "Melhorar luz", instruction: "melhore a iluminação e o equilíbrio de cores da foto" },
  { id: "fundo", label: "Limpar fundo", instruction: "remova elementos que distraem do fundo" },
  { id: "caimento", label: "Ajustar caimento", instruction: "melhore o caimento e o ajuste da roupa no corpo" },
];

function TryOnPage() {
  const { session } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [garments, setGarments] = useState<string[]>([]);
  const [sceneOn, setSceneOn] = useState(true);
  const [background, setBackground] = useState<string>("estudio");
  const [bgCustom, setBgCustom] = useState("");
  const [retouches, setRetouches] = useState<string[]>([]);
  const [retouchCustom, setRetouchCustom] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Gerando…");
  const [result, setResult] = useState<Generation | null>(null);

  useEffect(() => {
    void ClientService.load().catch(() => {});
    void CatalogService.load().catch(() => {});
  }, []);

  // Custo varia: 1 peça = 5 tokens; várias peças (flat-lay + vestir) = 8.
  const cost = GenerationService.tryonCost(garments.length);

  const addGarment = (url: string) => setGarments((g) => [...g, url]);
  const removeGarment = (i: number) => setGarments((g) => g.filter((_, idx) => idx !== i));
  const toggleRetouch = (id: string) =>
    setRetouches((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const run = async () => {
    if (!photoUrl) {
      toast.error("Envie a foto do cliente.");
      return;
    }
    if (garments.length === 0 || !session) {
      toast.error("Envie ao menos uma peça de roupa.");
      return;
    }
    if (!TokenService.hasBalance(cost)) {
      toast.error("Saldo de tokens insuficiente. Adicione tokens nas Configurações.");
      return;
    }
    setBusy(true);
    try {
      // 1) Visão (OpenAI) — descreve as peças para dar fidelidade ao look.
      setBusyLabel("Analisando as peças…");
      let pieces = "";
      try {
        pieces = await AIService.describe(
          "Analise as imagens a seguir. Para cada peça de roupa ou calçado, escreva uma linha " +
            "em pt-BR com tipo, cor e tecido/estilo. Seja objetivo, sem introdução.",
          garments.slice(0, 6),
        );
      } catch {
        /* segue sem descrição se a visão falhar */
      }

      // 2) Se há VÁRIAS peças separadas, monta um FLAT-LAY único (passo interno,
      //    sem persistir/gastar token) para depois vestir o cliente UMA vez —
      //    evita gerar o cliente peça por peça.
      let lookImages = garments;
      if (garments.length >= 2) {
        setBusyLabel("Montando o look…");
        try {
          const flat = await AIService.image(
            "Crie uma imagem de moda no estilo FLAT-LAY (vista de cima), com TODAS as peças a " +
              "seguir organizadas lado a lado de forma harmônica sobre um fundo liso e claro, como " +
              "um catálogo de moda. NÃO inclua pessoas." +
              (pieces ? ` Peças: ${pieces}.` : "") +
              " " +
              GARMENT_FIDELITY_CLAUSE,
            { imageUrls: garments },
          );
          lookImages = [flat.url]; // usa o flat-lay como referência única do look
        } catch {
          lookImages = garments; // fallback: manda as peças direto
        }
      }

      // 3) Veste o look no cliente/modelo (uma única geração persistida).
      setBusyLabel("Vestindo o look…");
      const head =
        "Vista a PESSOA da PRIMEIRA imagem com o LOOK COMPLETO mostrado na(s) imagem(ns) " +
        "seguinte(s). Preserve fielmente o rosto, o corpo, o tom de pele e a identidade da pessoa.";

      const piecesPart = pieces ? ` Peças: ${pieces}.` : "";
      const base = head + " Vista todas as peças juntas em um único look coerente, corpo inteiro." + piecesPart;

      let prompt: string;
      if (sceneOn) {
        // Com cenário/retoques: pode mudar o fundo, mas nunca as peças.
        const retouchList = RETOUCHES.filter((r) => retouches.includes(r.id)).map((r) => r.instruction);
        const retouchTxt = [...retouchList, retouchCustom.trim()].filter(Boolean).join("; ");
        const bg = BACKGROUNDS.find((b) => b.id === background);
        const scenePart =
          (bg ? ` Cenário: ${bg.desc}.` : "") +
          (bgCustom.trim() ? ` Detalhes do cenário: ${bgCustom.trim()}.` : "") +
          (retouchTxt ? ` Retoques: ${retouchTxt}.` : "");
        prompt = base + scenePart + " " + REALISM_CLAUSE + " " + GARMENT_FIDELITY_CLAUSE;
      } else {
        // Sem mudança de cenário/refino: preserva a foto original, troca só o look.
        prompt = base + " " + PRESERVE_PHOTO_CLAUSE + " " + GARMENT_FIDELITY_CLAUSE;
      }
      const imageUrls = photoUrl ? [photoUrl, ...lookImages] : lookImages;

      const gen = await GenerationService.generate({
        type: "tryon",
        inputs: {
          clientPhotoUrl: photoUrl,
          notes: `${background} ${bgCustom} ${retouchCustom}`.trim(),
        },
        prompt,
        imageUrls,
        tokenCost: cost,
        userId: session.user.id,
        storeId: session.store.id,
        clientId: client?.id,
      });
      setResult(gen);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o look.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <AppLayout title="Resultado">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
            <img src={result.resultUrl} alt="Resultado do provador" className="w-full" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">Look gerado</p>
                <p className="truncate text-xs text-muted-foreground">
                  {client ? `Para ${client.name}` : "Sem cliente associado"} · {cost} tokens
                </p>
              </div>
              <LookActions look={result} actions={["favorite", "download", "instagram", "whatsapp"]} />
            </div>
          </div>

          <RefinePanel
            imageUrl={result.resultUrl}
            onRefined={(url) => setResult({ ...result, resultUrl: url })}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={run}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground disabled:opacity-60"
            >
              <RotateCw className="h-4 w-4 text-clay" /> Regenerar
            </button>
            <button
              onClick={() => setResult(null)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-clay-foreground"
            >
              Novo look
            </button>
          </div>

          {client ? (
            <Link
              to="/clients"
              search={{ client: client.id }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground"
            >
              <BookImage className="h-4 w-4 text-clay" /> Ver pasta de {client.name}
            </Link>
          ) : null}
        </div>
        {busy ? <LoadingOverlay label={busyLabel} /> : null}
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Provador" subtitle="Monte o look, escolha a ocasião e vista no cliente">
      <div className="space-y-6">
        <button
          onClick={() => setSheet("client")}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
        >
          <span className="flex items-center gap-3">
            <Users className="h-5 w-5 text-clay" />
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Cliente
              </span>
              <span className="block truncate font-medium text-foreground">
                {client ? client.name : "Selecionar (opcional)"}
              </span>
            </span>
          </span>
          <span className="text-sm text-clay">{client ? "Trocar" : "Escolher"}</span>
        </button>

        {/* Peças do look — uma ou várias (fotos separadas viram um look) */}
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
          <button
            onClick={() => setSheet("item")}
            className="w-full text-center text-[11px] font-medium text-clay"
          >
            ou escolher do catálogo
          </button>
        </section>

        {garments.length >= 2 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
            ✨ Várias peças: a IA junta tudo em um look só e veste no cliente de uma vez.
          </p>
        ) : null}

        <div>
          <ImageUploadField
            bucket="clients"
            value={photoUrl}
            onChange={setPhotoUrl}
            label="Foto do cliente"
            hint="Obrigatória · galeria ou câmera"
            aspectClassName="aspect-[4/3]"
          />
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            A peça será vestida nesta pessoa.
          </p>
        </div>

        {/* Liga/desliga: mudar fundo e refinar (às vezes a foto já está boa) */}
        <button
          onClick={() => setSceneOn((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Mudar fundo e refinar</span>
            <span className="block text-xs text-muted-foreground">
              Desligue se a foto original já está do jeito que quer.
            </span>
          </span>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              sceneOn ? "bg-clay" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                sceneOn ? "left-[22px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        {sceneOn ? (
        <>
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Ocasião / cenário</p>
            <p className="text-xs text-muted-foreground">
              Onde o cliente vai usar? O fundo combina com o momento.
            </p>
          </div>
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
            placeholder="Descreva outro cenário (opcional)…"
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-clay" />
            <p className="text-sm font-semibold text-foreground">Retoques com IA</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RETOUCHES.map((r) => (
              <button
                key={r.id}
                onClick={() => toggleRetouch(r.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  retouches.includes(r.id)
                    ? "border-accent bg-accent text-accent-foreground shadow-glow"
                    : "border-border bg-card text-foreground hover:border-accent/50",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <input
            value={retouchCustom}
            onChange={(e) => setRetouchCustom(e.target.value)}
            placeholder="Escreva o que quer mudar (ex.: trocar a cor da bolsa)…"
            className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
          />
        </section>
        </>
        ) : null}

        <button
          onClick={run}
          disabled={garments.length === 0 || !photoUrl}
          className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          Gerar look · {cost} tokens
        </button>
      </div>

      {sheet === "client" ? (
        <ClientSheet
          onClose={() => setSheet(null)}
          onSelect={(c) => {
            setClient(c);
            setSheet(null);
          }}
        />
      ) : null}

      {sheet === "item" ? (
        <CatalogSheet
          onClose={() => setSheet(null)}
          onSelect={(url) => {
            addGarment(url);
            setSheet(null);
          }}
        />
      ) : null}

      {busy ? <LoadingOverlay label={busyLabel} /> : null}
    </AppLayout>
  );
}

// --- Bottom sheets -----------------------------------------------------------

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/30 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">
            Cancelar
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function ClientSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (c: Client | null) => void;
}) {
  const clients = ClientService.list();
  return (
    <SheetShell title="Escolher cliente" onClose={onClose}>
      <button
        onClick={() => onSelect(null)}
        className="mb-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium"
      >
        Seguir sem cliente
      </button>
      {clients.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum cliente.{" "}
          <Link to="/clients" className="text-clay" onClick={onClose}>
            Cadastrar
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
                {c.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{c.name}</span>
                {c.phone ? (
                  <span className="block truncate text-xs text-muted-foreground">{c.phone}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </SheetShell>
  );
}

function CatalogSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const items = CatalogService.listActive().filter((it) => it.imageUrl);
  return (
    <SheetShell title="Escolher peça do catálogo" onClose={onClose}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Catálogo vazio.{" "}
          <Link to="/catalog" className="text-clay" onClick={onClose}>
            Cadastrar peça
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => onSelect(it.imageUrl!)}
              className="overflow-hidden rounded-xl border border-border text-left"
            >
              <div className="aspect-square w-full overflow-hidden bg-secondary">
                <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
              </div>
              <p className="truncate px-1.5 py-1 text-[11px] font-medium text-foreground">
                {it.name}
              </p>
            </button>
          ))}
        </div>
      )}
    </SheetShell>
  );
}
