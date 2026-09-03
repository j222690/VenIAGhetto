// O que o assistente sabe sobre o Vest Ai.
//
// Fica no cliente e é enviado ao servidor a cada pergunta, em vez de morar na
// Edge Function, por um motivo prático: quem muda uma tela mexe neste arquivo
// no mesmo commit. Numa função separada, a base envelheceria calada — o
// assistente seguiria ensinando um caminho que não existe mais.
//
// REGRA AO EDITAR: escreva só o que o app FAZ hoje. Uma linha errada aqui é
// pior que uma linha faltando: faltando, ele diz que não sabe e manda falar
// com o suporte; errada, ele ensina o lojista a fazer o que não funciona.

import { SUPPORT_PHONE_LABEL } from "@/constants/contact";
import { MAX_GARMENTS } from "@/constants/lookOptions";

export const APP_KNOWLEDGE = `
# O que é o Vest Ai

Um provador virtual por IA para lojas de moda. A lojista usa a foto de um
cliente e o app mostra essa mesma pessoa vestindo as peças da loja. Serve para
vender pelo WhatsApp e pelo Instagram sem a pessoa ir até a loja provar, e para
montar imagens do catálogo sem ensaio fotográfico.

# Telas

- **Início**: saldo de créditos, atalhos e avisos.
- **Provador**: onde se veste um cliente. É a tela principal.
- **Clientes**: fichas dos clientes, com as fotos de cada um.
- **Catálogo**: as peças que a loja vende.
- **Álbum**: tudo o que já foi gerado. O ♥ marca favorito.
- **Criador de Posts**: imagem pronta para publicar, com legenda escrita pela IA.
- **Scanner**: lê a foto de uma peça e devolve a ficha (nome, categoria, preço estimado).
- **Ajustes** e **Perfil da loja**: plano, equipe, dados da loja.

# Provador, passo a passo

1. Escolher o cliente (opcional) ou enviar a foto direto.
2. Enviar o look. O melhor resultado vem de UMA foto do look inteiro, com as
   peças já combinadas. Também funciona com até ${MAX_GARMENTS} peças em fotos
   separadas — acima disso o app não aceita, e o caminho é a foto do look inteiro.
3. Opcional: tamanho, caimento e comprimento; mudar o fundo/cenário; refinar.
4. Gerar. Custa 1 crédito, seja 1 peça ou ${MAX_GARMENTS}.

Também existe o modo **Grade de looks**, que compara até ${MAX_GARMENTS} looks
completos diferentes numa imagem só.

# Quanto custa cada coisa

1 crédito = 1 geração de imagem. Todas custam o mesmo:
- vestir um look no Provador (1 crédito, não importa o número de peças)
- criar um post (1 crédito)
- refinar/mudar o cenário de uma imagem já gerada (1 crédito)
- limpar a foto de uma peça no catálogo (1 crédito)
- criar corpo inteiro a partir de foto de meio corpo (1 crédito)
- scanner de peça (1 crédito)

Importar catálogo por link cobra por item importado.

# Planos

- Starter: R$ 97/mês, 149 gerações
- Pro: R$ 197/mês, 303 gerações
- Business: R$ 397/mês, 610 gerações

Quem cria a loja ganha **7 dias de teste com 35 créditos**, sem cartão. Os
créditos entram de uma vez e podem ser usados quando quiser dentro do período.

# Como a geração funciona

A imagem é criada em segundo plano, no servidor. O lojista pode **fechar o app**:
quando fica pronta, chega uma notificação e o toque nela abre direto o resultado.
As notificações precisam ser ligadas uma vez, pelo aviso na tela inicial.

O tempo normal é **menos de um minuto**. Às vezes passa disso porque o serviço de
IA fica mais lento — a tela avisa e a geração continua rodando. Se falhar, o
crédito volta sozinho.

# Criar corpo

Quando a foto do cliente é de meio corpo, o Provador não tem as pernas para
vestir. O "Criar corpo inteiro" completa a foto. Antes de cobrar, o app confere
o enquadramento: se a foto já mostra o corpo todo, ele avisa e **não gasta
crédito**; se estiver cortada acima da cintura, também recusa, porque teria de
inventar quase tudo. O ideal é foto da cintura para cima.

# Catálogo

Peças podem ser cadastradas uma a uma ou importadas de um link de loja online.
A importação lê a página e traz nome, categoria, preço e foto.

O Instagram **não** funciona na importação por link: ele bloqueia o acesso do
nosso servidor. Sites de lojas grandes às vezes também bloqueiam.

"Limpar peça" gera uma versão da foto só com a peça, sem fundo e sem modelo.
Melhora o resultado no Provador.

# Fotos que dão bom resultado

- Peça: esticada e de frente, boa luz, com fecho, botões e bolsos visíveis.
  Peça dobrada ou de lado faz a IA inventar o que ficou escondido.
- Cliente: de corpo inteiro, de frente, corpo todo visível.
- Look inteiro: as peças já combinadas, como devem aparecer.

# Equipe

A loja pode convidar outras pessoas. O dono é quem muda o perfil da loja, o
plano e exclui clientes; gerentes e vendedores fazem o resto.

# Suporte humano

WhatsApp ${SUPPORT_PHONE_LABEL}.
`.trim();

// Perguntas que abrem a tela de Ajuda. Escolhidas pelo que o lojista pergunta
// primeiro — custo e "por que demorou" antes de qualquer coisa avançada.
export const PERGUNTAS_FREQUENTES = [
  "O que é um crédito e quanto gasta cada coisa?",
  "Como faço um look no Provador?",
  "Que foto da peça dá o melhor resultado?",
  "A geração demorou. É normal?",
  "Como funciona o teste grátis?",
  "Posso fechar o app enquanto gera?",
  "Como importo meu catálogo?",
  "Minha cliente só tem foto de meio corpo. E agora?",
];
