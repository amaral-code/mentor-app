/**
 * Cliente do chat em streaming (SSE) de `/api/chat/completions`.
 *
 * O servidor manda `delta` com cada pedaço e um `fim` com a resposta
 * inteira e limpa (formato em server/chatStream.js). Aqui o app recebe
 * o texto parcial a cada pedaço, para pintar a bolha enquanto o modelo
 * escreve, e a resposta final para salvar.
 *
 * Sem DOM: o `fetch` vem por parâmetro. No celular é o `expo/fetch`, o
 * único que entrega o corpo em pedaços no React Native; o `fetch` global
 * de lá só devolve o corpo inteiro no fim. Se o corpo não tiver leitor,
 * a função lê tudo de uma vez e o app ainda funciona, só sem a animação.
 */

export interface FonteChat {
  titulo: string;
  uri: string;
  dominio: string;
}

export interface FimChat {
  texto: string;
  frustrationDetected: boolean;
  fontes: FonteChat[];
  consultas: string[];
  groundingUsado: boolean;
  citouProva: boolean;
  modo: string;
}

/**
 * Leitor de SSE: devolve o `data` de cada evento completo. Pedaço que
 * termina no meio de uma linha fica guardado para a próxima chamada.
 * (O servidor tem a mesma função em JS puro: o worker não importa TS.)
 */
export function criarLeitorSSE(): { empurrar(texto: string): string[]; finalizar(): string[] } {
  let resto = '';
  const processar = (texto: string, fim: boolean): string[] => {
    resto += texto;
    const linhas = resto.split(/\r?\n/);
    resto = fim ? '' : (linhas.pop() ?? '');
    return linhas.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart());
  };
  return { empurrar: (t) => processar(t, false), finalizar: () => processar('\n', true) };
}

type EventoChat =
  | { tipo: 'delta'; texto: string }
  | ({ tipo: 'fim' } & Partial<FimChat>)
  | { tipo: 'erro'; mensagem?: string };

function normalizarFim(dados: Partial<FimChat>, modoPadrao: string): FimChat {
  return {
    texto: String(dados.texto ?? ''),
    frustrationDetected: Boolean(dados.frustrationDetected),
    fontes: Array.isArray(dados.fontes) ? dados.fontes : [],
    consultas: Array.isArray(dados.consultas) ? dados.consultas : [],
    groundingUsado: Boolean(dados.groundingUsado),
    citouProva: Boolean(dados.citouProva),
    modo: String(dados.modo ?? modoPadrao),
  };
}

export interface OpcoesTransmissao {
  url: string;
  corpo: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** Texto montado até agora (acumulado, não só o pedaço novo). */
  aoParcial?: (textoAteAgora: string) => void;
}

export async function transmitirChat(op: OpcoesTransmissao): Promise<FimChat> {
  const modo = String(op.corpo.modo ?? '');
  const resposta = await op.fetch(op.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...op.headers },
    body: JSON.stringify({ ...op.corpo, stream: true }),
    signal: op.signal,
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(`Erro no mentor (${resposta.status}): ${detalhe.slice(0, 180)}`);
  }

  // Servidor antigo, sem streaming: o JSON inteiro de sempre.
  const tipo = resposta.headers.get('Content-Type') ?? '';
  if (tipo.includes('application/json')) {
    const fim = normalizarFim(await resposta.json(), modo);
    op.aoParcial?.(fim.texto);
    return fim;
  }

  const leitorSSE = criarLeitorSSE();
  let acumulado = '';
  let fim: FimChat | null = null;

  const tratar = (dados: string[]) => {
    for (const d of dados) {
      let evento: EventoChat;
      try {
        evento = JSON.parse(d) as EventoChat;
      } catch {
        continue;
      }
      if (evento.tipo === 'delta') {
        acumulado += evento.texto;
        op.aoParcial?.(acumulado);
      } else if (evento.tipo === 'fim') {
        fim = normalizarFim(evento, modo);
      } else if (evento.tipo === 'erro') {
        throw new Error(evento.mensagem || 'A resposta foi interrompida no meio.');
      }
    }
  };

  const corpo = resposta.body as ReadableStream<Uint8Array> | null;
  if (corpo && typeof corpo.getReader === 'function') {
    const leitor = corpo.getReader();
    const decodificador = new TextDecoder();
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      tratar(leitorSSE.empurrar(decodificador.decode(value, { stream: true })));
    }
  } else {
    tratar(leitorSSE.empurrar(await resposta.text()));
  }
  tratar(leitorSSE.finalizar());

  /* Conexão caiu depois de alguns pedaços e antes do `fim`: o que chegou
     é aproveitado. Nada chegou: é erro, para a tela cair no fallback em
     vez de mostrar uma bolha vazia que parece "não respondeu". */
  if (fim) return fim;
  if (acumulado.trim()) return normalizarFim({ texto: acumulado.trim() }, modo);
  throw new Error('A IA devolveu uma resposta vazia. Tente de novo com outras palavras.');
}
