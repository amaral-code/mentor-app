/**
 * Adaptador do back-end de IA (server/worker.js) para QUALQUER runtime.
 *
 * ------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 * ------------------------------------------------------------------
 * `server/worker.js` e escrito 100% em APIs web padrao
 * (`Request`/`Response`/`fetch`) e nao usa nada exclusivo da Cloudflare
 * no caminho HTTP. Isso significa que o MESMO codigo roda em tres
 * lugares sem fork:
 *
 *   1. Cloudflare Workers  -> `export default { fetch }` nativo.
 *   2. Vercel Functions    -> `api/[...rota].js` (Web handler).
 *   3. Vite dev server     -> middleware Node (vite.config.ts).
 *
 * Um unico back-end elimina a classe de bug mais cara deste projeto:
 * "funciona em dev e quebra em producao" porque dev falava com o proxy
 * do Vite e producao com o worker.
 *
 * ------------------------------------------------------------------
 * NORMALIZACAO DE ROTA
 * ------------------------------------------------------------------
 * Na Vercel, SO arquivos dentro de `/api` viram funcao, entao tudo e
 * servido sob `/api/...`. O worker, porem, nasceu com rotas na raiz
 * (`/generate`, `/tts`). Em vez de duplicar o roteador, o prefixo `/api`
 * e retirado aqui para as rotas que o worker conhece na raiz. As rotas
 * que ja nascem com `/api/` (chat, ocr, redacao, turmas) passam diretas.
 */

import worker from './worker.js';

/** Rotas que o worker atende NA RAIZ (sem o prefixo `/api`). */
const ROTAS_RAIZ = new Set([
  '/health',
  '/generate',
  '/tts',
  '/pagamento',
  '/webhook/pagamento',
  '/notify/drain',
]);

/**
 * `/api/generate` -> `/generate`, mas `/api/ocr-process` fica como esta.
 * Funcao pura: e o unico ponto onde a diferenca entre os hosts aparece.
 */
export function normalizarRota(pathname) {
  if (!pathname.startsWith('/api')) return pathname;
  const semApi = pathname.slice(4) || '/';
  return ROTAS_RAIZ.has(semApi) ? semApi : pathname;
}

/**
 * Entrega a requisicao ao worker com a rota normalizada.
 *
 * O corpo NAO e lido aqui: `Request` e repassado por referencia sempre
 * que a URL nao muda, e reconstruido preservando o stream quando muda.
 * Isso mantem o upload multipart da redacao por foto intacto.
 */
export async function tratarRequisicao(request, env) {
  const url = new URL(request.url);
  const alvo = normalizarRota(url.pathname);

  let requisicao = request;
  if (alvo !== url.pathname) {
    url.pathname = alvo;
    // `duplex: 'half'` e exigido pelo Node/undici para repassar um corpo
    // em streaming; sem ele o clone de um POST estoura em tempo de
    // execucao. Navegadores ignoram a chave.
    requisicao = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      duplex: 'half',
    });
  }

  return worker.fetch(requisicao, env);
}
