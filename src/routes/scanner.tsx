import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Save } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { EmptyImagePicker } from "@/components/EmptyImagePicker";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AssetService } from "@/services/AssetService";
import { ProductService } from "@/services/ProductService";
import { GenerationService } from "@/services/GenerationService";
import { TokenService } from "@/services/TokenService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { ProductSheet } from "@/types";

export const Route = createFileRoute("/scanner")({
  head: () => ({ meta: [{ title: "Scanner de peças — StyleDesk" }] }),
  component: ScannerPage,
});

function ScannerPage() {
  const { session } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<ProductSheet | null>(null);

  const pick = () => {
    const a = AssetService.list("look")[0];
    setImageUrl(a?.url);
  };

  const scan = async () => {
    if (!imageUrl || !session) {
      toast.error("Selecione uma foto da peça.");
      return;
    }
    const cost = GenerationService.costFor("scanner");
    if (!TokenService.hasBalance(cost)) {
      toast.error("Saldo de tokens insuficiente. Adicione tokens nas Configurações.");
      return;
    }
    setBusy(true);
    try {
      // Debita token e grava a geração (resultado = a própria peça analisada).
      await GenerationService.generate({
        type: "scanner",
        inputs: {},
        userId: session.user.id,
        storeId: session.store.id,
        resultUrl: imageUrl,
      });
      // TEMPORÁRIO: ficha vem de placeholder (_temp via ProductService) até a IA.
      const s = await ProductService.scan(imageUrl);
      setSheet(s);
    } catch {
      toast.error("Não foi possível analisar a peça.");
    } finally {
      setBusy(false);
    }
  };

  if (sheet) {
    return (
      <AppLayout title="Ficha da peça">
        <div className="space-y-5">
          <img src={sheet.sourceImageUrl} alt={sheet.name} className="w-full rounded-3xl" />
          <SheetField label="Nome" value={sheet.name} onChange={(v) => setSheet({ ...sheet, name: v })} />
          <SheetField label="Categoria" value={sheet.category} onChange={(v) => setSheet({ ...sheet, category: v })} />
          <SheetField label="Tecido" value={sheet.fabric} onChange={(v) => setSheet({ ...sheet, fabric: v })} />
          <SheetField label="Estilo" value={sheet.style} onChange={(v) => setSheet({ ...sheet, style: v })} />
          <SheetField label="Ocasião" value={sheet.occasion} onChange={(v) => setSheet({ ...sheet, occasion: v })} />
          <SheetField
            label="Preço sugerido (R$)"
            value={String(sheet.suggestedPriceBRL)}
            onChange={(v) => setSheet({ ...sheet, suggestedPriceBRL: Number(v) || 0 })}
          />
          <SheetField label="Cores" value={sheet.colors.join(", ")} onChange={(v) => setSheet({ ...sheet, colors: v.split(",").map((s) => s.trim()) })} />
          <SheetField label="Tamanhos" value={sheet.sizes.join(", ")} onChange={(v) => setSheet({ ...sheet, sizes: v.split(",").map((s) => s.trim()) })} />
          <SheetField label="Tags" value={sheet.tags.join(", ")} onChange={(v) => setSheet({ ...sheet, tags: v.split(",").map((s) => s.trim()) })} />
          <SheetField label="Título SEO" value={sheet.seoTitle} onChange={(v) => setSheet({ ...sheet, seoTitle: v })} />
          <SheetArea
            label="Descrição curta"
            value={sheet.shortDescription}
            onChange={(v) => setSheet({ ...sheet, shortDescription: v })}
          />
          <SheetArea
            label="Descrição longa"
            value={sheet.longDescription}
            onChange={(v) => setSheet({ ...sheet, longDescription: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(sheet, null, 2));
                toast.success("Ficha copiada.");
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium"
            >
              <Copy className="h-4 w-4 text-clay" /> Copiar
            </button>
            <button
              onClick={() => toast.success("Salvo no acervo.")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-clay px-4 py-3 text-sm font-semibold text-clay-foreground"
            >
              <Save className="h-4 w-4" /> Salvar
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Scanner" subtitle="Ficha completa em segundos">
      <div className="space-y-5">
        <EmptyImagePicker
          label="Foto da peça"
          hint="Use boa luz e fundo neutro"
          imageUrl={imageUrl}
          onClick={pick}
        />
        <button
          onClick={scan}
          disabled={!imageUrl}
          className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-60"
        >
          Analisar peça · 1 token
        </button>
      </div>
      {busy ? <LoadingOverlay label="Lendo cada detalhe da peça…" /> : null}
    </AppLayout>
  );
}

function SheetField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
      />
    </label>
  );
}

function SheetArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-clay"
      />
    </label>
  );
}
