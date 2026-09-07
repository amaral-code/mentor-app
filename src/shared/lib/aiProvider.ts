/**
 * Provedor de IA (Gemini | DeepSeek).
 *
 * FONTE UNICA da escolha do provedor no front. Todo o resto (aiService,
 * chatGrounding, essayScan) consulta este modulo em vez de ler
 * import.meta.env diretamente para decidir o transporte.
 *
 * Dois caminhos, mesmos prompts:
 *   - gemini   -> API REST do Google (systemInstruction/contents/generationConfig)
 *   - deepseek -> chat completions compativel OpenAI
 *                (POST {model, messages, temperature, max_tokens, top_p})
 *
 * Os system prompts por area NAO mudam com o provedor: o texto que vai no
 * campo `system` do DeepSeek e exatamente o mesmo que ia em
 * `systemInstruction.parts[0].text` do Gemini. So o envelope HTTP muda.
 */

export type AIProvider = 'gemini' | 'deepseek';

/** Modelo padrao quando o provedor e DeepSeek (identificador exigido). */
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';

const providerRaw = ((import.meta.env.VITE_AI_PROVIDER as string) || '').trim().toLowerCase();

export const AI_PROVIDER: AIProvider = providerRaw === 'deepseek' ? 'deepseek' : 'gemini';

export const AI_MODEL: string =
  ((import.meta.env.VITE_AI_MODEL as string) || '').trim() ||
  (AI_PROVIDER === 'deepseek' ? DEEPSEEK_DEFAULT_MODEL : 'gemini-2.0-flash');

/** Base da API DeepSeek (padrao oficial, compativel OpenAI). */
export const DEEPSEEK_BASE_URL: string =
  (((import.meta.env.VITE_DEEPSEEK_BASE_URL as string) || 'https://api.deepseek.com').trim() ||
    'https://api.deepseek.com').replace(/\/+$/, '');

export const isDeepSeekProvider = (): boolean => AI_PROVIDER === 'deepseek';

/* ============================================================
 * BACK-END DO DEEPSEEK (nunca direto do navegador)
 * ------------------------------------------------------------
 * O front NAO chama api.deepseek.com: alem de expor a chave no bundle,
 * requisicao cross-origin com Authorization cai em bloqueio de
 * third-party/adblock ("Failed to fetch" sem resposta HTTP).
 *
 * Dois back-ends, mesmo contrato:
 *   worker   -> VITE_AI_BASE_URL publicado (producao). Protocolo do
 *               worker: envelope Gemini + {provider, model}; a chave
 *               (DEEPSEEK_API_KEY) e secret do provedor.
 *   devProxy -> /deepseek-api do Vite dev (desenvolvimento local).
 *               Same-origin, sem CORS; o Vite injeta o Authorization no
 *               servidor a partir de DEEPSEEK_API_KEY (sem VITE_, nunca vai
 *               para o bundle). So existe com a chave no .env + restart.
 * ============================================================ */

/** Rota same-origin do proxy local (somente `vite dev`). */
export const DEEPSEEK_DEV_PROXY_PATH = '/deepseek-api';

export type BackendDeepSeek = 'worker' | 'devProxy' | 'nenhum';

/** Decide o back-end sem tocar em segredo (funcao pura, testavel). */
export function tipoBackendDeepSeek(temProxy: boolean, ehDev: boolean): BackendDeepSeek {
  if (temProxy) return 'worker';
  if (ehDev) return 'devProxy';
  return 'nenhum';
}

/** Back-end efetivo neste ambiente. */
export function backendDeepSeekAtual(temProxy: boolean): BackendDeepSeek {
  return tipoBackendDeepSeek(temProxy, import.meta.env.DEV);
}

/** Erro acionavel quando nao ha back-end (nunca tenta cross-origin). */
export function erroSemBackendDeepSeek(): Error {
  return new Error(
    'Backend de IA não configurado para DeepSeek. ' +
      'No desenvolvimento: adicione DEEPSEEK_API_KEY ao .env (raiz, SEM prefixo VITE_) e reinicie com npm run dev. ' +
      'Em produção: publique o worker (server/worker.js) com o secret DEEPSEEK_API_KEY e defina VITE_AI_BASE_URL.',
  );
}

/** Mensagem do proxy local sem chave (rota nao registrada pelo Vite). */
export function erroProxyLocalSemChave(): Error {
  return new Error(
    'Proxy local sem chave: adicione DEEPSEEK_API_KEY ao .env (raiz, SEM prefixo VITE_) e reinicie o dev server.',
  );
}

/** Combina o cancelamento do usuario com o timeout (AbortSignal.any). */
export function sinalComTimeout(sinalUsuario: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const sinais: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
  if (sinalUsuario) sinais.push(sinalUsuario);
  return sinais.length === 1 ? sinais[0] : AbortSignal.any(sinais);
}

export const getAIProviderInfo = () => ({
  provider: AI_PROVIDER,
  model: AI_MODEL,
  deepseekBaseUrl: DEEPSEEK_BASE_URL,
});

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiContent {
  role?: 'user' | 'model';
  parts?: GeminiPart[];
}

/** Extrai so o texto das parts (imagens sao ignoradas no caminho DeepSeek texto). */
function textoDasParts(parts: GeminiPart[] | undefined): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

/**
 * Converte o envelope Gemini (systemInstruction + contents) em mensagens
 * OpenAI. Funcao pura - nao faz I/O, ideal para testes.
 */
export function toChatCompletionsMessages(
  systemInstruction: { parts: { text: string }[] } | undefined,
  contents: GeminiContent[],
): ChatCompletionMessage[] {
  const messages: ChatCompletionMessage[] = [];

  const systemText = (systemInstruction?.parts ?? [])
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n\n')
    .trim();
  if (systemText) messages.push({ role: 'system', content: systemText });

  for (const c of contents ?? []) {
    const text = textoDasParts(c?.parts);
    if (!text) continue;
    messages.push({ role: c?.role === 'model' ? 'assistant' : 'user', content: text });
  }

  return messages;
}

/** generationConfig (Gemini) -> parametros do chat completions. */
export function geminiGenConfigToDeepSeek(
  generationConfig: Record<string, unknown> = {},
): { temperature?: number; max_tokens?: number; top_p?: number; response_format?: unknown } {
  const out: { temperature?: number; max_tokens?: number; top_p?: number; response_format?: unknown } = {};
  const temp = Number((generationConfig as Record<string, unknown>).temperature);
  const maxTokens = Number(
    (generationConfig as Record<string, unknown>).maxOutputTokens ??
      (generationConfig as Record<string, unknown>).max_tokens,
  );
  const topP = Number((generationConfig as Record<string, unknown>).topP ?? (generationConfig as Record<string, unknown>).top_p);
  if (Number.isFinite(temp)) out.temperature = temp;
  if (Number.isFinite(maxTokens) && maxTokens > 0) out.max_tokens = Math.floor(maxTokens);
  if (Number.isFinite(topP)) out.top_p = topP;
  // Saida JSON estrita (quiz, mapa mental): repassada ao chat completions.
  // So e incluida pelo chamador em fluxos DeepSeek - o Gemini nao recebe.
  const rf = (generationConfig as Record<string, unknown>).response_format;
  if (rf && typeof rf === 'object') out.response_format = rf;
  return out;
}

/**
 * Extrai o texto tanto do formato DeepSeek/OpenAI
 * (choices[0].message.content) quanto do formato Gemini
 * (candidates[0].content.parts[].text), para que o resto do app nao
 * precise saber qual provedor respondeu.
 */
export function extractDeepSeekText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;

  const choices = d.choices as Array<{ message?: { content?: unknown }; text?: unknown }> | undefined;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    const content = first?.message?.content;
    if (typeof content === 'string' && content.trim()) return content;
    if (Array.isArray(content)) {
      const joined = content
        .map((p) => (typeof p === 'string' ? p : typeof (p as { text?: unknown })?.text === 'string' ? String((p as { text?: unknown }).text) : ''))
        .join('')
        .trim();
      if (joined) return joined;
    }
    if (typeof first?.text === 'string' && first.text.trim()) return first.text;
  }

  // Fallback: resposta ja no envelope Gemini (ex.: via worker que reembala).
  const candidates = (d as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
    if (joined) return joined;
  }
  return '';
}

/**
 * Embala um texto puro no envelope Gemini minimo, para que
 * `extractGeminiText` do aiService continue funcionando sem alteracao
 * quando a resposta veio do DeepSeek.
 */
export function wrapAsGeminiResponse(text: string): unknown {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

/* ============================================================
 * RESILIENCIA DE REDE (timeout + diagnostico)
 * ------------------------------------------------------------
 * `fetch` puro nao tem timeout: numa rede que engole pacotes a chamada
 * trava para sempre. Este helper aborta apos TIMEOUT, repassa o
 * cancelamento do usuario e classifica a falha (timeout, offline,
 * bloqueio/DNS) com log de diagnostico - SEM jamais logar a chave.
 * ============================================================ */

/** Tempo limite de cada tentativa DeepSeek (evita trava indefinida). */
export const DEEPSEEK_TIMEOUT_MS = 30000;

/* ============================================================
 * CONFIG UNICA DO CHAT — DeepSeek-V4-Flash (versão mais barata)
 * ------------------------------------------------------------
 * Todos os caminhos de chat (worker, proxy local dev, Gemini
 * direto como fallback) usam ESTES valores. Motivo: antes cada
 * arquivo tinha seu temperature/max_tokens (0.4/1024, 0.5/1400,
 * 0.7/1024), então a mesma pergunta custava e respondia diferente
 * conforme o transporte. Centralizar aqui mantém custo mínimo e
 * comportamento idêntico em dev, preview e produção.
 * ============================================================ */

/** Chat completions (DeepSeek): teto enxuto = menos tokens = mais barato. */
export const DEEPSEEK_CHAT_CONFIG = {
  temperature: 0.5,
  max_tokens: 1000,
  top_p: 0.9,
} as const;

/** Envelope Gemini equivalente (mesmos valores, nomes do Google). */
export const GEMINI_CHAT_CONFIG = {
  temperature: 0.5,
  maxOutputTokens: 1000,
  topP: 0.9,
} as const;

/** Resposta vazia (content null, filtro, corte) nunca vira bolha vazia. */
export function garantirTextoResposta(texto: unknown): string {
  const t = typeof texto === 'string' ? texto.trim() : '';
  if (!t) throw new Error('A IA devolveu uma resposta vazia. Tente de novo com outras palavras.');
  return t;
}

/** true só para cancelamento explícito do usuário (não para timeout). */
export function isCancelamentoUsuario(erro: unknown, sinalUsuario?: AbortSignal | null): boolean {
  if (erro instanceof Error && erro.name === 'AbortError' && sinalUsuario?.aborted) {
    const motivo = (sinalUsuario as AbortSignal & { reason?: unknown }).reason;
    const nomeMotivo = motivo instanceof Error ? motivo.name : '';
    // Timeout usa TimeoutError como motivo — não é cancelamento do usuário.
    return nomeMotivo !== 'TimeoutError';
  }
  return false;
}

export interface ContextoChamada {
  model?: string;
  mensagens?: number;
  via?: string;
}

export interface DiagnosticoRede {
  destino: string;
  online: boolean | null;
  tipo: 'timeout' | 'cancelado' | 'sem_conexao' | 'bloqueio_ou_dns' | 'desconhecido';
  erroNome: string;
  erroMensagem: string;
  causa?: string;
}

/** Classifica o erro bruto do fetch. Funcao pura - nao faz I/O. */
export function diagnosticarErroRede(destino: string, erro: unknown, canceladoPeloUsuario: boolean): DiagnosticoRede {
  const nome = erro instanceof Error ? erro.name : typeof erro;
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const causa = erro instanceof Error && erro.cause ? String((erro.cause as Error)?.message ?? erro.cause) : undefined;
  const online = typeof navigator !== 'undefined' ? navigator.onLine : null;

  let tipo: DiagnosticoRede['tipo'] = 'desconhecido';
  if (canceladoPeloUsuario) {
    tipo = /timeout/i.test(mensagem + ' ' + (causa ?? '')) ? 'timeout' : 'cancelado';
  } else if (online === false) {
    tipo = 'sem_conexao';
  } else if (/timeout/i.test(mensagem + ' ' + (causa ?? ''))) {
    tipo = 'timeout';
  } else if (nome === 'TypeError' || /fetch|network|load failed/i.test(mensagem)) {
    // O navegador nao distingue DNS, TLS, firewall e adblock: todos viram
    // TypeError "Failed to fetch". O destino + online/offline e o maximo
    // que da para afirmar do lado do cliente.
    tipo = 'bloqueio_ou_dns';
  }

  return { destino, online, tipo, erroNome: nome, erroMensagem: mensagem, causa };
}

const DICA_POR_TIPO: Record<DiagnosticoRede['tipo'], string> = {
  timeout: 'O servidor nao respondeu em 30s. Tente de novo ou teste em outra rede.',
  cancelado: 'A requisicao foi cancelada.',
  sem_conexao: 'O navegador esta offline. Verifique sua conexao com a internet.',
  bloqueio_ou_dns: 'Sem resposta do servidor: verifique adblock/VPN/firewall, ou teste em outra rede.',
  desconhecido: 'Verifique sua conexao e tente de novo.',
};

/** Mensagem amigavel + acionavel a partir do diagnostico. */
export function mensagemErroRede(d: DiagnosticoRede): string {
  return `Falha de rede ao alcançar ${d.destino} (${d.erroMensagem || d.erroNome}). ${DICA_POR_TIPO[d.tipo]}`;
}

/**
 * fetch com timeout e diagnostico para o DeepSeek.
 *
 * NUNCA loga headers/corpo (a chave viaja no Authorization). O log de
 * diagnostico (console.debug) contem so destino, modelo, nº de mensagens
 * e o erro classificado - o suficiente para distinguir timeout, offline
 * e bloqueio/DNS no F12.
 */
export async function fetchDeepSeek(
  url: string,
  init: RequestInit,
  opcoes: {
    timeoutMs?: number;
    sinalUsuario?: AbortSignal | null;
    contexto?: ContextoChamada;
    /** Rotulo exibido no erro/log (ex.: proxy local). Padrao: base DeepSeek. */
    rotuloDestino?: string;
  } = {},
): Promise<Response> {
  const { timeoutMs = DEEPSEEK_TIMEOUT_MS, sinalUsuario = null, contexto = {}, rotuloDestino } = opcoes;
  const destino = rotuloDestino ?? DEEPSEEK_BASE_URL;
  const controlador = new AbortController();
  let expirou = false;

  const repassarCancelamento = () => {
    const motivo =
      (sinalUsuario as (AbortSignal & { reason?: unknown }) | null)?.reason ??
      new DOMException('Operação cancelada pelo usuário.', 'AbortError');
    controlador.abort(motivo);
  };
  if (sinalUsuario) {
    if (sinalUsuario.aborted) repassarCancelamento();
    else sinalUsuario.addEventListener('abort', repassarCancelamento, { once: true });
  }
  const timer = setTimeout(() => {
    expirou = true;
    controlador.abort(new DOMException(`Timeout de ${timeoutMs}ms ao chamar ${destino}.`, 'TimeoutError'));
  }, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controlador.signal });
  } catch (erro) {
    const canceladoPeloUsuario = !!sinalUsuario?.aborted && !expirou;
    const diag = diagnosticarErroRede(destino, canceladoPeloUsuario ? sinalUsuario?.reason ?? erro : erro, canceladoPeloUsuario);
    if (expirou && diag.tipo !== 'timeout') diag.tipo = 'timeout';
    // Log seguro: nenhum segredo (sem headers, sem body, sem chave).
    console.debug('[deepseek] falha de rede', {
      endpoint: url.startsWith('http') ? url.replace(DEEPSEEK_BASE_URL, '') : url,
      model: contexto.model,
      mensagens: contexto.mensagens,
      via: contexto.via,
      timeoutMs,
      ...diag,
    });
    throw new Error(mensagemErroRede(diag), { cause: erro });
  } finally {
    clearTimeout(timer);
    sinalUsuario?.removeEventListener?.('abort', repassarCancelamento);
  }
}
