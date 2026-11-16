/**
 * `/api/*` no `vite dev` — o MESMO back-end que roda na Vercel.
 *
 * ------------------------------------------------------------------
 * POR QUE
 * ------------------------------------------------------------------
 * Antes, dev e producao falavam com back-ends diferentes: em dev, o
 * proxy `/deepseek-api` do Vite (que so sabia repassar chat completions);
 * em producao, o worker completo. Toda rota que existia so no worker
 * (OCR, redacao por foto, TTS, pagamento, importacao de turmas) era
 * impossivel de testar localmente, e o primeiro teste real acontecia em
 * producao.
 *
 * Este middleware executa `server/worker.js` dentro do dev server. O que
 * voce testa em `localhost:5180/api/...` e byte a byte o que a Vercel
 * executa em `/api/...`.
 *
 * ------------------------------------------------------------------
 * PONTE NODE <-> WEB
 * ------------------------------------------------------------------
 * O Connect (dev server do Vite) fala `IncomingMessage`/`ServerResponse`
 * do Node; o worker fala `Request`/`Response` da web. A conversao e feita
 * por stream nos dois sentidos - nada de bufferizar o corpo inteiro na
 * memoria, o que importa para o upload multipart da redacao por foto.
 */

import { Readable } from 'node:stream';
import { tratarRequisicao } from './adapter.js';
import { GET as configGet } from '../api/config.js';

/** IncomingMessage -> Request (corpo em streaming). */
function paraRequestWeb(req) {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);

  const cabecalhos = new Headers();
  for (const [nome, valor] of Object.entries(req.headers)) {
    if (valor === undefined) continue;
    for (const v of Array.isArray(valor) ? valor : [valor]) cabecalhos.append(nome, v);
  }

  const temCorpo = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers: cabecalhos,
    body: temCorpo ? Readable.toWeb(req) : undefined,
    // Exigido pelo undici para enviar um corpo que ainda esta chegando.
    duplex: 'half',
  });
}

/** Response -> ServerResponse. */
async function escreverResposta(res, resposta) {
  res.statusCode = resposta.status;
  resposta.headers.forEach((valor, nome) => res.setHeader(nome, valor));
  if (!resposta.body) return res.end();
  for await (const pedaco of Readable.fromWeb(resposta.body)) res.write(pedaco);
  res.end();
}

/**
 * Plugin do Vite que serve `/api/*` em desenvolvimento.
 *
 * `env` e o resultado de `loadEnv(mode, cwd, '')`: inclui as variaveis
 * SEM prefixo VITE_ (as chaves de servidor). Elas ficam apenas neste
 * processo Node - o Vite so injeta `VITE_*` no bundle do navegador,
 * entao nenhuma chave usada aqui pode vazar para o front.
 */
export function apiDevPlugin(env) {
  return {
    name: 'midnight-mentor:api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const caminho = (req.url || '').split('?')[0];
        if (!caminho.startsWith('/api/') && caminho !== '/api') return next();

        try {
          const requisicao = paraRequestWeb(req);
          const resposta =
            caminho === '/api/config' ? await configGet(requisicao) : await tratarRequisicao(requisicao, env);
          await escreverResposta(res, resposta);
        } catch (erro) {
          /* Erro do back-end nunca derruba o dev server: vira 500 com a
             mensagem, do mesmo jeito que a Vercel reportaria. */
          console.error('[api-dev] falha em', caminho, erro);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'dev_api_falhou', message: String(erro?.message || erro) }));
        }
      });
    },
  };
}
