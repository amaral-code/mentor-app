/**
 * Geração de quiz em LOTES.
 *
 * ==================================================================
 * OS DOIS BUGS QUE ESTE ARQUIVO RESOLVE
 * ==================================================================
 *
 * 1. "Às vezes não gera, dependendo das questões"
 * ------------------------------------------------------------------
 * O pedido usava `maxOutputTokens = count * 500` e o back-end limita a
 * saída a 8192 tokens (`limitarGenerationConfig`, em server/worker.js).
 * A conta estourava o teto silenciosamente:
 *
 *     10 questões -> 5.000 tokens  (apertado: 10 questões ENEM com
 *                                   contexto, 4 alternativas, explicação
 *                                   e dica dão ~4.500-5.500)
 *     17 questões -> 8.500 tokens  -> CORTADO em 8.192
 *     30 questões -> 15.000 tokens -> CORTADO em 8.192
 *
 * Cortado no meio, o JSON fica inválido. E o parser não recuperava nada:
 * `JSON.parse` falhava no array inteiro e o app recebia lista vazia.
 * Daí o sintoma ser intermitente e "depender das questões" - questão
 * difícil é mais longa, então estoura antes.
 *
 * 2. "Demorando demais"
 * ------------------------------------------------------------------
 * Um único pedido de 30 questões é uma geração de milhares de tokens,
 * sequencial por natureza: o modelo escreve token a token e não há como
 * paralelizar dentro de uma chamada.
 *
 * ==================================================================
 * A SOLUÇÃO: LOTES PEQUENOS EM PARALELO
 * ==================================================================
 * Dividir 30 questões em 4 lotes de 7-8 e pedir os lotes ao mesmo tempo
 * ataca os dois problemas de uma vez:
 *
 *   - cada lote cabe folgado no teto, então não trunca;
 *   - os lotes correm em paralelo, então o tempo total é o do lote mais
 *     lento, não a soma de todos;
 *   - se um lote falhar, os outros ainda entregam. Antes era tudo ou
 *     nada.
 *
 * A concorrência é limitada de propósito: disparar 10 chamadas juntas
 * convida o 429 (limite de taxa) do provedor, e aí o retry devolveria a
 * lentidão pela porta dos fundos.
 */

/** Teto de saída imposto pelo back-end (`limitarGenerationConfig`). */
export const QUIZ_TETO_TOKENS_SERVIDOR = 8192;

/**
 * Orçamento por questão.
 *
 * Medido pelo pior caso real: enunciado com contexto (~150 tokens), 4
 * alternativas (~80), explicação (~80), dica (~30), tema/fonte/nível
 * (~25) e a papelada do JSON. 500 era otimista demais - era o que
 * truncava a questão difícil, que é a mais longa.
 */
export const QUIZ_TOKENS_POR_QUESTAO = 700;

/** Questões por lote. 8 x 700 + folga = 6.000, bem abaixo do teto. */
export const QUIZ_LOTE_MAX = 8;

/** Lotes simultâneos. Acima disso o provedor começa a responder 429. */
export const QUIZ_LOTES_SIMULTANEOS = 3;

/**
 * Divide um total em lotes equilibrados.
 *
 * Equilibrado, e não "cheios + resto", porque o tempo total é o do lote
 * MAIS LENTO: 30 em [8,8,8,6] termina depois de 30 em [8,8,7,7], já que
 * o lote de 8 demora mais que o de 7.
 */
export function planoDeLotes(total: number, tetoPorLote: number = QUIZ_LOTE_MAX): number[] {
  const n = Math.max(0, Math.floor(total || 0));
  if (n === 0) return [];
  const teto = Math.max(1, Math.floor(tetoPorLote));
  if (n <= teto) return [n];

  const quantos = Math.ceil(n / teto);
  const base = Math.floor(n / quantos);
  const resto = n % quantos;
  return Array.from({ length: quantos }, (_, i) => base + (i < resto ? 1 : 0));
}

/**
 * Orçamento de saída de um lote, garantidamente dentro do teto.
 *
 * O `Math.min` existe para o pedido nunca mais ser cortado pelo servidor
 * sem aviso - era exatamente essa a falha silenciosa.
 */
export function tokensParaLote(questoes: number): number {
  const n = Math.max(1, Math.floor(questoes || 1));
  return Math.min(QUIZ_TETO_TOKENS_SERVIDOR, n * QUIZ_TOKENS_POR_QUESTAO + 400);
}

/**
 * Extrai os objetos JSON COMPLETOS de uma lista, mesmo truncada no fim.
 *
 * É o que salva a geração quando o modelo é cortado no limite de tokens:
 * de `[{...},{...},{"enun` saem os dois objetos inteiros e o pedaço
 * incompleto é descartado. O aluno recebe 7 de 10 questões em vez de um
 * erro.
 *
 * ------------------------------------------------------------------
 * POR QUE A VARREDURA COMEÇA NA PRIMEIRA `[`
 * ------------------------------------------------------------------
 * Há dois envelopes possíveis, e os dois precisam funcionar:
 *
 *     [{...}, {...}                  <- array direto
 *     {"questoes":[{...}, {...}      <- objeto embrulhando o array
 *
 * O segundo é o do DeepSeek, que responde em modo `json_object` e por
 * isso SEMPRE embrulha. Uma varredura que só pegasse objetos no nível
 * mais externo falharia exatamente aí: truncado, o `{` externo nunca
 * fecha, e as questões de dentro ficariam invisíveis.
 *
 * Entrando na primeira `[`, os elementos da lista caem no nível 1 nos
 * dois casos, e objetos aninhados DENTRO de uma questão não são
 * capturados duas vezes.
 *
 * As chaves são contadas respeitando string e escape - sem isso, uma
 * chave dentro de um enunciado (`"o conjunto {1,2}"`) desalinharia a
 * contagem e estragaria objetos válidos.
 */
export function objetosJsonCompletos(texto: string): string[] {
  const achados: string[] = [];
  let profundidade = 0;
  let inicio = -1;
  let emString = false;
  let escapado = false;
  /* Antes da lista, só procuramos a `[` de abertura - mas já respeitando
     string, para uma `[` escrita dentro de um enunciado não ser confundida
     com o início da lista. */
  let naLista = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (emString) {
      if (escapado) escapado = false;
      else if (c === '\\') escapado = true;
      else if (c === '"') emString = false;
      continue;
    }

    if (c === '"') {
      emString = true;
      continue;
    }

    if (!naLista) {
      if (c === '[') naLista = true;
      continue;
    }

    if (c === '{') {
      if (profundidade === 0) inicio = i;
      profundidade++;
    } else if (c === '}') {
      if (profundidade > 0) {
        profundidade--;
        if (profundidade === 0 && inicio >= 0) {
          achados.push(texto.slice(inicio, i + 1));
          inicio = -1;
        }
      }
    }
  }

  return achados;
}

/**
 * Executa `tarefa` sobre os itens com no máximo `limite` em voo.
 *
 * Nunca rejeita: devolve `{ valor }` ou `{ erro }` por item, para o
 * chamador poder aproveitar os lotes que deram certo. Um `Promise.all`
 * puro jogaria fora 3 lotes bons por causa de 1 ruim - de novo o
 * comportamento "tudo ou nada" que este arquivo existe para remover.
 */
export async function emParalelo<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
): Promise<{ valor?: R; erro?: unknown }[]> {
  const saida: { valor?: R; erro?: unknown }[] = new Array(itens.length);
  let proximo = 0;

  const trabalhador = async () => {
    for (;;) {
      const i = proximo++;
      if (i >= itens.length) return;
      try {
        saida[i] = { valor: await tarefa(itens[i], i) };
      } catch (erro) {
        saida[i] = { erro };
      }
    }
  };

  const quantos = Math.max(1, Math.min(Math.floor(limite) || 1, itens.length));
  await Promise.all(Array.from({ length: quantos }, trabalhador));
  return saida;
}
