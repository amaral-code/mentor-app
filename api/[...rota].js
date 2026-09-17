/**
 * Back-end de IA na Vercel (rota coringa `/api/*`).
 *
 * Toda chamada de IA do app cai aqui: chat, quiz, redacao por foto, OCR,
 * TTS, pagamento e importacao de turmas. O roteamento continua sendo o do
 * `server/worker.js` - este arquivo so traduz o ambiente.
 *
 * ------------------------------------------------------------------
 * SEGREDOS: Environment Variables da Vercel, nunca `.env` no bundle
 * ------------------------------------------------------------------
 * `process.env` aqui e o painel da Vercel (Settings -> Environment
 * Variables). Como esta funcao roda NO SERVIDOR, as chaves usadas aqui
 * (DEEPSEEK_API_KEY, GEMINI_API_KEY, SUPABASE_SERVICE_KEY...) nunca sao
 * escritas no JavaScript entregue ao navegador - diferente de qualquer
 * variavel `VITE_*`, que por definicao vai para o bundle.
 *
 * Por isso NENHUMA destas variaveis leva o prefixo `VITE_`.
 *
 * ------------------------------------------------------------------
 * MESMA ORIGEM = SEM CORS E SEM CHAVE NO FRONT
 * ------------------------------------------------------------------
 * O navegador chama `/api/...` no proprio dominio do site. Some o
 * preflight de CORS, some o "Failed to fetch" por bloqueio de
 * third-party/adblock, e o `API_TOKEN` deixa de ser obrigatorio (ele
 * existia para impedir que um site aleatorio drenasse a cota do worker
 * publico; com mesma origem essa porta ja nasce fechada).
 */

import { tratarRequisicao } from '../server/adapter.js';

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
