// /corpo — completa uma foto de meio corpo em corpo inteiro.
//
// POR QUE VIROU TELA PRÓPRIA
// O recurso existia só dentro da ficha do cliente, num botão pequeno embaixo
// de uma foto da galeria — para chegar nele era preciso abrir Clientes, achar
// a pessoa, abrir a ficha e reparar no botão. Quem não sabia que existia não
// descobria, e quem sabia levava quatro toques. O Provador é uma tela; isto
// resolve um problema do mesmo tamanho (a foto que o cliente mandou não serve)
// e agora fica no mesmo lugar.
//
// Aceita foto SOLTA, sem cliente cadastrado: a foto quase sempre chega pelo
// WhatsApp, e obrigar a abrir ficha antes de testar o recurso era parte do que
// o escondia. Salvar na ficha continua existindo, como passo seguinte — é o
// que faz a foto aparecer no Provador depois.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { ImageUploadField } from "@/components/ImageUploadField";
import { SectionTitle } from "@/components/SectionTitle";
import { Users, Sparkles, Shirt } from "@/lib/icons";
import { AIService } from "@/services/AIService";
import { ClientService } from "@/services/ClientService";
import { TokenService } from "@/services/TokenService";
import { describeApiError } from "@/lib/apiErrors";
import { useAuth } from "@/hooks/useAuth";
import type { Client } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/corpo")({
  head: () => ({ meta: [{ title: "Criar corpo inteiro — Vest Ai" }] }),
  component: CorpoPage,
});

function CorpoPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [origem, setOrigem] = useState("");
  const [resultado, setResultado] = useState("");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [clientes, setClientes] = useState<Client[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [salvando, setSalvando] = useState(false);

  // A lista só serve ao passo de salvar, então carrega em segundo plano e não
  // atrapalha quem só quer gerar e baixar.
  useEffect(() => {
    // load() busca do servidor; list() só lê o cache, que pode estar vazio
    // quando a tela é aberta direto pela URL.
    ClientService.load()
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  const gerar = async () => {
    if (!origem || !session) return;
    if (!TokenService.hasBalance(1)) {
      toast.error("Você já usou todas as gerações do mês. Adicione mais nas Configurações.");
      return;
    }
    setBusy(true);
    setLabel("Conferindo a foto…");
    try {
      // Confere o enquadramento ANTES de cobrar. Os dois desvios abaixo
      // economizam uma geração que sairia inútil — e é o tipo de recusa que
      // dá confiança: o app diz que não precisa gastar.
      const check = await AIService.bodyFramingCheck(origem);
      if (check.status === "completa") {
        toast.info(check.mensagem, {
          duration: 8000,
          description: "Esta foto já serve no Provador — não precisa gastar geração.",
        });
        return;
      }
      if (check.status === "curta") {
        toast.error(check.mensagem, {
          duration: 9000,
          description: "Use uma foto da cintura para cima — assim a IA completa só as pernas.",
        });
        return;
      }

      setLabel("Criando o corpo…");
      const url = await ClientService.generateFullBody(
        origem,
        session.store.id,
        session.user.id,
        (seg) => setLabel(seg < 60 ? `Criando o corpo… ${seg}s` : `Ainda processando (${seg}s)…`),
      );
      setResultado(url);
      toast.success("Corpo inteiro gerado.", {
        duration: 8000,
        description: "A parte de baixo foi criada pela IA — confira antes de usar.",
      });
    } catch (e) {
      toast.error(describeApiError(e, "Não foi possível gerar o corpo inteiro."));
    } finally {
      setBusy(false);
    }
  };

  const salvarNaFicha = async () => {
    if (!clienteId || !resultado) return;
    setSalvando(true);
    try {
      await ClientService.addPhoto(clienteId, resultado);
      toast.success("Salvo na ficha.", {
        description: "A foto já aparece quando você escolher esse cliente no Provador.",
      });
    } catch (e) {
      toast.error(describeApiError(e, "Não foi possível salvar na ficha."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppLayout title="Criar corpo inteiro" subtitle="Complete a foto cortada do seu cliente">
      {busy ? <LoadingOverlay label={label} /> : null}

      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          O Provador precisa da pessoa de corpo inteiro, e a foto que o cliente manda quase sempre
          vem cortada. Envie a foto da <span className="font-medium text-foreground">cintura para
          cima</span> e a IA completa as pernas, mantendo rosto, pose e cenário.
        </p>

        <ImageUploadField
          bucket="clients"
          value={origem}
          onChange={(u) => {
            setOrigem(u);
            setResultado("");
          }}
          label="Foto do cliente"
          hint="Da cintura para cima, de frente, corpo visível. Quanto mais corpo real na foto, menos a IA precisa inventar."
          fit="contain"
        />

        {!resultado ? (
          <button
            onClick={gerar}
            disabled={!origem || busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-clay px-6 py-4 text-base font-semibold text-clay-foreground shadow-soft disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5" /> Criar corpo inteiro · 1 crédito
          </button>
        ) : null}

        {resultado ? (
          <section className="space-y-3">
            <SectionTitle eyebrow="Pronto" title="Antes e depois" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { u: origem, t: "Enviada" },
                { u: resultado, t: "Corpo inteiro" },
              ].map((x) => (
                <figure key={x.t} className="space-y-1.5">
                  <img
                    src={x.u}
                    alt={x.t}
                    className="w-full rounded-2xl border border-border bg-card object-contain"
                  />
                  <figcaption className="text-center text-xs text-muted-foreground">{x.t}</figcaption>
                </figure>
              ))}
            </div>

            {/* A parte de baixo é inventada — dizer isso aqui, e não só num
                toast que some, é o que evita a foto ir para uma cliente com
                uma calça que a pessoa nunca usou. */}
            <p className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs leading-relaxed text-foreground">
              A roupa de baixo foi criada pela IA: não há como saber o que a pessoa usava. Confira
              antes de mandar para alguém.
            </p>

            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Salvar na ficha de um cliente</p>
              <p className="text-xs text-muted-foreground">
                Salvando, a foto aparece pronta no Provador quando você escolher esse cliente.
              </p>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-clay"
              >
                <option value="">Escolher cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={salvarNaFicha}
                disabled={!clienteId || salvando}
                className="w-full rounded-full bg-secondary px-5 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar na ficha"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate({ to: "/tryon", search: { g: undefined } })}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-semibold text-clay-foreground"
              >
                <Shirt className="h-4 w-4" /> Ir ao Provador
              </button>
              <button
                onClick={() => {
                  setResultado("");
                  setOrigem("");
                }}
                className="rounded-full border border-border px-5 py-3 text-sm font-medium"
              >
                Fazer outra
              </button>
            </div>
          </section>
        ) : null}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Users className="mt-0.5 h-4 w-4 shrink-0" />
          Se a foto já mostrar o corpo todo, o app avisa e não gasta crédito. Se estiver cortada
          acima da cintura, ele recusa — teria de inventar quase tudo.
        </p>
      </div>
    </AppLayout>
  );
}
