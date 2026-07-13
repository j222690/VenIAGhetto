# THEME — StyleDesk AI

A identidade visual do app vive em **pouquíssimos arquivos**. Para rebrandear
(trocar cores, fontes ou o conjunto de ícones), mexa apenas aqui.

## 1. Cores, raios, sombras → `src/styles.css`

Tudo é definido como **design token** (CSS custom properties) em
[src/styles.css](src/styles.css), em três blocos:

- `@theme inline { … }` — expõe os tokens ao Tailwind v4 (gera as classes
  utilitárias `bg-primary`, `text-muted-foreground`, `border-border`,
  `bg-clay`, `shadow-soft`, `rounded-3xl`, etc.).
- `:root { … }` — os **valores reais** do tema claro (em `oklch`).
- `.dark { … }` — os valores do tema escuro.

Tokens semânticos disponíveis: `background`, `foreground`, `card`, `popover`,
`primary`, `secondary`, `muted`, `accent`, `clay` (terracota — o destaque da
marca), `cream`, `charcoal`, `destructive`, `border`, `input`, `ring`. Mais
raios (`--radius` e derivados) e sombras (`--shadow-soft`, `--shadow-elevated`).

**Para rebrandear:** altere os valores em `:root` (e `.dark`). Como o app inteiro
referencia os tokens por nome, a troca propaga sozinha. Ex.: mudar o destaque da
marca = trocar `--accent` / `--clay` em `:root`.

> Nunca escreva cor "na mão" (`#hex`, `rgb(...)`, ou classes como `bg-blue-500`)
> no código de tela. Use sempre uma classe de token (`bg-clay`, `text-foreground`,
> `border-border`). Auditoria confirma 0 cores hardcoded na camada de telas.

## 2. Fontes → `src/styles.css`

Definidas no `@theme inline`:

- `--font-display: "Fraunces", …` — títulos (`h1/h2/h3` e a classe `.font-display`).
- `--font-sans: "Inter", …` — corpo de texto (aplicada em `html, body`).

Troque a fonte mudando essas duas variáveis (e o `<link>`/`@import` da fonte, se houver).

## 3. Ícones → `src/lib/icons.ts`

Toda a camada de telas/componentes importa ícones de
[src/lib/icons.ts](src/lib/icons.ts) — **nunca** direto de `lucide-react`:

```ts
import { Heart, Share2, MapPin } from "@/lib/icons";
```

`icons.ts` é um barrel que re-exporta a biblioteca de ícones atual
(`lucide-react`). **Para trocar o conjunto de ícones** do app inteiro, reaponte
os re-exports nesse arquivo para a nova biblioteca (mantendo os mesmos nomes) —
nenhuma tela precisa mudar.

### Exceções documentadas (intencionais)

- `src/components/ui/*` (primitivas shadcn) importam `lucide-react`
  diretamente. São blocos de base "de terceiros", fortemente acoplados aos
  próprios ícones; ficam fora do barrel de propósito.
- `src/lib/error-page.ts` usa HTML/CSS **autocontido** com cores literais
  (`#111`, `#fafafa`, …). É a tela de erro de fallback, renderizada quando o
  CSS/tokens do app podem não ter carregado — por isso não depende dos tokens.
