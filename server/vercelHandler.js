/**
 * Handlers compartilhados pelas funcoes da Vercel em `api/`.
 *
 * ------------------------------------------------------------------
 * POR QUE UM ARQUIVO POR ROTA, E NAO UMA ROTA CORINGA
 * ------------------------------------------------------------------
 * A primeira versao usava um unico `api/[...rota].js`, apostando que a
 * convencao de colchetes capturaria qualquer caminho sob `/api/`. Em
 * producao ela capturou so UM segmento:
 *
 *   /api/health             (1 segmento)  -> funcionava
 *   /api/chat/completions   (2 segmentos) -> 404 da propria Vercel
 *
 * O efeito visivel foi o Mentor parar de responder, junto com a redacao
 * por foto e a importacao de turmas - as tres unicas rotas de dois
 * segmentos do app. As de um segmento funcionavam, o que fazia o
 * problema parecer intermitente.
 *
 * Agora cada rota tem seu proprio arquivo, no caminho real. E a convencao
 * mais antiga e mais previsivel da plataforma: `api/chat/completions.js`
 * e servido em `/api/chat/completions`, sem regra de reescrita e sem
 * interpretacao de nome no meio.
 *
 * O custo e ter que criar um arquivo ao adicionar rota no worker. O
 * beneficio e nao depender de um detalhe de plataforma que nao da para
 * verificar sem publicar - foi exatamente o que falhou aqui.
 *
 * Cada arquivo em `api/` so reexporta o que esta abaixo. A logica segue
 * inteira em `server/worker.js`, e `request.url` chega com o caminho
 * verdadeiro, entao `normalizarRota` continua valendo sem mudanca.
 */

import { tratarRequisicao } from './adapter.js';

/*
 * 30s casa com o DEEPSEEK_TIMEOUT_MS do front: o navegador desiste aos
 * 30s, entao orcamento maior no servidor so gastaria execucao por uma
 * resposta que ninguem mais espera.
 */
export const config = { maxDuration: 30 };

const responder = (request) => tratarRequisicao(request, process.env);

export const GET = responder;
export const POST = responder;
export const PUT = responder;
export const PATCH = responder;
export const DELETE = responder;
export const OPTIONS = responder;
export const HEAD = responder;
