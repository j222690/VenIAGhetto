# StyleDesk AI

**SaaS B2B para lojas de moda.** A loja se cadastra, monta sua equipe, cadastra o
catálogo de peças e seus clientes (CRM), e usa o **Provador com IA** para gerar a
foto de um cliente vestindo uma peça do catálogo — além de scanner de ficha de
produto e criador de posts. O consumidor final **não** faz login; tudo é da loja.

> **Status: MVP navegável e clicável.** Todo o fluxo funciona de ponta a ponta
> (cadastro, catálogo, clientes, provador, tokens, histórico, álbum). As
> integrações de **IA (geração de imagem)** e **pagamento** ainda são simuladas —
> cada ponto está marcado no código com `// TEMPORÁRIO`. Ver "O que é provisório".

---

## Como rodar localmente

Pré-requisitos: Node 20+ e um projeto no [Supabase](https://supabase.com).

```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev               # abre em http://localhost:5173
```

No **SQL Editor** do Supabase, rode as migrations em ordem (uma vez cada):

```
supabase/migrations/0001_init.sql                 -- schema base (lojas, usuários, RLS)
supabase/migrations/0002_profile_and_favorites.sql
supabase/migrations/0003_invites_and_clients.sql
supabase/migrations/0004_catalog.sql
supabase/migrations/0005_storage.sql              -- buckets de imagem (upload)
```

## Stack

- **React 19** + **TanStack Router/Start** (SSR) + **Vite**
- **Tailwind CSS v4** (tema centralizado em `src/styles.css` — ver `THEME.md`)
- **Supabase** — Auth, Postgres (com **RLS multi-tenant por loja**) e Storage
- **TypeScript** estrito (sem `any`)

## Arquitetura

Arquitetura limpa: nenhuma regra de negócio nas telas — tudo passa pela camada de
**Services**.

```
src/
  routes/         Telas (home, tryon, catalog, clients, album, history, profile, settings…)
  services/       Regra de negócio (Store, User, Invite, Client, Catalog, Generation, Token, Storage…)
    _temp/        Dados/imagens fictícios isolados (marcados // TEMPORÁRIO)
  components/     UI reutilizável (+ ui/ = primitivas shadcn)
  integrations/   Cliente Supabase, tipos do banco e mappers
  constants/      Planos e permissões (papéis owner/manager/seller)
supabase/migrations/   Todo o schema + RLS (idempotente)
```

## Funcionalidades

- **Loja & equipe** — perfil da loja, papéis (Dono/Gerente/Vendedor), convites de
  funcionário (quem entra por convite não cria loja nova).
- **Clientes (CRM)** — cadastro simples + **pasta por cliente** (galeria de todos
  os looks gerados para ele).
- **Catálogo** — peças com foto (upload real via Storage), preço, categoria, SKU.
- **Provador** — cliente → foto → peça → gerar → resultado (placeholder) →
  favoritar / salvar / baixar / compartilhar.
- **Scanner** e **Criador de Posts** — clicáveis, com resultado de exemplo.
- **Tokens** — débito real por geração + extrato; bloqueio sem saldo.
- **Histórico & Álbum** — leem do banco; histórico mostra cliente e peça.

## O que é provisório (`// TEMPORÁRIO`)

Estes pontos dependem de integrações externas e estão isolados/marcados:

1. **IA da geração de imagem** (Gemini/Imagen) — ponto único em
   `src/services/GenerationService.ts` (`generate()`).
2. **Scanner (visão por IA)** — `src/services/ProductService.ts`.
3. **Pagamento** — `src/services/PaymentService.ts` (hoje ativa um trial fake).
4. **Dados de exemplo** — `src/services/_temp/` (some quando o banco tem dados reais).

## Segurança (multi-tenant)

Cada loja só enxerga os próprios dados: **RLS por loja** em todas as tabelas e
**isolamento por loja no Storage** (o caminho do arquivo começa com o `store_id`).
