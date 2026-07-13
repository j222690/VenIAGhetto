import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookImage, RotateCw, Users } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { EmptyImagePicker } from "@/components/EmptyImagePicker";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { LookActions } from "@/components/LookActions";
import { CatalogService } from "@/services/CatalogService";
import { ClientService } from "@/services/ClientService";
import { GenerationService } from "@/services/GenerationService";
import { TokenService } from "@/services/TokenService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { CatalogItem, Client, Generation } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tryon")({
  head: () => ({ meta: [{ title: "Provador — StyleDesk" }] }),
  component: TryOnPage,
});

type Sheet = "client" | "photo" | "item" | null;

function TryOnPage() {
  const { session } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [item, setItem] = useState<CatalogItem | undefined>();
  const [gender, setGender] = useState<"female" | "male">("female");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Generation | null>(null);

  // Carrega clientes e catálogo para os seletores.
  useEffect(() => {
    void ClientService.load().catch(() => {});
    void CatalogService.load().catch(() => {});
  }, []);

  const cost = GenerationService.costFor("tryon");

  const run = async () => {
    if (!item || !session) {
      toast.error("Escolha uma peça do catálogo.");
      return;
    }
    if (!TokenService.hasBalance(cost)) {
      toast.error("Saldo de tokens insuficiente. Adicione tokens nas Configurações.");
      return;
    }
    setBusy(true);
    try {
      const gen = await GenerationService.generate({
        type: "tryon",
        inputs: { catalogItemId: item.id, clientPhotoUrl: photoUrl, modelGender: gender },
        userId: session.user.id,
        storeId: session.store.id,
        clientId: client?.id,
      });
      setResult(gen);
    } catch {
      toast.error("Não foi possível gerar o look.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <AppLayout title="Resultado">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
            <div className="relative">
              <img src={result.resultUrl} alt="Resultado do provador" className="w-full" />
              {/* TEMPORÁRIO: imagem de exemplo enquanto a IA não está integrada. */}
              <span className="absolute left-3 top-3 rounded-full bg-foreground/70 px-3 py-1 text-[11px] font-medium text-background">
                Imagem de exemplo (provisória)
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item?.name ?? "Look gerado"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {client ? `Para ${client.name}` : "Sem cliente associado"} · {cost} tokens
                </p>
              </div>
              <LookActions look={result} actions={["favorite", "save", "download", "share"]} />
            </div>
          </div>

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
        {busy ? <LoadingOverlay label="Gerando novo look…" /> : null}
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Provador" subtitle="Vista uma peça do catálogo no cliente">
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

        <div className="grid grid-cols-2 gap-3">
          <EmptyImagePicker
            label="Foto do cliente"
            hint="Galeria/câmera"
            imageUrl={photoUrl}
            onClick={() => setSheet("photo")}
          />
          <EmptyImagePicker
            label="Peça do catálogo"
            hint="Escolher do catálogo"
            imageUrl={item?.imageUrl}
            onClick={() => setSheet("item")}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gênero do modelo
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["female", "male"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  gender === g
                    ? "bg-clay text-clay-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {g === "female" ? "Feminino" : "Masculino"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={run}
          disabled={!item}
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

      {sheet === "photo" ? (
        <PhotoSheet
          onClose={() => setSheet(null)}
          onSelect={(url) => {
            setPhotoUrl(url);
            setSheet(null);
          }}
        />
      ) : null}

      {sheet === "item" ? (
        <CatalogSheet
          onClose={() => setSheet(null)}
          onSelect={(it) => {
            setItem(it);
            setSheet(null);
          }}
        />
      ) : null}

      {busy ? <LoadingOverlay label="Vestindo a peça no modelo…" /> : null}
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

// Foto do cliente por upload real (Supabase Storage, bucket `clients`, isolado
// por loja). Aceita galeria ou câmera; ao terminar o upload, devolve a URL.
function PhotoSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  return (
    <SheetShell title="Foto do cliente" onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">
        Envie uma foto da galeria ou tire na hora com a câmera.
      </p>
      <ImageUploadField
        bucket="clients"
        label="Enviar foto do cliente"
        hint="Galeria ou câmera"
        onChange={(url) => onSelect(url)}
      />
    </SheetShell>
  );
}

function CatalogSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (it: CatalogItem) => void;
}) {
  const items = CatalogService.listActive();
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
              onClick={() => onSelect(it)}
              className="overflow-hidden rounded-xl border border-border text-left"
            >
              <div className="aspect-square w-full overflow-hidden bg-secondary">
                {it.imageUrl ? (
                  <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                ) : null}
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
