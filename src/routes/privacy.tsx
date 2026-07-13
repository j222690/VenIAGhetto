import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "@/lib/icons";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Vest IA" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 pb-20 pt-10">
      <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: 07/07/2026</p>

      <div className="mt-8 space-y-7 text-sm leading-relaxed text-foreground">
        <Section title="1. Quem somos">
          O Vest IA é uma ferramenta que ajuda lojas de moda a criar conteúdo (provador
          virtual, imagens de posts, legendas e catálogo) usando inteligência artificial. Esta
          política explica quais dados tratamos e por quê.
        </Section>

        <Section title="2. Dados que coletamos">
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Dados de conta: e-mail e informações da loja (nome, contato, segmento).</li>
            <li>Conteúdo enviado: fotos de peças, de clientes e de modelos que você faz upload.</li>
            <li>Conteúdo gerado: imagens, legendas e fichas criadas pela IA.</li>
            <li>Uso do serviço: gerações realizadas e saldo/consumo de tokens.</li>
          </ul>
        </Section>

        <Section title="3. Como usamos os dados">
          Usamos os dados apenas para operar o serviço: autenticar seu acesso, armazenar seu
          catálogo e histórico, e processar as imagens/textos que você solicita gerar. Não vendemos
          seus dados.
        </Section>

        <Section title="4. Compartilhamento com terceiros (subprocessadores)">
          Para funcionar, o app usa provedores que processam dados sob nossa orientação:
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Supabase — autenticação, banco de dados e armazenamento de imagens.</li>
            <li>Google (Gemini) — geração e edição de imagens.</li>
            <li>OpenAI — análise de imagens (visão) para legendas e catálogo.</li>
          </ul>
          As imagens enviadas podem ser transmitidas a esses provedores apenas para gerar o
          resultado solicitado.
        </Section>

        <Section title="5. Fotos de clientes e consentimento">
          Ao enviar a foto de um cliente para o provador virtual, você declara ter obtido o
          consentimento dessa pessoa para o uso da imagem. A loja é responsável por esse
          consentimento e pelo uso das imagens geradas.
        </Section>

        <Section title="6. Retenção e exclusão">
          Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a exclusão da
          conta e dos dados associados a qualquer momento pelo contato abaixo.
        </Section>

        <Section title="7. Segurança">
          Adotamos medidas técnicas para proteger seus dados, incluindo isolamento por loja
          (cada loja acessa apenas os próprios dados) e chaves de IA mantidas em servidor, nunca no
          aplicativo.
        </Section>

        <Section title="8. Seus direitos">
          Você pode acessar, corrigir ou excluir seus dados, e retirar consentimentos. Para exercer
          esses direitos, use o contato abaixo.
        </Section>

        <Section title="9. Contato">
          Dúvidas sobre privacidade: <span className="text-clay">privacidade@vestia.app</span>.
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
