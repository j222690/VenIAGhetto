# Vest Ai — como trabalhar neste repositório

## Testar no navegador, sempre

Toda mudança que o lojista enxerga é testada **no app rodando**, não só por
tipagem e build. Isso vale para fluxo, página, botão, formulário — tudo.

A ferramenta é o [`agent-browser`](https://github.com/vercel-labs/agent-browser)
(já instalado globalmente):

```bash
npm run dev                                   # em outra aba
agent-browser open http://localhost:3000/login
agent-browser snapshot                        # árvore de acessibilidade com refs
agent-browser fill '@e8' 'victor@styledesk.app'
agent-browser fill '@e9' '<senha do .env>'
agent-browser click '@e5'
agent-browser get url                         # confere que chegou onde devia
agent-browser screenshot ./shot.png
agent-browser close
```

**Use `snapshot` antes de clicar.** Ele devolve os elementos reais da página
com um `@ref` estável. Adivinhar seletor CSS já custou caro aqui: `input[type="text"]`
não casa com campo que não declara o `type`, e `button[type="submit"]` não casa
com botão sem `type`.

**Espere a hidratação.** O app é TanStack Start: o HTML chega antes do React
assumir, e um clique nesse intervalo não faz nada — sem erro nenhum, o que é
pior. Depois de `open`, dê alguns segundos antes de interagir.

**Teste no publicado quando o assunto for cabeçalho HTTP.** A
Content-Security-Policy vem do `vercel.json` e não existe em `localhost` — uma
imagem de domínio externo carrega no local e é bloqueada em produção. Já
aconteceu: duas peças de catálogo entraram com foto invisível.

Rodar contra produção: `agent-browser open https://vestaiapp.com/...`.

## Contas de teste

`.env` tem `TEST_EMAIL` e `TEST_PASSWORD` (conta real do dono, loja Ghetto
Elite). O arquivo é ignorado pelo git.

Gerar imagem **gasta crédito de verdade**. Peça autorização antes de testar
um caminho que gera, e prefira os que não geram (montagem no canvas, leitura
de catálogo, navegação).

Ao criar conta descartável no teste, apague-a no fim — inclusive a loja, que
não cai em cascata quando o usuário é removido.

## Onde as coisas ficam

- Edge Functions em `supabase/functions/` — vão para o ar por
  `npx supabase functions deploy <nome> --project-ref vjjbihptzgxptyhzaftp`,
  não pelo git.
- Migrations em `supabase/migrations/`, aplicadas uma vez pelo SQL Editor ou
  por `npx supabase db query --linked --file <arquivo>`.
- O app em si publica pela Vercel a cada push na `main`.
