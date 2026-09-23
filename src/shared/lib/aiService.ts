import { ChatPersona, Dificuldade, QuizQuestion } from '../types';
import { montarBlocoAntirrepeticao, hashEnunciado } from './quizHistory';
import {
  QUIZ_LOTES_SIMULTANEOS,
  emParalelo,
  objetosJsonCompletos,
  planoDeLotes,
  tokensParaLote,
} from './quizLotes';
import { StudentMonthlyRecord } from './dropoutRisk';
import { promptRoteiroAudio, montarPedidoTTS } from './audioPills';
import { SYSTEM_PROMPT_DESCOMPRESSAO, promptDescompressao } from './decompressionReport';
import type { MetricasDescompressao } from '../types';
import {
  DEEPSEEK_DEV_PROXY_PATH,
  DEEPSEEK_TIMEOUT_MS,
  GEMINI_CHAT_CONFIG,
  backendDeepSeekAtual,
  diagnosticarErroRede,
  erroProxyLocalSemChave,
  erroSemBackendDeepSeek,
  fetchDeepSeek,
  geminiGenConfigToDeepSeek,
  isDeepSeekProvider,
  mensagemErroRede,
  modeloAtual,
  provedorAtual,
  sinalComTimeout,
  toChatCompletionsMessages,
  wrapAsGeminiResponse,
} from './aiProvider';
import { aiProxyToken, destinoBackendIA, temBackendIA, urlBackendIA } from './runtimeConfig';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;

/* ============================================================
 BACK-END DE IA (a chave fica no servidor, nunca no navegador)

 Por padrao o back-end e a rota `/api/*` DESTE MESMO dominio
 (Vercel Functions rodando server/worker.js). Nesse arranjo:

   - DEEPSEEK_API_KEY / GEMINI_API_KEY sao Environment Variables do
     projeto, SEM prefixo VITE_ - logo nunca entram no bundle;
   - nao ha CORS nem preflight (mesma origem);
   - AI_PROXY_TOKEN e dispensavel, porque nao existe origem terceira
     para barrar.

 Definir AI_BASE_URL aponta o app de volta para um Cloudflare Worker
 externo, com o mesmo contrato de rotas.

 Tudo isto e lido por FUNCAO (runtimeConfig), nunca por constante de
 modulo: constante congelaria o valor antes de /api/config responder.
 ============================================================ */

/** Back-end de IA alcancavel? (modo "sem chave do usuário"). */
export const hasProxy = () => temBackendIA();

/** Provedor/modelo efetivos (para UI, diagnostico e testes). */
export const getAIProviderInfo = () => ({ provider: provedorAtual(), model: modeloAtual() });

/** Mensagem de chave invalida conforme o provedor ativo. */
function mensagemChaveInvalida(): string {
  return isDeepSeekProvider()
    ? 'Chave da IA inválida ou sem permissão. Confira a DEEPSEEK_API_KEY no servidor (.env local ou secret do worker).'
    : 'API key inválida ou sem permissão. Verifique sua chave do Google AI Studio.';
}

/**
 * IA disponivel?
 *
 * DeepSeek e 100% back-end (worker ou proxy local): a chave mora no
 * servidor, entao a chave do usuario nao conta - vale haver back-end.
 * Gemini mantem o modo direto com a chave do usuario.
 */
export const aiAvailable = (apiKey: string) =>
  isDeepSeekProvider()
    ? backendDeepSeekAtual(hasProxy()) !== 'nenhum'
    : Boolean(apiKey.trim()) || hasProxy();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RetryResult {
  ok: boolean;
  status: number;
  data: any;
  error: string | null;
}

// Garante que uma chamada ao Gemini não falhe por uma simples instabilidade
// de rede / resposta interrompida ("streaming response failed").
async function fetchGemini(url: string, init: RequestInit, signal?: AbortSignal): Promise<RetryResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal });
      if (res.ok) {
        return { ok: true, status: res.status, data: await res.json(), error: null };
      }
      // Erros 5xx e 429 (rate limit) são transitórios -> tenta de novo
      if (res.status === 429 || res.status >= 500) {
        if (attempt === MAX_RETRIES - 1) {
          const err = await res.text();
          return { ok: false, status: res.status, data: null, error: err };
        }
        await sleep(600 * (attempt + 1));
        continue;
      }
      // 400/403 = chave inválida, não adianta repetir
      const err = await res.text();
      return { ok: false, status: res.status, data: null, error: err };
    } catch (e) {
      // Falha de rede (fetch lança TypeError) - causa comum do "streaming response failed".
      // Na última tentativa, propaga para o chamador cair no fallback local com toast.
      if (attempt === MAX_RETRIES - 1) throw e;
      await sleep(700 * (attempt + 1));
    }
  }
  return { ok: false, status: 0, data: null, error: 'Falha na conexão com a IA' };
}

/**
 * Chamada ao worker com timeout + erro de rede classificado.
 *
 * fetchGemini puro nao tem timeout e propaga o TypeError cru; aqui o
 * sinal ganha teto de 30s e a falha vira mensagem acionavel com o
 * diagnostico seguro no console.debug.
 */
async function fetchViaWorker(url: string, init: RequestInit, signal?: AbortSignal): Promise<RetryResult> {
  try {
    // O sinal COMBINADO (usuário + timeout 30s) precisa ir nos dois lugares:
    // fetchGemini espalha {...init, signal} por cima do init, então passar o
    // `signal` original como 3º arg anulava o timeout (bug: trava infinita).
    const combinado = sinalComTimeout(signal, DEEPSEEK_TIMEOUT_MS);
    return await fetchGemini(url, { ...init, signal: combinado }, combinado);
  } catch (e) {
    const diag = diagnosticarErroRede(destinoBackendIA(), e, !!signal?.aborted);
    console.debug('[ia] falha de rede (worker)', { ...diag });
    throw new Error(mensagemErroRede(diag), { cause: e });
  }
}

/* Envia o payload ao back-end (worker) ou ao Gemini direto.
 *
 * DeepSeek NUNCA sai do navegador em cross-origin: a chave mora no
 * servidor e o front fala sempre com um back-end same-origin ou
 * permitido (worker publicado ou proxy local do Vite dev). body e
 * resposta mantem o envelope Gemini; a conversao para chat completions
 * acontece no back-end (worker) ou antes do envio (proxy local). */
async function sendToAI(
  body: {
    systemInstruction?: { parts: { text: string }[] };
    contents: { parts: any[] }[];
    generationConfig: Record<string, unknown>;
  },
  apiKey: string,
  signal?: AbortSignal,
): Promise<RetryResult> {
  if (hasProxy()) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = aiProxyToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchViaWorker(
      urlBackendIA('/generate'),
      {
        method: 'POST',
        headers,
        // O worker decide o upstream (Gemini x DeepSeek) por este campo.
        // Os prompts (systemInstruction/contents) viajam intactos.
        body: JSON.stringify({ provider: provedorAtual(), model: modeloAtual(), ...body }),
      },
      signal,
    );
  }
  // Sem worker: DeepSeek via proxy local (back-end); Gemini direto via REST.
  if (isDeepSeekProvider()) {
    return sendToDeepSeekViaBackend(body, signal);
  }
  // Chave no header, nunca na URL: ?key= fica em access-log de proxy/CDN,
  // histórico e crash-report. O REST do Gemini aceita x-goog-api-key.
  return fetchGemini(
    GEMINI_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal,
      body: JSON.stringify(body),
    },
    signal,
  );
}

/**
 * DeepSeek 100% via back-end.
 *
 *   worker   -> POST /generate (protocolo do worker; ele traduz para chat
 *               completions com a DEEPSEEK_API_KEY do servidor).
 *   devProxy -> POST /deepseek-api/chat/completions (same-origin, SEM
 *               Authorization no navegador: o Vite injeta no servidor).
 *
 * A resposta e reembalada no envelope Gemini minimo, de modo que todo o
 * resto do app (extractGeminiText, JSON das correcoes, testes) continue
 * funcionando sem alteracao. Sem back-end, erro acionavel em vez de um
 * cross-origin fadado ao "Failed to fetch".
 */
async function sendToDeepSeekViaBackend(
  body: {
    systemInstruction?: { parts: { text: string }[] };
    contents: { parts: any[] }[];
    generationConfig: Record<string, unknown>;
  },
  signal?: AbortSignal,
): Promise<RetryResult> {
  const backend = backendDeepSeekAtual(hasProxy());

  if (backend === 'worker') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = aiProxyToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchViaWorker(
      urlBackendIA('/generate'),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: 'deepseek', model: modeloAtual(), ...body }),
      },
      signal,
    );
  }

  if (backend === 'devProxy') {
    const messages = toChatCompletionsMessages(
      body.systemInstruction,
      (body.contents ?? []) as { role?: 'user' | 'model'; parts?: { text?: string }[] }[],
    );
    const gen = geminiGenConfigToDeepSeek(body.generationConfig ?? {});

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let res: Response;
      try {
        // Erro de transporte nao e retentado (fail fast); retry fica so
        // para 429/5xx, que sao transitorios.
        res = await fetchDeepSeek(
          `${DEEPSEEK_DEV_PROXY_PATH}/chat/completions`,
          {
            method: 'POST',
            // SEM Authorization de proposito: a chave e injetada pelo Vite no
            // servidor (vite.config.ts). Nada de segredo no navegador.
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modeloAtual(), messages, ...gen }),
          },
          {
            sinalUsuario: signal,
            rotuloDestino: 'proxy local (/deepseek-api)',
            contexto: { model: modeloAtual(), mensagens: messages.length, via: 'aiService-devProxy' },
          },
        );
      } catch (e) {
        throw e instanceof Error ? e : new Error('Falha na conexão com a IA');
      }

      if (res.ok) {
        const data = await res.json();
        const text =
          (data?.choices?.[0]?.message?.content as string) ||
          (typeof data?.choices?.[0]?.text === 'string' ? (data.choices[0].text as string) : '');
        return { ok: true, status: res.status, data: wrapAsGeminiResponse(text ?? ''), error: null };
      }
      // 404 = rota nao registrada pelo Vite = .env sem DEEPSEEK_API_KEY
      // (ou dev server nao reiniciado apos adiciona-la).
      if (res.status === 404) throw erroProxyLocalSemChave();
      // 401/400/403 do upstream (chave invalida) chegam aqui via proxy.
      if (res.status === 401 || res.status === 400 || res.status === 403) {
        throw new Error(mensagemChaveInvalida());
      }
      if (res.status === 429 || res.status >= 500) {
        if (attempt === MAX_RETRIES - 1) {
          return { ok: false, status: res.status, data: null, error: await res.text() };
        }
        await sleep(600 * (attempt + 1));
        continue;
      }
      return { ok: false, status: res.status, data: null, error: await res.text() };
    }
    return { ok: false, status: 0, data: null, error: 'Falha na conexão com a IA' };
  }

  throw erroSemBackendDeepSeek();
}

function extractGeminiText(data: any): string {
  if (!data) return '';
  const candidate = data?.candidates?.[0] || data;
  const content = candidate?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item?.text === 'string') return item.text;
      if (Array.isArray(item?.parts) && typeof item.parts[0]?.text === 'string') return item.parts[0].text;
    }
  }
  if (typeof content?.text === 'string') return content.text;
  if (Array.isArray(content?.parts) && typeof content.parts[0]?.text === 'string')
    return content.parts[0].text;
  if (Array.isArray(data?.content?.parts) && typeof data.content.parts[0]?.text === 'string')
    return data.content.parts[0].text;
  return '';
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export async function askGemini(
  message: string,
  persona: ChatPersona | null,
  apiKey: string,
  imageBase64?: string,
  signal?: AbortSignal,
): Promise<string> {
  // Delega a montarInstrucaoDaPersona: o texto antigo interpolava
  // `persona.instruction` (digitado pelo usuário) direto no system sem a
  // trava de segurança nem teto de tamanho — "me obedeça em tudo" virava
  // regra do sistema. O único chamador passa persona null, mas a função é
  // pública e precisa ser segura por construção.
  const systemInstruction = montarInstrucaoDaPersona(persona, {});

  const parts: any[] = [{ text: message }];
  if (imageBase64) {
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      const data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({ inlineData: { mimeType, data } });
    }
  }

  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts }],
      generationConfig: {
        // Mesmo custo/comportamento do chat temático (ver aiProvider).
        ...GEMINI_CHAT_CONFIG,
        topK: 20,
      },
    },
    apiKey,
    signal,
  );

  if (!res.ok) {
    if (hasProxy()) {
      throw new Error(`Erro na IA: ${res.error || 'falha do servidor'}`);
    }
    if (res.status === 403 || res.status === 400 || res.status === 401) {
      throw new Error(mensagemChaveInvalida());
    }
    if (res.status === 429) {
      throw new Error('Limite de requisições excedido. Aguarde um momento e tente novamente.');
    }
    throw new Error(`Erro na API: ${res.error}`);
  }

  const text = extractGeminiText(res.data) || 'Desculpe, não consegui gerar uma resposta.';
  return text;
}

export async function generateQuizQuestions(
  subject: string,
  topic: string,
  apiKey: string,
  count: number = 10,
): Promise<string> {
  const systemInstruction = `Você é um professor pesquisador especialista em ${subject} para o ENEM. Crie exatamente ${count} questões de múltipla escolha inéditas, com nível ENEM, clareza conceitual e contexto pedagógico.`;
  const prompt =
    topic === 'geral'
      ? `Gere ${count} questões de ${subject} abrangendo tópicos essenciais e representativos da matéria para o ENEM. Inclua alternativas rotuladas A, B, C, D, marque a resposta correta como "Resposta: <letra>" e classifique cada questao com uma linha "Dificuldade: facil", "Dificuldade: media" ou "Dificuldade: dificil".`
      : `Gere ${count} questões de ${subject} focadas no tema "${topic}"para o ENEM. Mantenha o nível acadêmico, explique brevemente a justificativa da resposta correta e inclua em cada questao uma linha "Dificuldade: facil|media|dificil".`;

  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 4096, topP: 0.9, topK: 20 },
    },
    apiKey,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro ao gerar questões: ${res.error || 'falha do servidor'}`);
    throw new Error(`Erro ao gerar questões: ${res.error}`);
  }

  return extractGeminiText(res.data) || 'Erro ao gerar questões.';
}

/* ============================================================
  QUIZ ESTRUTURADO (JSON) - o caminho que garante renderizacao
  ------------------------------------------------------------
  O gerador legado devolve texto livre ("Resposta: B") e um parser de
  regex tenta adivinhar alternativas e gabarito - fragil entre modelos:
  negrito, "Gabarito:", numeracao diferente ou prosa do modelo de
  raciocinio quebravam o parse e a tela voltava vazia ("gerou, mas nao
  apareceu"). Aqui o modelo devolve JSON com schema fixo e cada questao
  e validada campo a campo: enunciado, EXATAMENTE 4 alternativas,
  indice 0-3, explicacao, dica e dificuldade. O que nao passa e
  descartado em vez de quebrar a tela.
  ============================================================ */

/** Letra A-D (ou texto contendo) -> indice 0-3. */
function letraParaIndice(valor: unknown): number | null {
  if (Number.isInteger(valor)) {
    const n = valor as number;
    return n >= 0 && n <= 3 ? n : null;
  }
  if (typeof valor === 'string') {
    const m = valor.match(/[a-dA-D]/);
    if (m) return m[0].toUpperCase().charCodeAt(0) - 65;
  }
  return null;
}

function normalizarDificuldadeQuiz(valor: unknown): Dificuldade {
  const t = String(valor ?? '').toLowerCase();
  if (t.includes('facil') || t.includes('fácil')) return 'facil';
  if (t.includes('dific')) return 'dificil';
  return 'media';
}

/**
 * Converte a resposta JSON do modelo em questoes validas.
 * Funcao pura - nao faz I/O, ideal para testes.
 */
export function parseQuizJson(raw: string, materia: string): QuizQuestion[] {
  const texto = (raw || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  let arr: unknown = null;
  const tentar = (t: string): unknown => {
    try {
      const p = JSON.parse(t);
      return Array.isArray(p) ? p : (p as { questoes?: unknown })?.questoes ?? null;
    } catch {
      return null;
    }
  };
  arr = tentar(texto);
  if (!Array.isArray(arr)) {
    const m = texto.match(/\[[\s\S]*\]/);
    if (m) arr = tentar(m[0]);
  }
  /*
   * RESGATE DE RESPOSTA CORTADA.
   *
   * Passando daqui, o texto nao e JSON valido - e o caso mais comum e a
   * resposta ter sido truncada no limite de tokens, deixando o array sem
   * o `]` final. Antes isso virava lista VAZIA: o aluno pedia 20 questoes
   * e recebia "nao foi possivel gerar", mesmo com 15 questoes inteiras
   * dentro da resposta.
   *
   * Aqui os objetos completos sao extraidos um a um e o pedaco incompleto
   * do fim e descartado. Entregar 15 de 20 e melhor que entregar nada.
   */
  if (!Array.isArray(arr)) {
    const resgatados = objetosJsonCompletos(texto)
      .map((t) => { try { return JSON.parse(t); } catch { return null; } })
      .filter((o) => o && typeof o === 'object');
    if (resgatados.length > 0) arr = resgatados;
  }
  if (!Array.isArray(arr)) return [];

  const out: QuizQuestion[] = [];
  arr.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const q = item as Record<string, unknown>;
    const enunciado = String(q.enunciado ?? '').trim();
    const alts = Array.isArray(q.alternativas)
      ? (q.alternativas as unknown[]).map((a) => String(a ?? '').trim()).filter(Boolean)
      : [];
    if (enunciado.length < 10 || alts.length < 4) return;
    const correta = letraParaIndice(q.correta);
    if (correta === null) return;
    const topico = String((q.tema ?? q.topico) ?? '').trim();
    const dica = String(q.dica ?? '').trim();
    const explicacao = String(q.explicacao ?? '').trim();
    const fonte = String(q.fonte ?? '').trim().slice(0, 40);
    out.push({
      id: `ai_q_${Date.now()}_${i}`,
      materia,
      topico: topico || undefined,
      enunciado,
      alternativas: alts.slice(0, 4),
      correta,
      explicacao: explicacao || 'Questão gerada por IA.',
      dica: dica || undefined,
      fonte: fonte || undefined,
      dificuldade: normalizarDificuldadeQuiz(q.dificuldade),
    });
  });
  return out;
}

export interface QuizEstruturado {
  questions: QuizQuestion[];
  /** Texto bruto (para fallback legado quando o JSON vier incompleto). */
  raw: string;
}

export type NivelQuiz = 'facil' | 'media' | 'dificil';

export interface OpcoesQuiz {
  /** Nivel pedido na tela de configuracao; o modelo distribui se ausente. */
  dificuldade?: NivelQuiz;
  /** Previews de enunciados ja aplicados (antirrepeticao por conta). */
  historico?: string[];
  /**
   * Avisa a cada lote concluido.
   *
   * Espera longa com spinner so diz "aguarde"; com "12 de 30 questoes
   * prontas" o usuario sabe que ha avanco e quanto falta. So e chamado
   * quando ha mais de um lote - num pedido pequeno nao ha o que informar.
   */
  onProgresso?: (prontas: number, total: number) => void;
}

const TEXTO_NIVEL: Record<NivelQuiz, string> = {
  facil: 'FÁCIL: conceitos diretos em uma etapa, sem pegadinha, linguagem simples.',
  media: 'MÉDIO: padrão ENEM - interpretação de texto/gráfico com uma etapa de raciocínio.',
  dificil: 'DIFÍCIL: múltiplas etapas, interpretação fina e distratores fortes, nível FUVEST/UNICAMP segunda fase.',
};

/**
 * Gera questoes com schema JSON fixo: tema, enunciado, 4 alternativas,
 * indice da correta, explicacao, dica, fonte e dificuldade.
 *
 * O system prompt coloca o modelo como BANCA examinadora (padrão
 * INEP/FUVEST/UNICAMP/UNESP): cada questão segue o estilo e o rigor de
 * provas reais para o conteúdo pedido. Questão inspirada em prova real
 * cita banca e ano em "fonte"; questão inédita declara
 * "inédita, estilo <banca>" e NUNCA se apresenta como oficial - inventar
 * enunciado, ano ou número de questão é proibido.
 */
/** Um lote: UMA chamada a IA. O orquestrador esta em generateQuizStructured. */
async function gerarLoteQuiz(
  subject: string,
  topic: string,
  apiKey: string,
  count: number,
  opcoes: OpcoesQuiz = {},
): Promise<QuizEstruturado> {
  const systemInstruction =
    `Você é uma banca examinadora de alto nível (padrão INEP/ENEM, FUVEST, UNICAMP e UNESP) ` +
    `especialista em ${subject}. Baseie cada questão no estilo e no rigor de questões REAIS desses vestibulares. ` +
    'Responda APENAS com JSON válido (array), sem markdown, sem cercas de código e sem texto fora do JSON.';
  const foco = topic === 'geral'
    ? `abrangendo tópicos essenciais e representativos de ${subject} cobrados no ENEM e nos vestibulares`
    : `focadas no tema "${topic}" de ${subject}, rigorosamente filtradas para esse conteúdo`;
  const nivel = opcoes.dificuldade
    ? `Nível de dificuldade solicitado: ${TEXTO_NIVEL[opcoes.dificuldade]} Todas as ${count} questões seguem esse nível.`
    : 'Distribua as dificuldades entre facil, media e dificil.';
  const blocoHistorico = montarBlocoAntirrepeticao(opcoes.historico ?? []);
  const prompt =
    `Gere exatamente ${count} questões inéditas de múltipla escolha, ${foco}. ${nivel}` +
    (blocoHistorico ? `\n\n${blocoHistorico}` : '') +
    '\n\nFormato (array JSON com exatamente ' + count + ' itens):\n' +
    '[{"tema":"<assunto específico da questão>","enunciado":"<texto com contexto>","alternativas":["<A>","<B>","<C>","<D>"],' +
    '"correta":<índice 0-3 da alternativa certa>,"explicacao":"<justificativa breve com a resolução>","dica":"<pista curta que ajuda sem revelar a resposta>",' +
    '"fonte":"<banca + ano se inspirada em prova real, ou \'inédita, estilo <banca>\'>","dificuldade":"facil|media|dificil"}]\n' +
    'Regras: enunciado com contexto; 4 alternativas plausíveis e distintas, apenas uma correta; "correta" é o ÍNDICE (0-3), nunca letra; ' +
    'dica ajuda sem entregar; nunca apresente questão inédita como oficial nem invente ano/número de prova.';

  const gen: Record<string, unknown> = {
    temperature: 0.45,
    /*
     * `tokensParaLote` NUNCA passa do teto de 8192 do back-end.
     *
     * A conta anterior era `Math.max(4096, count * 500)`, que estourava
     * o teto a partir de 17 questoes (8.500 > 8.192) e chegava a 15.000
     * no maximo da tela (30). O servidor cortava em silencio, o JSON
     * voltava pela metade e o app mostrava "nao foi possivel gerar" -
     * com mais frequencia em questao dificil, que e mais longa. Era o
     * "as vezes nao gera dependendo das questoes".
     */
    maxOutputTokens: tokensParaLote(count),
    topP: 0.9,
    topK: 20,
    // So o caminho DeepSeek recebe: modo JSON estrito da API.
    // (O Gemini ignora — por isso a chave so entra aqui.)
    ...(isDeepSeekProvider() ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: gen,
    },
    apiKey,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro ao gerar questões: ${res.error || 'falha do servidor'}`);
    throw new Error(`Erro ao gerar questões: ${res.error}`);
  }

  const raw = extractGeminiText(res.data) || '';
  return { questions: parseQuizJson(raw, subject), raw };
}

/**
 * Gera as questoes do quiz, em LOTES PARALELOS quando o pedido e grande.
 *
 * ------------------------------------------------------------------
 * POR QUE NAO UMA CHAMADA SO
 * ------------------------------------------------------------------
 * Pedir 30 questoes de uma vez tinha dois problemas somados: estourava o
 * teto de saida do back-end (e o JSON voltava cortado) e era lento por
 * natureza, porque o modelo escreve token a token e nao ha paralelismo
 * DENTRO de uma chamada.
 *
 * Em lotes de 8, cada chamada cabe folgada no teto e as chamadas correm
 * ao mesmo tempo: o tempo total passa a ser o do lote mais lento em vez
 * da soma de todos. A concorrencia e limitada porque disparar tudo junto
 * convida o 429 do provedor - e o retry devolveria a lentidao.
 *
 * TOLERA FALHA PARCIAL: um lote que falhe nao derruba os outros. So
 * lanca se TODOS falharem, caso em que o erro do primeiro e propagado
 * para a tela poder explicar o que aconteceu.
 */
export async function generateQuizStructured(
  subject: string,
  topic: string,
  apiKey: string,
  count: number = 10,
  opcoes: OpcoesQuiz = {},
): Promise<QuizEstruturado> {
  const lotes = planoDeLotes(count);

  // Pedido pequeno: uma chamada, sem orquestracao nenhuma.
  if (lotes.length <= 1) return gerarLoteQuiz(subject, topic, apiKey, count, opcoes);

  /*
   * O progresso e contado em QUESTOES, nao em lotes: "18 de 30" diz mais
   * ao aluno que "lote 3 de 4". Em paralelo os lotes nao terminam em
   * ordem, entao o que se conta e o que ja chegou.
   */
  let prontas = 0;
  const resultados = await emParalelo(lotes, QUIZ_LOTES_SIMULTANEOS, async (n) => {
    const lote = await gerarLoteQuiz(subject, topic, apiKey, n, opcoes);
    prontas += lote.questions.length;
    opcoes.onProgresso?.(Math.min(prontas, count), count);
    return lote;
  });

  /*
   * Os lotes correm em paralelo e recebem o MESMO bloco de
   * antirrepeticao, entao nenhum sabe o que o outro gerou: dois lotes
   * podem produzir a mesma questao. A deduplicacao usa o hash do
   * enunciado normalizado, o mesmo critério do historico por conta.
   */
  const vistos = new Set<string>();
  const questions: QuizQuestion[] = [];
  const brutos: string[] = [];
  let primeiroErro: unknown = null;

  for (const r of resultados) {
    if (r.erro !== undefined) {
      primeiroErro ??= r.erro;
      continue;
    }
    if (!r.valor) continue;
    brutos.push(r.valor.raw);
    for (const q of r.valor.questions) {
      const hash = hashEnunciado(q.enunciado);
      if (vistos.has(hash)) continue;
      vistos.add(hash);
      questions.push(q);
    }
  }

  // Nada aproveitavel em lote nenhum: a tela precisa do erro real.
  if (questions.length === 0 && primeiroErro !== null) throw primeiroErro;

  return { questions: questions.slice(0, count), raw: brutos.join('\n') };
}

/* ============================================================
  MAPA MENTAL (caderno/estudio) - JSON + Mermaid deterministico
  ------------------------------------------------------------
  O modelo e de TEXTO: pedir o codigo Mermaid pronto a ele funciona
  as vezes e quebra as outras (aspas, colchetes e prosa do modelo de
  raciocinio invalidam o diagrama). Aqui o modelo devolve so DADOS em
  JSON (titulo + ramos + filhos) e o CODIGO Mermaid e montado aqui, com
  sanitizacao total dos rotulos. Diagrama quebrado vira impossivel por
  construcao; o que o modelo pode errar e so o conteudo.
  ============================================================ */

export interface RamoMapaMental {
  rotulo: string;
  filhos: string[];
}

export interface DadosMapaMental {
  titulo: string;
  ramos: RamoMapaMental[];
}

/** Remove tudo que quebra a sintaxe do Mermaid. Funcao pura. */
export function sanitizarRotuloMermaid(valor: unknown, max = 42): string {
  return String(valor ?? '')
    .replace(/["'#[\]{}()|<>`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Monta o diagrama mindmap a partir dos dados (sempre valido).
 * Funcao pura - nao faz I/O, ideal para testes.
 */
export function buildMindmapMermaid(dados: DadosMapaMental): string {
  const titulo = sanitizarRotuloMermaid(dados.titulo, 48) || 'Meus estudos';
  const linhas = ['mindmap', `  root((${titulo}))`];
  for (const ramo of (dados.ramos ?? []).slice(0, 5)) {
    const rotulo = sanitizarRotuloMermaid(ramo.rotulo);
    if (!rotulo) continue;
    linhas.push(`    ${rotulo}`);
    for (const filho of (ramo.filhos ?? []).slice(0, 4)) {
      const f = sanitizarRotuloMermaid(filho);
      if (f) linhas.push(`      ${f}`);
    }
  }
  return linhas.join('\n');
}

/** Extrai {titulo, ramos} do JSON do modelo, com limites. Funcao pura. */
export function parseMapaMental(raw: string): DadosMapaMental | null {
  const texto = (raw || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  const tentar = (t: string): unknown => {
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };
  let obj = tentar(texto);
  if (!obj || typeof obj !== 'object') {
    const m = texto.match(/\{[\s\S]*\}/);
    if (m) obj = tentar(m[0]);
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const ramosBrutos = Array.isArray(o.ramos) ? o.ramos : [];
  const ramos: RamoMapaMental[] = [];
  for (const r of ramosBrutos) {
    if (!r || typeof r !== 'object') continue;
    const rr = r as Record<string, unknown>;
    const rotulo = sanitizarRotuloMermaid(rr.rotulo);
    if (!rotulo) continue;
    const filhos = (Array.isArray(rr.filhos) ? rr.filhos : [])
      .map((f) => sanitizarRotuloMermaid(f))
      .filter(Boolean)
      .slice(0, 4);
    ramos.push({ rotulo, filhos });
    if (ramos.length >= 5) break;
  }
  if (ramos.length === 0) return null;
  return { titulo: sanitizarRotuloMermaid(o.titulo, 48) || 'Meus estudos', ramos };
}

/**
 * Resume as notas do aluno em dados de mapa mental (DeepSeek Flash).
 * A renderizacao (Mermaid) acontece no Estúdio via buildMindmapMermaid.
 */
export async function gerarMapaMental(
  notas: string[],
  apiKey: string,
): Promise<DadosMapaMental | null> {
  const lista = notas.map((t) => t.trim()).filter(Boolean).slice(-10);
  if (lista.length === 0) return null;

  const systemInstruction =
    'Você organiza anotações de estudo em mapas mentais. ' +
    'Responda APENAS com JSON válido (objeto), sem markdown, sem cercas de código e sem texto fora do JSON.';
  const prompt =
    'Com base nas anotações abaixo, monte um mapa mental com o tema central e até 5 ramos, cada ramo com até 4 pontos curtos.\n' +
    'Formato (objeto JSON):\n' +
    '{"titulo":"<tema central, max 6 palavras>","ramos":[{"rotulo":"<conceito>","filhos":["<ponto curto>", "..."]}]}\n' +
    'Regras: rotulos curtos (max 6 palavras cada), sem aspas e sem caracteres especiais; use as palavras do proprio aluno quando possivel.\n\n' +
    'Anotações:\n' +
    lista.map((t, i) => `${i + 1}. ${t.slice(0, 500)}`).join('\n');

  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        topP: 0.9,
        topK: 20,
        ...(isDeepSeekProvider() ? { response_format: { type: 'json_object' } } : {}),
      },
    },
    apiKey,
  );

  if (!res.ok) throw new Error(`Erro ao gerar mapa mental: ${res.error || 'falha do servidor'}`);
  return parseMapaMental(extractGeminiText(res.data) || '');
}

/* ============================================================
  TUTOR POS-ERRO - explica o erro conceitual com empatia
  ------------------------------------------------------------
  Chamado quando o aluno erra uma questao (botao "Explicacao do
  tutor") ou revisa os erros no gabarito. O modelo recebe a resposta
  DADA vs a GABARITADA e diagnostica o raciocinio que saiu do trilho -
  nao repete o gabarito, explica o PORQUE do erro. Tom do Sagui:
  acolhe antes de corrigir, sem culpa e sem jargao.
  ============================================================ */

export interface ErroParaTutor {
  materia: string;
  topico?: string;
  enunciado: string;
  alternativas: string[];
  /** Indice 0-3 da alternativa que o aluno marcou. */
  escolhida: number;
  /** Indice 0-3 da alternativa correta. */
  correta: number;
  explicacao?: string;
}

const LETRAS_ALTERNATIVA = ['A', 'B', 'C', 'D'];

export function montarPromptTutorPosErro(erro: ErroParaTutor): { system: string; user: string } {
  const system = [
    'Você é o Sagui, tutor empático de um app de estudos brasileiro (ensino médio noturno, ENEM e vestibulares).',
    'Sua tarefa: diagnosticar o ERRO CONCEITUAL do aluno a partir da resposta que ele marcou vs. a correta.',
    'Estrutura obrigatória, em português brasileiro acessível:',
    '1. Acolhimento em UMA frase, sem culpa e sem dizer "você errou".',
    '2. "O que você provavelmente pensou": reconstrua o raciocínio que leva à alternativa marcada.',
    '3. "Onde saiu do trilho": aponte o passo exato em que esse raciocínio falha.',
    '4. "Da próxima vez": uma regra prática de uma frase para esse tipo de questão.',
    'Limite: no máximo 150 palavras no total. Sem emoji, sem jargão desnecessário, sem repetir o enunciado inteiro.',
  ].join('\n');

  const letra = (i: number) => LETRAS_ALTERNATIVA[i] ?? '?';
  const alts = erro.alternativas
    .slice(0, 4)
    .map((a, i) => `${letra(i)}) ${a}`)
    .join('\n');
  const user = [
    `Matéria: ${erro.materia}${erro.topico ? ` | Tema: ${erro.topico}` : ''}`,
    '',
    `Questão: ${erro.enunciado}`,
    '',
    'Alternativas:',
    alts,
    '',
    `O aluno marcou: ${letra(erro.escolhida)}) ${erro.alternativas[erro.escolhida] ?? ''}`,
    `Resposta correta: ${letra(erro.correta)}) ${erro.alternativas[erro.correta] ?? ''}`,
    erro.explicacao ? `\nExplicação oficial do gabarito: ${erro.explicacao}` : '',
  ].join('\n');

  return { system, user };
}

export async function explicarErroComTutor(
  erro: ErroParaTutor,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  // Acerto nao precisa de diagnostico: economiza a chamada.
  if (erro.escolhida === erro.correta) {
    return 'Resposta certa - nenhum erro conceitual para diagnosticar. Siga assim!';
  }

  const { system, user } = montarPromptTutorPosErro(erro);
  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 600, topP: 0.9, topK: 32 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro no tutor: ${res.error || 'falha do servidor'}`);
    throw new Error(`Erro no tutor: ${res.error}`);
  }
  return extractGeminiText(res.data) || 'Não consegui explicar agora. Releia a explicação do gabarito com calma.';
}

export async function correctEssayWithAI(text: string, apiKey: string, tema?: string): Promise<string> {
  const temaInst = tema
    ? `Tema da redação: "${tema}". Avalie se o texto aborda o tema proposto de forma consistente.`
    : 'Avalie a competência 2 (Compreensão do tema) com base no que o texto parece abordar.';

  const prompt = `Você é um corretor de redações do ENEM com perfil de pesquisador acadêmico. Analise a redação abaixo e atribua notas de 0 a 200 para cada uma das 5 competências. Responda APENAS com um objeto JSON válido, sem markdown, sem explicações adicionais.

Competências:
1. "competencia1"- Domínio da norma culta: domínio da modalidade escrita formal da língua portuguesa.
2. "competencia2"- Compreensão do tema: compreensão da proposta de redação e desenvolvimento do tema dentro dos limites do texto dissertativo-argumentativo.
3. "competencia3"- Argumentação: seleção, relação, organização e interpretação de informações, fatos, opiniões e argumentos em defesa de um ponto de vista.
4. "competencia4"- Coesão: uso de mecanismos linguísticos para organizar as ideias e manter a progressão textual.
5. "competencia5"- Proposta de intervenção: elaboração de uma proposta de intervenção para o problema abordado, com agente, ação, meio e finalidade.

${temaInst}

Formato de resposta (apenas JSON):
{
 "competencia1": 0,
 "competencia2": 0,
 "competencia3": 0,
 "competencia4": 0,
 "competencia5": 0,
 "notaFinal": 0,
 "pontosFortes": ["...", "..."],
 "pontosMelhorar": ["...", "..."],
 "analise": "<breve análise geral do texto, 2-3 frases>"}

Redação:
${text}`;

  const res = await sendToAI(
    {
      systemInstruction: {
        parts: [{ text: 'Você é um corretor experiente de redações ENEM. Responda apenas com JSON.' }],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, topP: 0.9, topK: 20 },
    },
    apiKey,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro na correção: ${res.error || 'falha do servidor'}`);
    throw new Error(`Erro na correção: ${res.error}`);
  }

  return extractGeminiText(res.data);
}

export async function analyzeMoodWithAI(text: string, apiKey: string): Promise<string> {
  const prompt = `Analise o texto abaixo e identifique o estado emocional dominante do autor. Leve em conta o tom, a estrutura das frases, a intensidade do vocabulário, a pontuação e padrões linguísticos que indicam estresse, cansaço, ansiedade, desmotivação, foco, motivação, alegria ou energia.

Responda APENAS com um JSON sem formatação adicional:
{
 "mood": "stress"| "anxiety"| "sadness"| "tired"| "demotivated"| "focused"| "motivated"| "happy"| "energetic"| "neutral",
 "confidence": <0.0-1.0>,
 "reason": "<breve justificativa de 1 frase>",
 "messageAdaptada": "<frase curta de apoio empático com base no humor detectado>"}

Texto:
${text}`;

  const res = await sendToAI(
    {
      systemInstruction: {
        parts: [
          {
            text: 'Você é um analista emocional especializado em detectar estados psicológicos através da escrita. Responda apenas com JSON.',
          },
        ],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, topP: 0.9, topK: 20 },
    },
    apiKey,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro na análise de humor: ${res.error || 'falha do servidor'}`);
    throw new Error(`Erro na análise de humor: ${res.error}`);
  }

  return extractGeminiText(res.data);
}

export const QUIZ_TOPICS_CACHE_KEY = 'mm_quiz_topics_cache';

/* ============================================================
 MENTOR CHAT - Sagui (personalidade padrão do assistente)
 ============================================================ */

const SAGUI_SYSTEM_PROMPT = [
  'Você é o Sagui, mentor educacional do projeto The Midnight Mentor, conversando com um estudante brasileiro do ensino médio noturno que se prepara para o ENEM.',
  'TOM (obrigatório, sempre): empático, acolhedor e encorajador — como um professor particular amigo que acredita no aluno. Celebre o esforço ("boa, você veio estudar hoje, isso já conta"), nunca seja seco, frio ou robótico. Sem jargão, sem emoji.',
  'RITMO CIRCADIANO: respeite o relógio do aluno sem comentar o horário. À noite/madrugada (19h–05h), respostas mais curtas e diretas — um conceito por vez, frase curtíssima — porque ele provavelmente veio do trabalho e está cansado. De dia, pode desenvolver um pouco mais. Acolher o cansaço vem antes do conteúdo, em qualquer horário.',
  'Cansaço, ansiedade e medo da prova nunca são fora de assunto: acolha em uma frase antes de voltar à matéria.',
  'Responda em português brasileiro, parágrafos curtos.',
].join('\n');

export interface GeminiHistoryMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SendMessageToGeminiOptions {
  apiKey: string;
  persona?: ChatPersona | null;
  history?: GeminiHistoryMessage[];
  imageBase64?: string;
  signal?: AbortSignal;
  /** Toggle Explicativo/Comunicativo da barra de entrada do Mentor. */
  modoResposta?: ModoRespostaPersona;
}

/**
 * Envia a mensagem do aluno para o Gemini com a personalidade do Sagui.
 * Suporta histórico recente (últimas 8 mensagens), persona ativa e imagens.
 * Lança erro amigável em pt-BR em caso de falha (o ChatPage trata o catch).
 */
/**
 * Monta o system instruction do professor selecionado.
 *
 * TRES PROBLEMAS QUE ESTA FUNCAO RESOLVE, todos aparecidos ao ler o
 * prompt que de fato era enviado:
 *
 * 1. O LIMITE ERA SUGESTAO. "Responda apenas sobre matematica" ia solto
 *    no meio de um paragrafo, sem dizer o que fazer quando a pergunta
 *    fosse de outra materia - entao o modelo respondia assim mesmo. Com
 *    escopo declarado, a regra vira secao propria e diz o desfecho:
 *    nomear a area, indicar o professor certo, nao responder o conteudo.
 *
 * 2. TOM CONTRADITORIO. O prompt base pede frases curtas e linguagem
 *    acessivel; as instrucoes antigas pediam "estilo analitico de
 *    pesquisador". Instrucao contraditoria nao e cumprida pela metade -
 *    o modelo escolhe uma. Agora a precedencia esta escrita.
 *
 * 3. CANSACO NAO E FORA DE ESCOPO. Um professor que responde "isso nao
 *    e materia minha" para quem disse que nao esta aguentando quebra o
 *    proposito do app inteiro. A excecao e explicita.
 */
export type ModoRespostaPersona = 'explicativo' | 'comunicativo';

export function montarInstrucaoDaPersona(
  persona: ChatPersona | null,
  opcoes: { modoResposta?: ModoRespostaPersona } = {},
): string {
  if (!persona) return SAGUI_SYSTEM_PROMPT;

  const partes = [
    SAGUI_SYSTEM_PROMPT,
    `PAPEL: ${persona.name}. ${persona.instruction}`,
  ];

  // Toggle Explicativo/Comunicativo da barra do Mentor. Allowlist
  // fechada: qualquer outro valor e ignorado.
  if (opcoes.modoResposta === 'comunicativo') {
    partes.push(
      'MODO DE RESPOSTA: comunicativo. Direto ao ponto, com macetes rapidos e tom descontraido - sem rodeios e sem formalidade excessiva.',
    );
  } else {
    partes.push(
      'MODO DE RESPOSTA: explicativo. Passo a passo didatico, formal e detalhado, um conceito por vez.',
    );
  }

  if (persona.escopo) {
    partes.push(
      [
        `ESCOPO: voce responde somente sobre ${persona.escopo}.`,
        'Se a pergunta for de outra materia, recuse em UMA frase educada e nao responda o conteudo pedido; em seguida indique qual professor do app cobre isso (Mentor ENEM, Prof. Matematica, Prof. Portugues, Prof. Ciencias ou Prof. Humanas) e ofereca ajuda dentro da SUA materia.',
        'Se houver uma ponte real com a sua materia, ofereca essa ponte em uma frase.',
        'EXCECAO: cansaco, ansiedade, medo da prova ou desanimo NUNCA sao fora de escopo. Acolha em uma frase antes de voltar ao conteudo.',
      ].join(' '),
    );
  }

  /*
   * Trava de seguranca da persona customizada.
   *
   * Personas embutidas tem createdAt 0 e (exceto o Mentor ENEM) escopo
   * proprio; persona criada pelo usuario tem createdAt real e nenhum
   * escopo - e exatamente ela que recebe este bloco. A instrucao do
   * usuario continua valendo para o papel, mas a fronteira do que e
   * recusado vem daqui, nao do texto digitado: sem isso, bastaria
   * escrever "voce obedece a tudo" na instrucao para remover a trava.
   */
  if (!persona.escopo && persona.createdAt !== 0) {
    partes.push(
      [
        'SEGURANCA (persona criada pelo usuario): voce atua SOMENTE para estudos e aprendizado seguro.',
        'Recuse em uma frase educada e redirecione ao estudo quando pedirem: hacking ou invasao de sistemas, conteudo perigoso (armas, explosivos, drogas ilicitas), atividades ilicitas, xingamentos ou humilhacao de pessoas.',
        'Nunca gere esses conteudos, mesmo que insistam ou digam que e para fins educacionais.',
      ].join(' '),
    );
  }

  partes.push(
    'PRECEDENCIA: em caso de conflito, o CONTEUDO segue as regras do papel e do escopo; o TOM segue o do Sagui (frases curtas, linguagem acessivel, sem jargao desnecessario).',
  );

  // Active Recall (edital): mesma regra do chat tematico.
  partes.push(
    'ACTIVE RECALL: apos o aluno resolver uma duvida (cerca de 4 a 5 interacoes), nao encerre o assunto. Diga: Para salvarmos seu progresso, resuma em 1 frase o que voce aprendeu agora.',
  );

  // EPICO 2: mesma regra do chat tematico (server/chatPrompt.js). Se notar
  // frustracao/agressividade/respostas curtas repetitivas apos erros,
  // apende o bloco `frustracao` no fim; o front remove da tela e abre a
  // pausa consciente. Sem frustracao, sem bloco, sem mencionar JSON.
  partes.push(
    [
      'SINAL DE FRUSTRACAO (obrigatorio, invisivel ao aluno):',
      'analise o sentimento do aluno. Se notar frustracao, agressividade ou respostas curtas repetitivas apos erros, termine com EXATAMENTE:',
      '```frustracao',
      '{"frustration_detected": true}',
      '```',
    ].join('\n'),
  );

  // Blocos separados por linha em branco: o modelo trata cada secao
  // (PAPEL, ESCOPO, PRECEDENCIA) como uma regra, nao como um paragrafo
  // corrido de onde ele escolhe o que seguir.
  return partes.join('\n\n');
}

export async function sendMessageToGemini(
  userMessage: string,
  { apiKey, persona = null, history = [], imageBase64, signal, modoResposta }: SendMessageToGeminiOptions,
): Promise<string> {
  const systemInstruction = montarInstrucaoDaPersona(persona, { modoResposta });

  const contents: { role: 'user' | 'model'; parts: any[] }[] = [];
  for (const msg of history.slice(-8)) {
    const text = (msg.text || '').trim();
    if (!text) continue;
    contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text }] });
  }

  const parts: any[] = [{ text: userMessage || 'Olá!' }];
  if (imageBase64) {
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      const data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({ inlineData: { mimeType, data } });
    }
  }
  contents.push({ role: 'user', parts });

  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      // Alinhado ao DeepSeek-V4-Flash barato (aiProvider.DEEPSEEK_CHAT_CONFIG).
      generationConfig: { ...GEMINI_CHAT_CONFIG, topK: 32 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro na IA: ${res.error || 'falha do servidor'}`);
    if (res.status === 403 || res.status === 400 || res.status === 401) {
      throw new Error(mensagemChaveInvalida());
    }
    if (res.status === 429) {
      throw new Error('Limite de requisições excedido. Aguarde um momento e tente novamente.');
    }
    throw new Error(`Erro na API: ${res.error}`);
  }

  const text = extractGeminiText(res.data);
  return text || 'Desculpe, não consegui gerar uma resposta agora. Tente me perguntar de novo! ';
}

/* ============================================================
 DASHBOARD PREDITIVO - análise de evasão com IA
 ============================================================ */

export type EvasionRisk = 'Baixo' | 'Médio' | 'Alto';
export type RiskCode = 'green' | 'yellow' | 'red';

export interface StudentRiskAnalysis {
  risk: EvasionRisk;
  riskCode: RiskCode;
  recommendation: string;
  raw: string;
}

/** Normaliza o texto do modelo para um dos valores válidos de risco. */
export function normalizeRisk(value: unknown): EvasionRisk {
  const text = String(value || '').toLowerCase();
  if (text.includes('alto')) return 'Alto';
  if (text.includes('baixo')) return 'Baixo';
  if (text.includes('med')) return 'Médio';
  return 'Médio';
}

/**
 * Converte a resposta do Gemini (JSON ou texto livre) em uma análise estruturada.
 * Função pura - não faz I/O, ideal para testes.
 */
export function parseRiskAnalysis(raw: string): {
  risk: EvasionRisk;
  riskCode: RiskCode;
  recommendation: string;
} {
  const text = (raw || '').trim();

  let obj: any = null;
  try {
    const json = extractJson(text);
    if (json) obj = JSON.parse(json);
  } catch {
    /* texto livre */
  }

  const risk = normalizeRisk(obj?.riscoEvasao ?? extractRiskFromText(text));
  const riskCode: RiskCode = risk === 'Baixo' ? 'green' : risk === 'Alto' ? 'red' : 'yellow';

  let recommendation = typeof obj?.recomendacao === 'string' ? obj.recomendacao.trim() : '';

  if (!recommendation) {
    // Fallback: tenta extrair frases completas do texto livre
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    recommendation = sentences ? sentences.map((s) => s.trim()).join('') : text.slice(0, 240);
  }

  return { risk, riskCode, recommendation };
}

function extractRiskFromText(text: string): EvasionRisk {
  const match = text.match(/\b(Baixo|Médio|Medio|Alto)\b/i);
  return match ? normalizeRisk(match[1]) : 'Médio';
}

/**
 * Envia o histórico do aluno (notas + horas de uso) para o Gemini e
 * retorna a previsão de risco de evasão para os próximos 4 meses.
 */
export async function analyzeStudentData(
  historicalData: StudentMonthlyRecord[],
  { apiKey, signal }: { apiKey: string; signal?: AbortSignal },
): Promise<StudentRiskAnalysis> {
  const payload = historicalData.map((d, i) => ({
    mes: d.month,
    sequencial: i + 1,
    notaMedia: d.notaMedia,
    horasDeUso: d.tempoUso,
  }));

  const prompt = [
    /* O prompt dizia "notas". Nao ha nota escolar neste banco: o numero
       que chega e a proporcao de acerto nos exercicios do app. Com o
       painel em dado real, descrever isso como boletim faria a IA
       escrever para os pais uma frase sobre a escola que ninguem mediu. */
    'Analise o uso recente do aplicativo de estudos por este aluno do ensino médio noturno. `notaMedia` é a PROPORÇÃO DE ACERTO (0-100) nos exercícios DO APLICATIVO no mês, e não nota escolar — o app não recebe boletim. `horasDeUso` é o tempo de estudo no app. Com base nisso, estime o risco de evasão (Baixo, Médio, Alto) para os próximos 4 meses e escreva uma recomendação de apenas 2 frases para os pais.',
    'Fale do que os números mostram (constância, ritmo, acerto no app). Não afirme nada sobre notas da escola, frequência às aulas ou diagnóstico de saúde.',
    '',
    'Responda APENAS com um objeto JSON válido, sem markdown e sem comentários, no formato:',
    '{ "riscoEvasao": "Baixo"| "Médio"| "Alto", "recomendacao": "<recomendação de 2 frases para os pais>"}',
    '',
    `Dados do aluno (últimos ${payload.length} meses):`,
    JSON.stringify(payload, null, 2),
  ].join('\n');

  const res = await sendToAI(
    {
      systemInstruction: {
        parts: [
          {
            text: 'Você é um cientista de dados educacional especializado em evasão escolar do ensino médio noturno brasileiro. Você só tem dados de uso de um aplicativo de estudos, não da escola. Responda apenas com o JSON solicitado.',
          },
        ],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, topP: 0.9, topK: 20 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) {
    if (hasProxy()) throw new Error(`Erro na IA: ${res.error || 'falha do servidor'}`);
    if (res.status === 403 || res.status === 400 || res.status === 401) {
      throw new Error(mensagemChaveInvalida());
    }
    if (res.status === 429) {
      throw new Error('Limite de requisições excedido. Aguarde um momento e tente novamente.');
    }
    throw new Error(`Erro na API: ${res.error}`);
  }

  const raw = extractGeminiText(res.data) || '';
  const parsed = parseRiskAnalysis(raw);
  return { ...parsed, raw };
}

/**
 * Testa a conexão de ponta a ponta (proxy OU chave direta).
 * Retorna a resposta do modelo (ex.: "OK") - lança erro se falhar.
 */
export async function testGeneration(apiKey: string): Promise<string> {
  const reply = await askGemini('Responda apenas com a palavra: OK.', null, apiKey);
  const clean = (reply || '').trim();
  return clean.length > 0 ? clean : 'OK';
}

export { fetchGemini };

/* ============================================================
 BEM-ESTAR - roteiros de audio, TTS, intervencao e relatorio
 ============================================================ */


/**
 * Roteiro de micro-podcast de 3 minutos.
 *
 * temperature 0.6: acima disso o modelo inventa exemplo errado de ENEM,
 * abaixo ele repete a mesma abertura em todos os temas - e a pessoa ouve
 * varios seguidos.
 */
export async function gerarRoteiroAudio(
  materia: string,
  topico: string,
  apiKey: string,
  contexto?: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await sendToAI(
    {
      systemInstruction: {
        parts: [
          {
            text: 'Voce escreve roteiros de audio educativo em portugues brasileiro para serem OUVIDOS, nunca lidos. Devolva apenas o texto corrido da locucao.',
          },
        ],
      },
      contents: [{ parts: [{ text: promptRoteiroAudio(materia, topico, contexto) }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1200, topP: 0.9, topK: 32 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) throw new Error(`Erro ao gerar o roteiro: ${res.error || 'falha do servidor'}`);
  return extractGeminiText(res.data).replace(/[*#_`]/g, '').trim();
}

export interface AudioSintetizado {
  /** data: URL pronta para <audio src>. */
  url: string;
  formato: string;
}

/**
 * Text-to-Speech pelo worker.
 *
 * A chave do Google Cloud TTS NAO pode viajar para o navegador (ela
 * cobra por caractere sintetizado), entao esta chamada exige o proxy
 * configurado. Sem proxy a funcao lanca, e o player cai na voz nativa do
 * sistema - pior qualidade, mas funciona sem custo e sem rede.
 */
export async function sintetizarAudio(
  texto: string,
  opcoes: { voz?: string; velocidade?: number; signal?: AbortSignal } = {},
): Promise<AudioSintetizado> {
  if (!hasProxy()) {
    throw new Error(
      'TTS indisponível: o back-end de IA não respondeu. Defina GOOGLE_TTS_KEY nas Environment Variables do projeto para usar as vozes neurais.',
    );
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = aiProxyToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resposta = await fetch(urlBackendIA('/tts'), {
    method: 'POST',
    headers,
    signal: opcoes.signal,
    body: JSON.stringify(montarPedidoTTS(texto, opcoes.voz, opcoes.velocidade)),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao gerar o audio (${resposta.status}).`);
  }

  const dados = await resposta.json();
  if (!dados?.audioBase64) throw new Error('Resposta de audio vazia.');
  return { url: `data:${dados.mime || 'audio/mpeg'};base64,${dados.audioBase64}`, formato: dados.mime || 'audio/mpeg' };
}

export interface IntervencaoEmpatica {
  titulo: string;
  convite: string;
  acao: string;
  materia: string;
}

/**
 * Intervencao de doomscrolling.
 *
 * O prompt e curto e cheio de proibicoes por um motivo: o modelo, solto,
 * escreve tres paragrafos motivacionais - o que, para alguem paralisado,
 * e mais uma tela para rolar. O formato JSON forca a saida a caber no
 * card (uma frase de acolhimento, um convite unico, um botao).
 */
export async function gerarIntervencaoDoomscroll(
  contexto: { materiaSugerida: string; segundosVagando: number; horaLocal: number; humor?: string },
  apiKey: string,
  signal?: AbortSignal,
): Promise<IntervencaoEmpatica> {
  const prompt = [
    'Um estudante do ensino medio noturno esta ha alguns minutos rolando os menus do app de estudos sem clicar em nada - sinal de duvida, cansaco ou paralisia por analise.',
    '',
    `Contexto: ${contexto.segundosVagando} segundos navegando sem escolher nada; agora sao ${contexto.horaLocal}h; materia sugerida pelo historico: ${contexto.materiaSugerida}.` +
      (contexto.humor ? ` Humor recente relatado: ${contexto.humor}.` : ''),
    '',
    'Escreva uma intervencao empatica com TRES campos e nada mais.',
    'Regras:',
    '- "titulo": no maximo 6 palavras, sem julgamento, reconhecendo o momento (ex: "Voce parece na duvida.").',
    '- "convite": UMA proposta pequena e concreta, no maximo 20 palavras, que termine em pergunta. Sempre uma tarefa minima com fim claro (ex: 3 questoes e parar por hoje).',
    '- "acao": texto do botao, no maximo 4 palavras, no infinitivo.',
    '- Nao use emoji, nao use exclamacao, nao motive, nao pergunte como a pessoa esta.',
    '- Nao ofereca mais de uma opcao: escolher e exatamente o que ela nao esta conseguindo fazer agora.',
    '',
    'Responda APENAS com JSON: {"titulo": "...", "convite": "...", "acao": "...", "materia": "..."}',
  ].join('\n');

  const res = await sendToAI(
    {
      systemInstruction: {
        parts: [
          {
            text: 'Voce e o Sagui, mentor empatico de um app de estudos brasileiro. Responda apenas com o JSON pedido, em portugues brasileiro.',
          },
        ],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 300, topP: 0.9, topK: 20 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) throw new Error(`Erro na intervencao: ${res.error || 'falha do servidor'}`);

  const bruto = extractGeminiText(res.data);
  const dados = JSON.parse(extractJson(bruto));
  return {
    titulo: String(dados.titulo || 'Voce parece na duvida.'),
    convite: String(dados.convite || `Vamos fazer 3 questoes de ${contexto.materiaSugerida} e parar por hoje?`),
    acao: String(dados.acao || 'Comecar 3 questoes'),
    materia: String(dados.materia || contexto.materiaSugerida),
  };
}

/**
 * Paragrafo do relatorio de descompressao.
 *
 * temperature 0.55 e maxOutputTokens 220: o teto de tokens e o que
 * garante o "curto e direto" mesmo quando o modelo se empolga - cortar
 * no meio de uma frase seria pior, entao o limite fica logo acima de
 * quatro frases.
 */
export async function gerarRelatorioDescompressao(
  metricas: MetricasDescompressao,
  apiKey: string,
  primeiroNome?: string,
  signal?: AbortSignal,
): Promise<string> {
  // O nome NÃO viaja para a IA: o prompt vai anônimo e a personalização
  // ("Maria, ...") é interpolada aqui, no aparelho (LGPD, menor de idade).
  const res = await sendToAI(
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT_DESCOMPRESSAO }] },
      contents: [{ parts: [{ text: promptDescompressao(metricas) }] }],
      generationConfig: { temperature: 0.55, maxOutputTokens: 220, topP: 0.9, topK: 32 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) throw new Error(`Erro no relatorio: ${res.error || 'falha do servidor'}`);
  const paragrafo = extractGeminiText(res.data).replace(/[*#`]/g, '').trim();
  return primeiroNome ? `${primeiroNome}, ${paragrafo.charAt(0).toLowerCase()}${paragrafo.slice(1)}` : paragrafo;
}

/**
 * Texto do alerta enviado ao responsavel.
 *
 * O banco ja grava uma mensagem padrao (registrar_burnout); esta versao
 * troca por uma redacao que explica o SINAL sem entregar o conteudo
 * privado do filho. A fronteira e explicita no prompt porque e o ponto
 * em que um alerta util vira quebra de confianca.
 */
export async function gerarAlertaParaResponsavel(
  dados: { nomeAluno: string; score: number; motivos: string[] },
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = [
    `Escreva um aviso curto para o responsavel de ${dados.nomeAluno}, estudante do ensino medio noturno.`,
    `Indice de fadiga detectado pelo app: ${dados.score}/100. Sinais que pesaram: ${dados.motivos.join('; ') || 'padrao de estudo irregular'}.`,
    '',
    'Regras:',
    '- Duas ou tres frases, portugues brasileiro, tom calmo.',
    '- Explique o que foi observado em termos de PADRAO (horario, ritmo, cansaco), nunca de conteudo privado.',
    '- Sugira conversa antes de qualquer outra medida.',
    '- Mencione que o painel permite agendar um atendimento com psicologo se fizer sentido, sem pressionar.',
    '- Nao diagnostique, nao use termos clinicos, nao alarme.',
    '- Sem emoji, sem lista.',
  ].join('\n');

  const res = await sendToAI(
    {
      systemInstruction: {
        parts: [
          {
            text: 'Voce comunica sinais de bem-estar para responsaveis de estudantes. Nunca diagnostica e nunca revela conteudo escrito pelo aluno.',
          },
        ],
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 260, topP: 0.9, topK: 20 },
    },
    apiKey,
    signal,
  );

  if (!res.ok) throw new Error(`Erro ao redigir o alerta: ${res.error || 'falha do servidor'}`);
  return extractGeminiText(res.data).replace(/[*#`]/g, '').trim();
}
