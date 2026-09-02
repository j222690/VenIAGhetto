// /divulgar — gerador de posts para DIVULGAR A VEST AI.
//
// Ferramenta interna dos donos do app, não um recurso do produto: o cliente
// aqui é a lojista e o produto é o app. Não aparece no menu; o atalho fica no
// Perfil, só para quem é dono/gerente da loja da Vest Ai (ver
// @/constants/admins). O gate que conta é o da Edge Function admin-showcase.
//
// Duas formas de montar o post:
//   • Antes/depois — pega uma geração REAL já feita (a linha guarda a foto de
//     origem) e monta o par no canvas. Prova de verdade, e não gasta geração.
//   • Do zero — a IA cria uma imagem de anúncio a partir de um tema. Custa 1
//     crédito e serve para o post conceitual, quando não se quer expor foto
//     de cliente nenhuma.

import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Megaphone, Sparkles } from "@/lib/icons";
import { AppLayout } from "@/layouts/AppLayout";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ShowcaseService, type ShowcaseItem } from "@/services/ShowcaseService";
import { composeBeforeAfter, type PostFormat } from "@/lib/composeBeforeAfter";
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

interface Resultado {
  /** data URL (antes/depois) ou URL do Storage (gerada do zero). */
  imagem: string;
  copies: SocialCopySet;
}

function DivulgarPage() {
  const { session, loading } = useAuth();
  const [aba, setAba] = useState<Aba>("par");
  const [formato, setFormato] = useState<PostFormat>("feed");

  const [material, setMaterial] = useState<ShowcaseItem[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [escolhido, setEscolhido] = useState<ShowcaseItem | null>(null);
  const [angulo, setAngulo] = useState("");

  const [tema, setTema] = useState("");

  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [canal, setCanal] = useState<Canal>("instagram");

  const podeVer = isAppAdmin(session);

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

  const montarPar = async () => {
    if (!escolhido?.clientPhotoUrl) return;
    setBusy(true);
    setBusyLabel("Montando o antes/depois…");
    try {
      const imagem = await composeBeforeAfter({
        antesUrl: escolhido.clientPhotoUrl,
        depoisUrl: escolhido.resultUrl,
        formato,
      });
      setBusyLabel("Escrevendo a legenda…");
      const copies = await ShowcaseService.copyAntesDepois(escolhido.resultUrl, angulo);
      setResultado({ imagem, copies });
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
      const imagem = await ShowcaseService.imagemTema(tema, formato);
      setBusyLabel("Escrevendo a legenda…");
      const copies = await ShowcaseService.copyTema(tema);
      setResultado({ imagem, copies });
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
        onVoltar={() => setResultado(null)}
      />
    );
  }

  return (
    <AppLayout title="Divulgar o app" subtitle="Só para os donos da Vest Ai">
      {busy ? <LoadingOverlay label={busyLabel} /> : null}

      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-1">
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: "par" as Aba, label: "Antes/depois" },
              { id: "zero" as Aba, label: "Do zero" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setAba(t.id)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  aba === t.id
                    ? "bg-clay text-clay-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <FormatoPicker formato={formato} setFormato={setFormato} />

        {aba === "par" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Escolha um resultado real. O antes é a foto que entrou; o depois é o que o app
              devolveu. Montar o par não gasta crédito.
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
                {pares.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setEscolhido(m)}
                    className={cn(
                      "overflow-hidden rounded-2xl border-2 transition-all",
                      escolhido?.id === m.id
                        ? "border-clay shadow-soft"
                        : "border-transparent opacity-80 hover:opacity-100",
                    )}
                  >
                    <img
                      src={thumbUrl(m.resultUrl, { width: 220 })}
                      alt=""
                      className="aspect-[3/4] w-full object-cover object-top"
                    />
                    <span className="block truncate px-2 py-1 text-[10px] text-muted-foreground">
                      {m.ownStore ? "sua loja" : m.storeName}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {escolhido && !escolhido.ownStore ? (
              <p className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground">
                Esta foto é de uma cliente de <strong>{escolhido.storeName}</strong>. Peça
                autorização à loja e à pessoa antes de publicar — é a imagem de alguém, não um
                material seu.
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
              disabled={!escolhido || busy}
              className="w-full rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-50"
            >
              Montar post
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Descreva a cena do anúncio. A IA cria a imagem do zero — não é prova do produto, mas
              não expõe foto de cliente nenhuma. Custa 1 crédito.
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

function FormatoPicker({
  formato,
  setFormato,
}: {
  formato: PostFormat;
  setFormato: (f: PostFormat) => void;
}) {
  return (
    <div className="flex gap-2">
      {[
        { id: "feed" as PostFormat, label: "Feed 4:5" },
        { id: "story" as PostFormat, label: "Story 9:16" },
      ].map((f) => (
        <button
          key={f.id}
          onClick={() => setFormato(f.id)}
          className={cn(
            "flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors",
            formato === f.id
              ? "border-clay bg-clay/10 text-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          {f.label}
        </button>
      ))}
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
  const { imagem, copies } = resultado;
  const legenda = [copies[canal], copies.hashtags.join(" ")].filter(Boolean).join("\n\n");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(legenda);
      toast.success("Legenda copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  // Link direto com `download`: a imagem do antes/depois é um data URL montado
  // aqui no navegador, então não há o que buscar na rede.
  const baixar = () => {
    const a = document.createElement("a");
    a.href = imagem;
    a.download = `vestai-divulgacao-${Date.now()}.jpg`;
    a.click();
    toast.success("Imagem salva.");
  };

  return (
    <AppLayout title="Post pronto">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
          <img src={imagem} alt="post de divulgação" className="w-full" />
        </div>

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
            onClick={baixar}
            className="flex items-center justify-center gap-2 rounded-full bg-clay px-4 py-3 text-sm font-semibold text-clay-foreground shadow-soft"
          >
            <Download className="h-4 w-4" /> Baixar imagem
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
