/**
 * Configuracao do app lida em TEMPO DE EXECUCAO (Environment Variables).
 *
 * ==================================================================
 * POR QUE NAO BASTA `import.meta.env`
 * ==================================================================
 * O Vite nao "le variaveis de ambiente" no navegador: durante o build
 * ele TROCA cada `import.meta.env.VITE_X` pelo texto do valor. O que
 * chega ao usuario e uma string congelada dentro do bundle.
 *
 * Numa app publicada na Vercel isso gera dois problemas concretos:
 *
 *   1. Mudar uma variavel no painel nao muda nada ate um novo deploy.
 *   2. Um build disparado antes de as variaveis existirem produz um
 *      bundle com strings VAZIAS gravadas - e o sintoma no ar e um app
 *      que "perdeu o Supabase" sem nenhum erro no console.
 *
 * ==================================================================
 * COMO FUNCIONA AGORA
 * ==================================================================
 * `/api/config` (funcao serverless) le `process.env` a cada requisicao e
 * devolve so a parte publica da configuracao. O app busca essa rota uma
 * unica vez, antes de renderizar, e o resultado vira a fonte preferida.
 *
 * `import.meta.env.VITE_*` continua existindo como RESERVA, para o caso
 * de rodar o front sem back-end (`vite build` + servidor estatico puro).
 * A precedencia e sempre: valor do servidor -> valor do build -> padrao.
 *
 * Todo acesso e por FUNCAO, nunca por constante de modulo. Constante
 * congelaria o valor no instante do import - ou seja, antes de
 * `/api/config` responder, recriando o bug que este arquivo remove.
 */

export type ProvedorIA = 'gemini' | 'deepseek';

export interface RecursosBackend {
  deepseek: boolean;
  gemini: boolean;
  tts: boolean;
  email: boolean;
  pagamento: string;
}

export interface ConfigPublica {
  supabaseUrl: string;
  supabaseAnonKey: string;
  aiProvider: ProvedorIA;
  aiModel: string;
  aiVisionModel: string;
  aiBaseUrl: string;
  n8nWebhookUrl: string;
  backendIA: boolean;
  recursos: RecursosBackend;
}

/** Resposta de `/api/config`. Null enquanto nao carregou (ou sem back-end). */
let doServidor: Partial<ConfigPublica> | null = null;
let emVoo: Promise<void> | null = null;

/** Le uma `VITE_*` do build, ja aparada. */
function doBuild(nome: string): string {
  const valor = (import.meta.env as Record<string, unknown>)[nome];
  return typeof valor === 'string' ? valor.trim() : '';
}

/** Servidor vence, mas so com valor util: string vazia cai para o build. */
function preferir(valorServidor: unknown, valorBuild: string): string {
  const s = typeof valorServidor === 'string' ? valorServidor.trim() : '';
  return s || valorBuild;
}

export const supabaseUrl = (): string =>
  preferir(doServidor?.supabaseUrl, doBuild('VITE_SUPABASE_URL')).replace(/\/+$/, '');

export const supabaseAnonKey = (): string =>
  preferir(doServidor?.supabaseAnonKey, doBuild('VITE_SUPABASE_ANON_KEY'));

export const aiProvider = (): ProvedorIA =>
  preferir(doServidor?.aiProvider, doBuild('VITE_AI_PROVIDER')).toLowerCase() === 'deepseek'
    ? 'deepseek'
    : 'gemini';

export const aiModel = (): string => preferir(doServidor?.aiModel, doBuild('VITE_AI_MODEL'));

export const aiVisionModel = (): string =>
  preferir(doServidor?.aiVisionModel, doBuild('VITE_AI_VISION_MODEL')) || 'gemini-1.5-flash';

export const deepseekBaseUrl = (): string =>
  (doBuild('VITE_DEEPSEEK_BASE_URL') || 'https://api.deepseek.com').replace(/\/+$/, '');

export const n8nWebhookUrl = (): string =>
  preferir(doServidor?.n8nWebhookUrl, doBuild('VITE_N8N_WEBHOOK_URL'));

/**
 * Origem de um back-end de IA EXTERNO (Cloudflare Worker).
 *
 * Vazio e o caso normal desta implantacao: o back-end vive em `/api` no
 * mesmo dominio. So preencha para apontar de volta a um worker.
 */
export const aiBaseUrl = (): string =>
  preferir(doServidor?.aiBaseUrl, doBuild('VITE_AI_BASE_URL')).replace(/\/+$/, '');

/**
 * Token do worker externo.
 *
 * Nao vem de `/api/config` de proposito: com back-end na mesma origem ele
 * e desnecessario (nao ha origem terceira para barrar), e publicar um
 * token numa rota aberta seria entregar a chave junto com a fechadura.
 */
export const aiProxyToken = (): string => doBuild('VITE_AI_PROXY_TOKEN');

/** Existe back-end de IA alcancavel? (mesma origem ou worker externo) */
export const temBackendIA = (): boolean => doServidor?.backendIA === true || aiBaseUrl().length > 0;

/** O back-end e a rota `/api` deste mesmo dominio? */
export const backendMesmaOrigem = (): boolean => doServidor?.backendIA === true && !aiBaseUrl();

export const recursosBackend = (): RecursosBackend =>
  doServidor?.recursos ?? { deepseek: false, gemini: false, tts: false, email: false, pagamento: 'simulado' };

/**
 * URL final de uma rota do back-end de IA.
 *
 * Recebe sempre a rota no formato do worker (`/generate`,
 * `/api/chat/completions`) e resolve conforme o destino:
 *
 *   worker externo -> `https://worker.dev/generate`   (rota intacta)
 *   mesma origem   -> `/api/generate`                 (prefixo `/api`,
 *                     exigido pela Vercel, onde so `/api/*` e funcao)
 *
 * O `server/adapter.js` desfaz esse prefixo antes de entregar ao worker,
 * entao os dois caminhos chegam ao mesmo roteador.
 */
export function urlBackendIA(rota: string): string {
  const base = aiBaseUrl();
  if (base) return `${base}${rota}`;
  return rota.startsWith('/api/') ? rota : `/api${rota}`;
}

/** Rotulo do destino para mensagens de erro e diagnostico de rede. */
export const destinoBackendIA = (): string => aiBaseUrl() || 'o servidor do app (/api)';

/**
 * Busca `/api/config` uma unica vez. Chamada no boot, antes de renderizar.
 *
 * Nunca rejeita: sem back-end (front estatico puro, ou `vite build` +
 * `serve`), o app segue com os valores do build. Falhar aqui deixaria a
 * tela branca por causa de uma rota opcional.
 */
export function carregarConfigRuntime(): Promise<void> {
  if (emVoo) return emVoo;

  emVoo = (async () => {
    try {
      const resposta = await fetch('/api/config', {
        headers: { Accept: 'application/json' },
        /* Sem teto, uma rede que engole pacotes seguraria o boot para
           sempre; 6s e mais que suficiente para uma leitura de env. */
        signal: AbortSignal.timeout(6000),
      });
      if (!resposta.ok) return;

      /* Sem back-end, o fallback de SPA devolve o index.html com status
         200. Checar o tipo evita tratar HTML como configuracao. */
      const tipo = resposta.headers.get('Content-Type') || '';
      if (!tipo.includes('application/json')) return;

      const dados: unknown = await resposta.json();
      if (dados && typeof dados === 'object') doServidor = dados as Partial<ConfigPublica>;
    } catch {
      /* Silencio proposital: rota opcional, app funciona sem ela. */
    }
  })();

  return emVoo;
}

/** Reinicia o estado do modulo. Existe para os testes. */
export function _resetarConfigRuntime(): void {
  doServidor = null;
  emVoo = null;
}
