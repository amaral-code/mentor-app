/**
 * `/api/chat/completions` -> `server/worker.js`.
 *
 * Arquivo no caminho REAL da rota, de proposito: a versao anterior usava
 * uma rota coringa `api/[...rota].js` que, em producao, capturava apenas
 * um segmento do caminho - e as rotas de dois segmentos caiam no 404 da
 * Vercel. Ver o comentario em `server/vercelHandler.js`.
 *
 * Toda a logica vive no worker; aqui so se reexporta o handler.
 */

import { config as cfg, GET as g, POST as p, PUT as pu, PATCH as pa, DELETE as d, OPTIONS as o, HEAD as h } from '../../server/vercelHandler.js';

export const config = cfg;
export const GET = g;
export const POST = p;
export const PUT = pu;
export const PATCH = pa;
export const DELETE = d;
export const OPTIONS = o;
export const HEAD = h;
