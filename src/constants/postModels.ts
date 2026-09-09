// Modelos de carrossel para a tela /divulgar.
//
// Um carrossel tem duas partes: a ESTRUTURA (quantos slides, o que entra em
// cada um, quantas cenas de IA e quantas provas reais) e o CONTEÚDO (as
// frases). Antes as duas estavam grudadas dentro de `montarPedido`, então
// existir um segundo formato significava um segundo `if` atravessando a
// função inteira.
//
// Aqui a estrutura vira dado. Cada modelo diz seus passos, e o mesmo laço
// monta qualquer um deles; a mesma descrição também entra no pedido do
// roteiro, para o texto vir na quantidade e na ordem que o modelo espera.
// Um modelo novo é uma entrada nesta lista — não um caminho novo no código.
//
// O que NÃO varia por modelo: a chamada final (repetir treina quem acompanha
// a conta) e a regra de que a prova sai de geração real, nunca desenhada.

/**
 * De onde sai a imagem de cada slide.
 *
 * - `cena`  — imagem criada pela IA a partir do roteiro. Custa 1 crédito.
 * - `par`   — o antes/depois lado a lado, de uma geração real escolhida.
 * - `antes` / `depois` — só uma das metades desse par, em tela cheia.
 */
export type PassoTipo = "hook" | "cena" | "par" | "antes" | "depois";

export interface Passo {
  tipo: PassoTipo;
  /** Índice da cena (para `hook` é o fundo velado) ou do par escolhido. */
  indice?: number;
}

export interface ModeloCarrossel {
  id: string;
  label: string;
  /** Uma linha explicando para que serve, mostrada na escolha. */
  resumo: string;
  /** Quantas imagens a IA precisa criar. É o custo em créditos. */
  cenas: number;
  /** Quantos antes/depois reais o dono precisa escolher. */
  pares: number;
  passos: Passo[];
  /** Vai dentro do pedido do roteiro: o que escrever em cada slide. */
  instrucao: string;
}

export const MODELOS: ModeloCarrossel[] = [
  {
    id: "historia",
    label: "História",
    resumo: "Atrito, perda, prova e virada. O que mais prende até o fim.",
    cenas: 2,
    pares: 1,
    passos: [
      { tipo: "hook", indice: 0 },
      { tipo: "cena", indice: 0 },
      { tipo: "par", indice: 0 },
      { tipo: "cena", indice: 1 },
    ],
    instrucao: `
  slide 1 — o gancho: o atrito que o lojista reconhece na hora
  slide 2 — a perda: por que isso custa venda
  slide 3 — a prova (a tela já tem a imagem; escreva só o texto)
  slide 4 — a virada: como fica depois

  Escreva 2 cenas: a primeira é a dor (slides 1 e 2), a segunda é o alívio
  (slide 4). A mesma pessoa nas duas, em momentos diferentes.`,
  },
  {
    id: "erros",
    label: "Lista de erros",
    resumo: "Três erros que travam a venda. Rende salvamento e compartilhamento.",
    cenas: 3,
    pares: 0,
    passos: [
      { tipo: "hook", indice: 0 },
      { tipo: "cena", indice: 0 },
      { tipo: "cena", indice: 1 },
      { tipo: "cena", indice: 2 },
    ],
    instrucao: `
  slide 1 — o gancho: anuncie a lista ("3 erros que fazem a peça encalhar")
  slide 2 — erro 1
  slide 3 — erro 2
  slide 4 — erro 3

  Cada erro é concreto e do dia a dia da loja, não conselho genérico. O chapéu
  numera ("ERRO 1"), a manchete diz o erro em uma frase.

  Escreva 3 cenas, uma por erro, mostrando a situação do erro acontecendo.
  A mesma pessoa nas três.`,
  },
  {
    id: "passo-a-passo",
    label: "Como funciona",
    resumo: "Os três passos, terminando no resultado real. Para quem ainda não entendeu o app.",
    cenas: 1,
    pares: 1,
    passos: [
      { tipo: "hook", indice: 0 },
      { tipo: "antes", indice: 0 },
      { tipo: "cena", indice: 0 },
      { tipo: "depois", indice: 0 },
    ],
    instrucao: `
  slide 1 — o gancho: prometa que são três passos
  slide 2 — passo 1: a foto que a cliente manda (a imagem já é essa foto real)
  slide 3 — passo 2: escolher a peça da loja
  slide 4 — passo 3: o resultado pronto (a imagem já é o resultado real)

  O chapéu numera ("PASSO 1"), a manchete diz a ação em poucas palavras.

  Escreva 1 cena só, para o slide 3: alguém escolhendo uma peça no celular ou
  na arara da loja.`,
  },
  {
    id: "vitrine",
    label: "Vitrine de provas",
    resumo: "Três antes/depois reais em sequência. Não gasta crédito nenhum.",
    cenas: 0,
    pares: 3,
    passos: [
      { tipo: "hook", indice: 0 },
      { tipo: "par", indice: 0 },
      { tipo: "par", indice: 1 },
      { tipo: "par", indice: 2 },
    ],
    instrucao: `
  slide 1 — o gancho: uma frase que faça querer ver os resultados
  slide 2 — a primeira prova
  slide 3 — a segunda prova
  slide 4 — a terceira prova

  Os slides 2, 3 e 4 já têm imagem (antes/depois reais); escreva só o texto, e
  cada um com uma frase DIFERENTE — três variações de "olha o resultado" seria
  o mesmo slide três vezes.

  Não escreva cena nenhuma: devolva "cenas": [].`,
  },
];

export const MODELO_PADRAO = MODELOS[0];

export function modeloPorId(id: string): ModeloCarrossel {
  return MODELOS.find((m) => m.id === id) ?? MODELO_PADRAO;
}
