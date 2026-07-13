import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "@/lib/icons";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Termos de Uso — Vest IA" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-20 pt-10">
      <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: 07/07/2026</p>

      <div className="mt-8 space-y-7 text-sm leading-relaxed text-foreground">
        <Section title="1. Aceitação">
          Ao usar o Vest IA, você concorda com estes Termos. Se não concordar, não use o
          serviço.
        </Section>

        <Section title="2. O serviço">
          O Vest IA oferece geração de conteúdo de moda com IA — provador virtual, criação de
          posts, análise de peças e catálogo. Os resultados são gerados automaticamente e podem
          conter imprecisões; revise antes de publicar ou vender.
        </Section>

        <Section title="3. Conta e uso">
          Você é responsável por manter a segurança da sua conta e por todo o conteúdo enviado. É
          proibido usar o serviço para conteúdo ilegal, ofensivo, ou para imagens de pessoas sem o
          devido consentimento.
        </Section>

        <Section title="4. Tokens e cobrança">
          Recursos de IA consomem tokens conforme o plano da loja. O saldo é debitado a cada
          geração ou importação. Créditos consumidos não são reembolsáveis, salvo exigência legal.
        </Section>

        <Section title="5. Conteúdo e propriedade">
          As imagens de peças e clientes que você envia permanecem seus. O conteúdo gerado a partir
          delas pode ser usado pela sua loja para fins comerciais. Você garante ter direitos sobre o
          que envia.
        </Section>

        <Section title="6. Fidelidade das peças">
          A IA é orientada a reproduzir fielmente as peças enviadas, pois representam produtos reais.
          Ainda assim, a loja deve conferir cada resultado antes de anunciar — não nos
          responsabilizamos por divergências entre a imagem gerada e o produto físico.
        </Section>

        <Section title="7. Isenção de garantias">
          O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta nem
          resultados específicos das gerações de IA.
        </Section>

        <Section title="8. Limitação de responsabilidade">
          Na máxima extensão permitida por lei, não somos responsáveis por danos indiretos ou lucros
          cessantes decorrentes do uso do serviço.
        </Section>

        <Section title="9. Alterações">
          Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas no app.
        </Section>

        <Section title="10. Contato">
          Dúvidas: <span className="text-clay">contato@vestia.app</span>.
        </Section>

        <p className="rounded-2xl border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
          Este documento é um modelo inicial e não substitui aconselhamento jurídico. Revise com um
          profissional antes de publicar comercialmente.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-1.5 text-muted-foreground">{children}</div>
    </section>
  );
}
