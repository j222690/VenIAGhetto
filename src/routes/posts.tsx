import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Download, Share2 } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { EmptyImagePicker } from "@/components/EmptyImagePicker";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AssetService } from "@/services/AssetService";
import { GenerationService } from "@/services/GenerationService";
import { TokenService } from "@/services/TokenService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Asset, Generation } from "@/types";

export const Route = createFileRoute("/posts")({
  head: () => ({ meta: [{ title: "Criador de Posts — StyleDesk" }] }),
  component: PostsPage,
});

type Channel = "instagram" | "whatsapp" | "facebook";

function PostsPage() {
  const { session } = useAuth();
  const [picker, setPicker] = useState<"model" | "look" | null>(null);
  const [model, setModel] = useState<Asset | undefined>();
  const [look, setLook] = useState<Asset | undefined>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);
  const [channel, setChannel] = useState<Channel>("instagram");

  const generate = async () => {
    if (!model || !look || !session) {
      toast.error("Selecione modelo e peça.");
      return;
    }
    if (!TokenService.hasBalance(GenerationService.costFor("post"))) {
      toast.error("Saldo de tokens insuficiente. Adicione tokens nas Configurações.");
      return;
    }
    setBusy(true);
    try {
      const gen = await GenerationService.generate({
        type: "post",
        inputs: { modelAssetId: model.id, lookAssetId: look.id },
        userId: session.user.id,
        storeId: session.store.id,
      });
      setResult(gen);
    } catch {
      toast.error("Não foi possível gerar o post.");
    } finally {
      setBusy(false);
    }
  };

  if (result && result.copies) {
    const text = result.copies[channel];
    return (
      <AppLayout title="Seu post">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
            <img src={result.resultUrl} alt="post" className="w-full" />
          </div>

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
              setResult({
                ...result,
                copies: { ...result.copies!, [channel]: e.target.value },
              })
            }
            rows={6}
            className="w-full rounded-2xl border border-input bg-card p-4 text-sm outline-none focus:border-clay"
          />

          <div className="flex flex-wrap gap-2">
            {result.copies.hashtags.map((h) => (
              <span
                key={h}
                className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
              >
                {h}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ResultAction
              icon={Copy}
              label="Copiar"
              onClick={() => {
                navigator.clipboard.writeText(text);
                toast.success("Texto copiado.");
              }}
            />
            <ResultAction icon={Download} label="Baixar" onClick={() => toast.success("Baixando…")} />
            <ResultAction icon={Share2} label="Compartilhar" onClick={() => toast.success("Compartilhar…")} />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Criador de Posts" subtitle="Imagem + copy em segundos">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <EmptyImagePicker
            label="Modelo"
            imageUrl={model?.url}
            onClick={() => setPicker("model")}
          />
          <EmptyImagePicker
            label="Look / Peça"
            imageUrl={look?.url}
            onClick={() => setPicker("look")}
          />
        </div>
        <button
          onClick={generate}
          disabled={!model || !look}
          className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          Gerar post · {GenerationService.costFor("post")} tokens
        </button>
      </div>
      {picker ? (
        <AssetPicker
          category={picker === "model" ? "model" : "look"}
          onClose={() => setPicker(null)}
          onSelect={(a) => {
            if (picker === "model") setModel(a);
            else setLook(a);
            setPicker(null);
          }}
        />
      ) : null}
      {busy ? <LoadingOverlay label="Criando imagem e copy…" /> : null}
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

function AssetPicker({
  category,
  onClose,
  onSelect,
}: {
  category: Asset["category"];
  onClose: () => void;
  onSelect: (a: Asset) => void;
}) {
  const items = AssetService.list(category);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            Escolher {category === "model" ? "modelo" : "peça"}
          </h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">
            Cancelar
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className="overflow-hidden rounded-xl border border-border"
            >
              <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
