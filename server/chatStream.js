/**
 * Streaming da resposta do Mentor (Server-Sent Events).
 *
 * ------------------------------------------------------------------
 * POR QUE
 * ------------------------------------------------------------------
 * Sem streaming, o aluno olha "Sagui está digitando" até a resposta
 * inteira ficar pronta: 5 a 10 segundos numa explicação longa. Com os
 * pedaços chegando, a primeira frase aparece em menos de 2 s (#38).
 *
 * ------------------------------------------------------------------
 * O FORMATO QUE O APP RECEBE
 * ------------------------------------------------------------------
 * Um evento por linha `data:`, sempre JSON, independente do provedor:
 *
 *   data: {"tipo":"delta","texto":"Boa pergunta! "}
 *   data: {"tipo":"fim","texto":"<resposta inteira, limpa>", ...metadados}
 *   data: {"tipo":"erro","mensagem":"..."}
 *
 * O `fim` traz o texto completo de novo: o app troca o que montou pelos
 * deltas pela versão final, então um pedaço perdido no caminho não
 * deixa a resposta salva com buraco.
 *
 * ------------------------------------------------------------------
 * O BLOCO `frustracao`
 * ------------------------------------------------------------------
 * O modelo pode terminar a resposta com um bloco ```frustracao``` que
 * nunca deve aparecer na tela (ver chatPrompt.js). Sem streaming, ele
 * era cortado no fim. Com streaming, o começo do bloco poderia sair num
 * delta antes de o servidor saber o que era. `criarFiltroFrustracao`
 * segura qualquer final de texto que ainda possa virar o começo do
 * bloco, e só solta quando tem certeza.
 */

import { extrairSinalFrustracao } from './chatPrompt.js';

const MARCADOR = '```frustracao';

/**
 * Filtro incremental. `empurrar(trecho)` devolve o que já é seguro
 * mostrar; `finalizar()` devolve o resto e o sinal de frustração.
 * Função pura, testável sem rede.
 */
export function criarFiltroFrustracao() {
  let bruto = '';
  let emitido = 0;

  /** Texto exibível até agora (blocos completos e o bloco aberto removidos). */
  function seguro() {
    let texto = bruto.replace(/```frustracao[\s\S]*?```/gi, '');
    const aberto = texto.toLowerCase().indexOf(MARCADOR);
    if (aberto >= 0) return texto.slice(0, aberto);
    // Final que ainda pode ser o começo do marcador ("`", "``", "```fru"...).
    for (let n = Math.min(MARCADOR.length - 1, texto.length); n > 0; n--) {
      if (MARCADOR.startsWith(texto.slice(-n).toLowerCase())) return texto.slice(0, -n);
    }
    return texto;
  }

  return {
    empurrar(trecho) {
      bruto += String(trecho ?? '');
      const s = seguro();
      // Se um bloco fechou no meio, o texto seguro pode encolher para
      // antes do que já saiu: nesse caso não há nada novo a mandar.
      if (s.length <= emitido) return '';
      const novo = s.slice(emitido);
      emitido = s.length;
      return novo;
    },
    finalizar() {
      const { textoLimpo, frustrationDetected } = extrairSinalFrustracao(bruto);
      return { textoLimpo, frustrationDetected, bruto };
    },
  };
}

/**
 * Leitor de SSE: recebe pedaços de texto em qualquer corte e devolve o
 * campo `data` de cada evento completo. Pedaço que termina no meio de
 * uma linha fica guardado até a próxima chamada.
 */
export function criarLeitorSSE() {
  let resto = '';
  function processar(texto, fim) {
    resto += texto;
    const eventos = [];
    const linhas = resto.split(/\r?\n/);
    resto = fim ? '' : linhas.pop() ?? '';
    for (const linha of linhas) {
      if (linha.startsWith('data:')) eventos.push(linha.slice(5).trimStart());
    }
    return eventos;
  }
  return {
    empurrar: (texto) => processar(texto, false),
    finalizar: () => processar('\n', true),
  };
}

/** Linha SSE com um objeto JSON. */
export function eventoSSE(objeto) {
  return `data: ${JSON.stringify(objeto)}\n\n`;
}

/**
 * Lê o corpo de uma resposta SSE do provedor e chama `aoEvento` com cada
 * `data` já decodificado como JSON (linhas que não são JSON, como o
 * `[DONE]` do DeepSeek, são ignoradas).
 */
export async function lerSSE(corpo, aoEvento) {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  const sse = criarLeitorSSE();
  const despachar = (dados) => {
    for (const d of dados) {
      try {
        aoEvento(JSON.parse(d));
      } catch {
        /* [DONE] e linhas de manutenção */
      }
    }
  };
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    despachar(sse.empurrar(decodificador.decode(value, { stream: true })));
  }
  despachar(sse.finalizar());
}

/** Trecho de texto de um evento de streaming do Gemini. */
export function trechoGemini(evento) {
  const partes = evento?.candidates?.[0]?.content?.parts;
  return Array.isArray(partes) ? partes.map((p) => p?.text || '').join('') : '';
}

/** Trecho de texto de um evento de streaming do DeepSeek (formato OpenAI). */
export function trechoDeepSeek(evento) {
  const c = evento?.choices?.[0]?.delta?.content;
  return typeof c === 'string' ? c : '';
}
