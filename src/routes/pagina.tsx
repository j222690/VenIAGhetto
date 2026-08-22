import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pagina")({
  head: () => ({
    meta: [
      { title: "Vest Ai para Lojas" },
      {
        name: "description",
        content:
          "Provador virtual, scanner de peças e criador de posts com IA para lojas e vendedores de moda.",
      },
    ],
  }),
  component: SalesPage,
});

const WHATSAPP_URL =
  "https://wa.me/5549989033938?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20Vest%20Ai.";

function SalesPage() {
  return (
    <div className="pv">
      <style>{CSS}</style>

      <header className="nav">
        <div className="wrap nav-row">
          <a className="wordmark" href="#top">
            Vest<span className="ai">Ai</span>
          </a>
          <nav className="nav-links">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
          </nav>
          <Link
            to="/welcome"
            className="btn btn-primary"
            style={{ padding: "0.65rem 1.35rem", fontSize: "0.88rem" }}
          >
            Começar agora
          </Link>
        </div>
      </header>

      <a
        className="whatsapp-fab"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.6 6.32A8.86 8.86 0 0 0 12.02 3.5c-4.9 0-8.87 3.98-8.87 8.87 0 1.56.41 3.08 1.19 4.42L3.5 21l4.35-.8a8.86 8.86 0 0 0 4.17 1.06h.01c4.9 0 8.87-3.98 8.87-8.87 0-2.37-.92-4.6-2.6-6.27ZM12.03 19.8h-.01a7.4 7.4 0 0 1-3.78-1.04l-.27-.16-2.8.51.53-2.73-.18-.28a7.4 7.4 0 1 1 6.5 3.7Zm4.06-5.54c-.22-.11-1.31-.65-1.51-.72-.2-.07-.35-.11-.5.11-.15.22-.57.72-.7.87-.13.15-.26.16-.48.05a6.05 6.05 0 0 1-1.78-1.1 6.68 6.68 0 0 1-1.23-1.53c-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.07-.11-.5-1.2-.68-1.64-.18-.43-.36-.37-.5-.38h-.43c-.15 0-.39.06-.6.28-.2.22-.79.77-.79 1.87 0 1.1.81 2.16.92 2.31.11.15 1.6 2.44 3.87 3.42.54.23.96.37 1.29.48.54.17 1.03.15 1.42.09.43-.06 1.31-.54 1.5-1.06.18-.51.18-.95.13-1.05-.05-.1-.2-.16-.42-.27Z" />
        </svg>
      </a>

      <main id="top">
        <div className="wrap hero">
          <div>
            <p className="eyebrow">Vest Ai · para lojas e vendedores de moda</p>
            <h1>
              Conteúdo de moda profissional, <span className="grad-text">em segundos.</span>
            </h1>
            <p className="hero-sub">
              Chega de agendar ensaio pra cada peça nova. O Vest Ai veste sua roupa em modelos
              gerados por IA — prontos pra loja, pro feed e pro WhatsApp, com a estética da sua
              marca.
            </p>
            <div className="hero-ctas">
              <Link to="/welcome" className="btn btn-primary">
                Começar agora
              </Link>
              <a className="btn btn-ghost" href="#como-funciona">
                Ver como funciona
              </a>
            </div>
            <div className="trust-row">
              <span className="trust-badge">
                <CheckIcon />7 dias grátis
              </span>
              <span className="trust-badge">
                <CheckIcon />
                Cancele quando quiser
              </span>
              <span className="trust-badge">
                <CheckIcon />
                Pagamento seguro via Stripe
              </span>
            </div>
          </div>
          <div className="phone reveal">
            <div className="phone-bar">
              <span className="app-name">Provador IA</span>
              <span className="app-tag">Vest Ai</span>
            </div>
            <div className="look-cell hero-photo">
              <img src="/marketing/cliente.jpg" alt="Foto gerada pelo Vest Ai" loading="lazy" />
            </div>
            <div className="phone-nav">
              <span className="active"></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <hr className="divider" />

        <section id="antes-depois">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Resultado real</p>
              <h2>Duas peças, mesma pessoa, um clique de diferença.</h2>
              <p>Fotos reais geradas pelo Vest Ai — sem novo ensaio entre uma peça e outra.</p>
            </div>
            <div className="ba-single reveal">
              <div className="ba-photo-lg">
                <span className="tag">Look 1</span>
                <img src="/marketing/antes.jpg" alt="Foto gerada pelo Vest Ai" loading="lazy" />
              </div>
              <svg
                className="ba-arrow-lg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <div className="ba-photo-lg after">
                <span className="tag">Look 2</span>
                <img src="/marketing/depois.jpg" alt="Foto gerada pelo Vest Ai" loading="lazy" />
              </div>
            </div>
            <p className="ba-caption-lg">
              Mesma pessoa, mesmo fundo — só a peça e a roupa mudam entre uma geração e outra.
            </p>
          </div>
        </section>

        <hr className="divider" />

        <section id="recursos">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">O que você recebe</p>
              <h2>Tudo que um ensaio faria — sem marcar ensaio nenhum.</h2>
            </div>
            <div className="feature-grid">
              <FeatureCard
                icon={
                  <path d="M12 3v2M8 6l4-1 4 1 5 4-2 3-3-2v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9l-3 2-2-3 5-4Z" />
                }
                title="Provador IA"
                desc="Veja a peça vestida em modelos, com caimento e pose realistas."
              />
              <FeatureCard
                icon={
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M3 9h18M9 21V9" />
                  </>
                }
                title="Scanner de peças"
                desc="Fotografe a peça e receba a ficha completa — cor, categoria, nome — em um clique."
              />
              <FeatureCard
                icon={
                  <>
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </>
                }
                title="Grade de looks"
                desc="Vários looks do mesmo modelo numa imagem só, prontos pra comparar e postar."
              />
              <FeatureCard
                icon={<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
                title="Posts prontos"
                desc="Imagem + copy prontos pro Instagram, WhatsApp e Facebook."
              />
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="exemplos">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Na prática</p>
              <h2>O que dá pra fazer com o Vest Ai, no dia a dia da loja.</h2>
            </div>
            <div className="example-grid">
              <ExampleCard
                scenario="Peça nova no estoque"
                title="Chegou de manhã, no feed até o meio-dia"
                desc="Fotografa a peça, escolhe o modelo e já sai vestida — sem esperar agenda de fotógrafo pra lançar."
              />
              <ExampleCard
                scenario="Atendimento pelo WhatsApp"
                title={'"Como fica essa blusa com uma calça branca?"'}
                desc="Gera a combinação na hora, sem sair da conversa com o cliente, sem remarcar nada."
              />
              <ExampleCard
                scenario="Troca de coleção"
                title="Renova o catálogo inteiro sem novo ensaio"
                desc="Sobe as peças da estação nova e gera as fotos de novo — não precisa remontar produção do zero."
              />
              <ExampleCard
                scenario="Loja sem modelo fixo"
                title="Padrão visual consistente em toda foto"
                desc="O mesmo tipo de modelo e enquadramento em todas as peças, mesmo sem contratar ninguém pra cada sessão."
              />
              <ExampleCard
                scenario="Sugestão de combinação"
                title="Mostra 3, 4 ou 6 looks com a mesma peça"
                desc="A grade de looks ajuda o cliente a decidir mostrando a peça combinada de formas diferentes, numa imagem só."
              />
              <ExampleCard
                scenario="Fim de semana, fotógrafo indisponível"
                title="Lança normalmente, sem depender de terceiros"
                desc="O provador funciona quando você precisar — a loja não fica esperando a agenda de mais ninguém."
              />
            </div>
          </div>
        </section>

        <div className="wrap">
          <div className="cta-band reveal">
            <div className="cta-band-inner">
              <h3>Sua próxima coleção pode estar pronta pra vender hoje à noite.</h3>
              <Link to="/welcome" className="btn">
                Quero testar
              </Link>
            </div>
          </div>
        </div>

        <section>
          <div className="wrap problem">
            <div className="problem-copy reveal">
              <p className="eyebrow">O custo escondido do ensaio</p>
              <h2
                style={{
                  marginTop: "0.7rem",
                  fontSize: "clamp(1.75rem,3.4vw,2.4rem)",
                  lineHeight: "1.16",
                }}
              >
                Você ainda paga fotógrafo pra cada peça nova que chega?
              </h2>
              <p>
                Fotógrafo, modelo, estúdio e edição custam caro e levam dias — e nesse tempo a peça
                fica parada no cabide, sem converter em venda.
              </p>
              <p>
                O Vest Ai troca esse processo inteiro por um clique: sobe a foto da peça, escolhe o
                modelo e recebe a foto pronta em minutos.
              </p>
            </div>
            <div className="compare reveal">
              <div className="compare-row head">
                <span className="compare-label">Do jeito antigo</span>
                <span className="compare-label">Com o Vest Ai</span>
              </div>
              <CompareRow oldText="Fotógrafo + modelo por diária" newText="Um plano mensal" />
              <CompareRow oldText="Estúdio e edição à parte" newText="Gerado pronto, sem edição" />
              <CompareRow oldText="Dias de espera por peça" newText="Minutos por peça" />
              <CompareRow oldText="Uma sessão, poucas peças" newText="O catálogo inteiro" />
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section>
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">O que muda na sua rotina</p>
              <h2>Não é só uma foto diferente. É um jeito diferente de tocar a loja.</h2>
              <p>
                Nada disso troca o seu trabalho — troca a parte que mais atrasava ele: esperar
                terceiros pra colocar peça nova pra vender.
              </p>
            </div>
            <div className="change-grid">
              <ChangeItem
                icon={
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </>
                }
                title="Você para de depender da agenda de terceiros"
                desc="Não precisa mais esperar fotógrafo, modelo ou estúdio livre pra lançar uma peça nova."
              />
              <ChangeItem
                icon={
                  <>
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-4 4" />
                  </>
                }
                title="O tempo de organizar ensaio vira tempo de vender"
                desc="O que ia embora em agendamento e logística passa a ser tempo de atendimento e conversa com cliente."
              />
              <ChangeItem
                icon={
                  <>
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <path d="M3 9h18" />
                  </>
                }
                title="Sua loja compete de igual com as grandes"
                desc="Fotos padronizadas e com cara de rede grande, sem precisar do orçamento de uma rede grande."
              />
              <ChangeItem
                icon={
                  <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5-4.7-4.6 6.5-.9Z" />
                }
                title="Você lança no mesmo dia que a peça chega"
                desc="Da entrega no estoque ao post publicado, sem os dias de intervalo que um ensaio tradicional exige."
              />
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="grade">
          <div className="wrap highlight">
            <div className="highlight-copy reveal">
              <p className="eyebrow">Recurso em destaque</p>
              <h2>Pra cada cliente, vários looks numa foto só.</h2>
              <p>
                Na Grade de Looks, o mesmo modelo aparece em looks diferentes lado a lado — perfeito
                pra mostrar opções, ajudar o cliente a escolher ou simplesmente render mais conteúdo
                com menos peças fotografadas.
              </p>
              <ul className="highlight-list">
                <li>
                  <CheckIcon />
                  Até 6 looks lado a lado, numa imagem só
                </li>
                <li>
                  <CheckIcon />
                  Mesmo rosto e pose preservados em cada look
                </li>
                <li>
                  <CheckIcon />
                  Peças direto do catálogo da loja, sem re-upload
                </li>
              </ul>
            </div>
            <div className="phone reveal">
              <div className="phone-bar">
                <span className="app-name">4 looks</span>
                <span className="app-tag">mesmo modelo</span>
              </div>
              <div className="grid-photo">
                <img
                  src="/marketing/grade.jpg"
                  alt="Grade de looks gerada pelo Vest Ai, mesmo modelo em quatro looks"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="planos">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Investimento</p>
              <h2>Um plano mensal no lugar de cada ensaio.</h2>
              <p>
                Todos os planos incluem provador, scanner de catálogo, grade de looks e posts
                prontos. A diferença é quantas fotos sua loja gera por mês.
              </p>
            </div>
            <div className="pricing-grid">
              <div className="plan reveal">
                <div>
                  <div className="plan-name">Starter</div>
                  <div className="plan-price">
                    <span className="amount">R$97</span>
                    <span className="period">/mês</span>
                  </div>
                  <div className="plan-tokens">149 gerações/mês</div>
                </div>
                <hr />
                <ul className="plan-features">
                  <PlanFeature text="Provador IA" />
                  <PlanFeature text="Scanner de peças" />
                  <PlanFeature text="Até 3 usuários" />
                  <PlanFeature text="Biblioteca até 50 itens" />
                  <PlanFeature text="Histórico de 90 dias" />
                </ul>
                <Link to="/welcome" className="btn btn-ghost btn-block">
                  Começar com Starter
                </Link>
              </div>
              <div className="plan featured reveal">
                <div>
                  <div className="plan-name">Pro</div>
                  <div className="plan-price">
                    <span className="amount">R$197</span>
                    <span className="period">/mês</span>
                  </div>
                  <div className="plan-tokens">303 gerações/mês</div>
                </div>
                <hr />
                <ul className="plan-features">
                  <PlanFeature text="Tudo do Starter" />
                  <PlanFeature text="Criador de Posts" />
                  <PlanFeature text="Até 10 usuários" />
                  <PlanFeature text="Biblioteca até 300 itens" />
                  <PlanFeature text="Histórico ilimitado" />
                </ul>
                <Link to="/welcome" className="btn btn-primary btn-block">
                  Começar com Pro
                </Link>
              </div>
              <div className="plan reveal">
                <div>
                  <div className="plan-name">Business</div>
                  <div className="plan-price">
                    <span className="amount">R$397</span>
                    <span className="period">/mês</span>
                  </div>
                  <div className="plan-tokens">610 gerações/mês</div>
                </div>
                <hr />
                <ul className="plan-features">
                  <PlanFeature text="Tudo do Pro" />
                  <PlanFeature text="Até 25 usuários" />
                  <PlanFeature text="Biblioteca ilimitada" />
                  <PlanFeature text="Suporte prioritário" />
                </ul>
                <Link to="/welcome" className="btn btn-ghost btn-block">
                  Começar com Business
                </Link>
              </div>
            </div>
            <p className="guarantee">
              Comece com 7 dias grátis · cancele quando quiser · pagamento seguro via Stripe
            </p>
          </div>
        </section>

        <section className="closing">
          <div className="wrap">
            <h2 className="reveal">Sua loja não precisa mais esperar fotógrafo pra vender.</h2>
            <div className="hero-ctas">
              <Link to="/welcome" className="btn btn-primary">
                Começar agora
              </Link>
            </div>
          </div>
        </section>

        <hr className="divider" />

        <section id="como-funciona">
          <div className="wrap">
            <div className="section-head reveal">
              <p className="eyebrow">Como funciona</p>
              <h2>Da peça no cabide à foto pronta, em três passos.</h2>
            </div>
            <div className="steps">
              <div className="step reveal">
                <h3>Suba a foto da peça</h3>
                <p>
                  Uma foto simples da roupa — ou escaneie o catálogo inteiro de uma vez com o
                  celular.
                </p>
              </div>
              <div className="step reveal">
                <h3>A IA veste no modelo</h3>
                <p>
                  Caimento, pose e ambiente realistas, mantendo a peça fiel ao que foi fotografado.
                </p>
              </div>
              <div className="step reveal">
                <h3>Baixe e publique</h3>
                <p>
                  Foto em alta, pronta pra loja, pro feed ou já com legenda gerada pro WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap footer-row">
          <div className="footer-brand">
            <a className="wordmark" href="#top">
              Vest<span className="ai">Ai</span>
            </a>
            <span className="footer-tag">Conteúdo de moda profissional, em segundos.</span>
          </div>
          <span className="footer-copy">© 2026 Vest Ai</span>
        </div>
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="feature-card reveal">
      <div className="icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function ExampleCard({ scenario, title, desc }: { scenario: string; title: string; desc: string }) {
  return (
    <div className="example-card reveal">
      <span className="scenario">{scenario}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function ChangeItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="change-item reveal">
      <div className="mark">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function CompareRow({ oldText, newText }: { oldText: string; newText: string }) {
  return (
    <div className="compare-row">
      <span className="compare-old">{oldText}</span>
      <span className="compare-new">{newText}</span>
    </div>
  );
}

function PlanFeature({ text }: { text: string }) {
  return (
    <li>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {text}
    </li>
  );
}

const CSS = `
.pv {
  --bg: #17151d;
  --card: #1f1c28;
  --card-2: #27222f;
  --fg: #f5f3f8;
  --fg-soft: #b7b0c2;
  --fg-faint: #857e91;
  --line: rgba(255, 255, 255, 0.12);
  --line-strong: rgba(255, 255, 255, 0.22);

  --accent: #a855f7;
  --accent-rgb: 168, 85, 247;
  --accent-2: #3fc1f0;
  --accent-2-rgb: 63, 193, 240;
  --accent-3: #f4419a;
  --accent-3-rgb: 244, 65, 154;
  --accent-ink: #fbfaff;

  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  --glow: 0 0 20px rgba(var(--accent-rgb), 0.5), 0 0 46px rgba(var(--accent-rgb), 0.24);
  --shadow-soft: 0 1px 2px rgba(0, 0, 0, 0.45), 0 10px 28px rgba(0, 0, 0, 0.5);
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.45), 0 30px 70px rgba(0, 0, 0, 0.55);

  background: var(--bg);
  background-image:
    radial-gradient(58% 46% at 14% -6%, rgba(var(--accent-rgb), 0.16), transparent 70%),
    radial-gradient(52% 42% at 102% -2%, rgba(var(--accent-2-rgb), 0.13), transparent 70%);
  background-attachment: fixed;
  background-repeat: no-repeat;
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

.pv * { box-sizing: border-box; }
.pv img, .pv svg { display: block; max-width: 100%; }
.pv .wrap { max-width: 74rem; margin: 0 auto; padding: 0 1.5rem; }
@media (min-width: 768px) { .pv .wrap { padding: 0 2.5rem; } }

.pv h1, .pv h2, .pv h3, .pv .font-display { font-family: var(--font-display); letter-spacing: -0.01em; font-weight: 560; margin: 0; }
.pv p { margin: 0; }
.pv ::selection { background: rgba(var(--accent-rgb), 0.4); color: var(--fg); }

.pv .eyebrow {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--accent-2);
}

.pv .grad-text {
  background-image: linear-gradient(100deg, var(--accent) 0%, var(--accent-3) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.pv .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.95rem 1.8rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.95rem;
  text-decoration: none;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}
.pv .btn:hover { transform: translateY(-2px); }
.pv .btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 3px; }
.pv .btn-primary { background: var(--accent); color: var(--accent-ink); box-shadow: var(--glow); }
.pv .btn-primary:hover { box-shadow: 0 0 26px rgba(var(--accent-rgb), 0.6), 0 0 60px rgba(var(--accent-rgb), 0.3); }
.pv .btn-ghost { background: rgba(255, 255, 255, 0.04); color: var(--fg); border-color: var(--line-strong); }
.pv .btn-ghost:hover { border-color: var(--accent-2); background: rgba(255, 255, 255, 0.07); }
.pv .btn-block { width: 100%; }

.pv header.nav {
  position: sticky; top: 0; z-index: 40;
  background: rgba(23, 21, 29, 0.86);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.pv .nav-row { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 0; }
.pv .wordmark { font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); text-decoration: none; }
.pv .wordmark .ai { color: var(--accent); }
.pv .nav-links { display: none; gap: 2.2rem; font-size: 0.9rem; font-weight: 500; }
.pv .nav-links a { color: var(--fg-soft); text-decoration: none; }
.pv .nav-links a:hover { color: var(--fg); }
@media (min-width: 860px) { .pv .nav-links { display: flex; } }

.pv .hero { padding: 4rem 0 3rem; display: grid; gap: 3rem; align-items: center; }
@media (min-width: 960px) { .pv .hero { grid-template-columns: 1.05fr 0.95fr; padding: 5.5rem 0 5rem; } }
.pv .hero h1 { margin-top: 1rem; font-size: clamp(2.5rem, 5.6vw, 3.9rem); line-height: 1.04; }
.pv .hero-sub { margin-top: 1.4rem; max-width: 33rem; font-size: 1.14rem; color: var(--fg-soft); }
.pv .hero-ctas { display: flex; flex-wrap: wrap; gap: 0.9rem; margin-top: 2.2rem; }

.pv .trust-row { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1.6rem; }
.pv .trust-badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.78rem; font-weight: 600; color: var(--fg-soft);
  background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line);
  padding: 0.4rem 0.8rem; border-radius: 999px;
}
.pv .trust-badge svg { color: var(--accent-2); }

.pv .phone {
  position: relative;
  border-radius: 2rem;
  background: linear-gradient(180deg, var(--card-2), var(--card));
  border: 1px solid var(--line-strong);
  box-shadow: var(--shadow-elevated);
  padding: 0.9rem;
}
.pv .phone-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.3rem 0.5rem 1rem; }
.pv .phone-bar .app-name { font-family: var(--font-display); font-size: 0.95rem; font-weight: 600; color: var(--fg); }
.pv .phone-bar .app-tag { font-size: 0.66rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-2); font-weight: 600; }
.pv .look-cell {
  position: relative; border-radius: 1.1rem; overflow: hidden;
  background: var(--card); border: 1px solid var(--line);
}
.pv .look-cell img { width: 100%; height: 100%; object-fit: cover; }
.pv .look-cell.hero-photo { aspect-ratio: 3/4; border-radius: 1.4rem; }
.pv .phone-nav { display: flex; justify-content: center; gap: 1.6rem; padding-top: 1rem; }
.pv .phone-nav span { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--line-strong); }
.pv .phone-nav span.active { background: var(--accent); box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.7); }

.pv section { padding: 4.5rem 0; }
.pv .divider { border: none; border-top: 1px solid var(--line); margin: 0; }
.pv .section-head { max-width: 40rem; margin-bottom: 3rem; }
.pv .section-head h2 { margin-top: 0.7rem; font-size: clamp(1.75rem, 3.4vw, 2.5rem); line-height: 1.12; }
.pv .section-head p { margin-top: 1rem; color: var(--fg-soft); font-size: 1.02rem; }

.pv .feature-grid { display: grid; gap: 1.1rem; grid-template-columns: 1fr; }
@media (min-width: 640px) { .pv .feature-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1080px) { .pv .feature-grid { grid-template-columns: repeat(4, 1fr); } }
.pv .feature-card {
  background: var(--card); border: 1px solid var(--line); border-radius: 1.7rem;
  padding: 1.7rem; display: flex; flex-direction: column; gap: 1rem;
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.pv .feature-card:hover { border-color: rgba(var(--accent-rgb), 0.45); transform: translateY(-3px); }
.pv .feature-card .icon {
  width: 2.6rem; height: 2.6rem; border-radius: 0.9rem; background: var(--card-2);
  display: grid; place-items: center; color: var(--accent);
}
.pv .feature-card h3 { font-size: 1.1rem; font-weight: 620; font-family: var(--font-display); }
.pv .feature-card p { color: var(--fg-soft); font-size: 0.94rem; }

.pv .cta-band { background: linear-gradient(120deg, var(--accent), #d1479f); border-radius: 2rem; box-shadow: var(--glow); }
.pv .cta-band-inner { padding: 2.8rem 2rem; display: flex; flex-direction: column; gap: 1.3rem; align-items: flex-start; }
@media (min-width: 720px) { .pv .cta-band-inner { flex-direction: row; align-items: center; justify-content: space-between; padding: 2.8rem 3.2rem; } }
.pv .cta-band h3 { font-size: 1.55rem; max-width: 27rem; color: #fff; }
.pv .cta-band .btn { background: var(--bg); color: var(--fg); box-shadow: none; }
.pv .cta-band .btn:hover { background: var(--card); }

.pv .problem { display: grid; gap: 2.5rem; }
@media (min-width: 900px) { .pv .problem { grid-template-columns: 1fr 1fr; align-items: center; } }
.pv .problem-copy p + p { margin-top: 1rem; color: var(--fg-soft); }
.pv .compare { background: var(--card); border: 1px solid var(--line); border-radius: 1.7rem; padding: 1.7rem; }
.pv .compare-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 0.9rem 0; }
.pv .compare-row + .compare-row { border-top: 1px solid var(--line); }
.pv .compare-row.head { padding-top: 0; }
.pv .compare-label { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-faint); }
.pv .compare-old { color: var(--fg-faint); text-decoration: line-through; text-decoration-color: var(--line-strong); font-size: 0.94rem; }
.pv .compare-new { color: var(--fg); font-weight: 600; font-size: 0.94rem; }
.pv .compare-new::before { content: "→ "; color: var(--accent-2); }

.pv .change-grid { display: grid; gap: 1.2rem; grid-template-columns: 1fr; }
@media (min-width: 720px) { .pv .change-grid { grid-template-columns: 1fr 1fr; } }
.pv .change-item {
  display: flex; gap: 1.1rem; align-items: flex-start;
  background: var(--card); border: 1px solid var(--line); border-radius: 1.7rem;
  padding: 1.7rem;
}
.pv .change-item .mark {
  flex: none; width: 2.6rem; height: 2.6rem; border-radius: 0.9rem;
  background: var(--card-2); color: var(--accent-2); display: grid; place-items: center;
}
.pv .change-item h3 { font-family: var(--font-display); font-size: 1.12rem; font-weight: 600; line-height: 1.3; }
.pv .change-item p { margin-top: 0.5rem; color: var(--fg-soft); font-size: 0.94rem; }

.pv .example-grid { display: grid; gap: 1.1rem; grid-template-columns: 1fr; }
@media (min-width: 640px) { .pv .example-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1080px) { .pv .example-grid { grid-template-columns: repeat(3, 1fr); } }
.pv .example-card {
  background: var(--card); border: 1px solid var(--line); border-radius: 1.7rem;
  padding: 1.6rem; display: flex; flex-direction: column; gap: 0.7rem;
}
.pv .example-card .scenario {
  font-size: 0.66rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--accent-3);
}
.pv .example-card h3 { font-family: var(--font-display); font-size: 1.08rem; font-weight: 600; line-height: 1.3; }
.pv .example-card p { color: var(--fg-soft); font-size: 0.92rem; }

.pv .highlight { display: grid; gap: 3rem; align-items: center; }
@media (min-width: 960px) { .pv .highlight { grid-template-columns: 1fr 1fr; } }
.pv .highlight-copy .eyebrow { margin-bottom: 0.6rem; }
.pv .highlight-copy h2 { font-size: clamp(1.75rem, 3.2vw, 2.4rem); line-height: 1.14; }
.pv .highlight-copy p { margin-top: 1.1rem; color: var(--fg-soft); font-size: 1.02rem; }
.pv .highlight-list { margin-top: 1.4rem; display: grid; gap: 0.7rem; padding: 0; }
.pv .highlight-list li { list-style: none; display: flex; gap: 0.7rem; align-items: flex-start; color: var(--fg-soft); font-size: 0.95rem; }
.pv .highlight-list svg { flex: none; margin-top: 0.2rem; color: var(--accent-2); }

.pv .grid-photo { border-radius: 1.1rem; overflow: hidden; border: 1px solid var(--line); }
.pv .grid-photo img { width: 100%; height: 100%; display: block; }

.pv .ba-single { display: flex; align-items: center; gap: 1.2rem; max-width: 40rem; margin: 0 auto; }
@media (max-width: 640px) { .pv .ba-single { flex-direction: column; } }
.pv .ba-photo-lg {
  position: relative; flex: 1; aspect-ratio: 3/4; border-radius: 1.5rem; overflow: hidden;
  border: 1px solid var(--line); box-shadow: var(--shadow-soft); max-width: 20rem;
}
.pv .ba-photo-lg img { width: 100%; height: 100%; object-fit: cover; }
.pv .ba-photo-lg .tag {
  position: absolute; bottom: 0.7rem; left: 0.7rem;
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0.28rem 0.65rem; border-radius: 999px; color: var(--fg);
  background: rgba(23, 21, 29, 0.72);
}
.pv .ba-photo-lg.after .tag { background: var(--accent); color: var(--accent-ink); }
.pv .ba-arrow-lg { flex: none; color: var(--accent-2); }
@media (max-width: 640px) { .pv .ba-arrow-lg { transform: rotate(90deg); } }
.pv .ba-caption-lg { margin-top: 1.4rem; text-align: center; font-size: 0.92rem; color: var(--fg-soft); }

.pv .pricing-grid { display: grid; gap: 1.3rem; }
@media (min-width: 860px) { .pv .pricing-grid { grid-template-columns: repeat(3, 1fr); } }
.pv .plan {
  background: var(--card); border: 1px solid var(--line); border-radius: 1.9rem;
  padding: 2rem; display: flex; flex-direction: column; gap: 1.4rem;
}
.pv .plan.featured { border-color: var(--accent); box-shadow: var(--glow); position: relative; background: var(--card-2); }
.pv .plan.featured::before {
  content: "Mais escolhido"; position: absolute; top: -0.75rem; left: 2rem;
  background: var(--accent); color: var(--accent-ink); font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase; padding: 0.32rem 0.75rem; border-radius: 999px;
}
.pv .plan-name { font-family: var(--font-display); font-size: 1.35rem; font-weight: 600; }
.pv .plan-price { display: flex; align-items: baseline; gap: 0.4rem; }
.pv .plan-price .amount { font-family: var(--font-display); font-size: 2.3rem; font-weight: 620; }
.pv .plan-price .period { color: var(--fg-faint); font-size: 0.85rem; }
.pv .plan-tokens { font-size: 0.88rem; color: var(--accent-2); font-weight: 600; }
.pv .plan hr { border: none; border-top: 1px solid var(--line); margin: 0; }
.pv .plan-features { display: grid; gap: 0.55rem; padding: 0; }
.pv .plan-features li { list-style: none; display: flex; gap: 0.6rem; font-size: 0.9rem; color: var(--fg-soft); }
.pv .plan-features svg { flex: none; color: var(--accent-2); margin-top: 0.15rem; }
.pv .plan .btn { margin-top: auto; }

.pv .guarantee { margin-top: 2rem; display: flex; align-items: center; justify-content: center; gap: 0.6rem; text-align: center; color: var(--fg-soft); font-size: 0.92rem; }

.pv .closing { text-align: center; padding: 5.5rem 0; }
.pv .closing h2 { font-size: clamp(2.1rem, 4.8vw, 3.2rem); max-width: 42rem; margin: 0 auto; line-height: 1.12; }
.pv .closing .hero-ctas { justify-content: center; margin-top: 2.2rem; }

.pv .steps { display: grid; gap: 2.2rem; counter-reset: step; }
@media (min-width: 800px) { .pv .steps { grid-template-columns: repeat(3, 1fr); } }
.pv .step { position: relative; padding-top: 3.4rem; }
.pv .step::before {
  counter-increment: step; content: counter(step, decimal-leading-zero);
  font-family: var(--font-display); font-size: 1.4rem; font-weight: 560; color: var(--accent);
  display: block; position: absolute; top: 0; left: 0;
}
.pv .step h3 { font-size: 1.1rem; font-weight: 620; font-family: var(--font-display); margin-bottom: 0.6rem; }
.pv .step p { color: var(--fg-soft); font-size: 0.95rem; }

.pv footer { border-top: 1px solid var(--line); padding: 2.6rem 0; }
.pv .footer-row { display: flex; flex-direction: column; gap: 1.2rem; }
@media (min-width: 700px) { .pv .footer-row { flex-direction: row; align-items: center; justify-content: space-between; } }
.pv .footer-brand { display: flex; flex-direction: column; gap: 0.35rem; }
.pv .footer-tag { color: var(--fg-faint); font-size: 0.85rem; }
.pv .footer-copy { color: var(--fg-faint); font-size: 0.82rem; }

.pv .whatsapp-fab {
  position: fixed; right: 1.3rem; bottom: 1.3rem; z-index: 50;
  width: 3.4rem; height: 3.4rem; border-radius: 999px;
  background: #25D366; color: #0b1a10;
  display: grid; place-items: center;
  box-shadow: 0 10px 26px -8px rgba(37, 211, 102, 0.55), 0 4px 10px rgba(0,0,0,0.35);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.pv .whatsapp-fab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 14px 32px -8px rgba(37, 211, 102, 0.65), 0 4px 10px rgba(0,0,0,0.35); }
.pv .whatsapp-fab:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 3px; }

.pv .reveal { animation: pv-rise 0.7s ease both; }
@keyframes pv-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .pv .reveal { animation: none; } }
`;
