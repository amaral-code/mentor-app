/**
 * `/api/conta/excluir` -> `server/worker.js` (LGPD, issue #70).
 * Arquivo no caminho real da rota: ver o comentário em `api/turmas/import.js`.
 */

import { GET as g, POST as p, PUT as pu, PATCH as pa, DELETE as d, OPTIONS as o, HEAD as h } from '../../server/vercelHandler.js';

export const GET = g;
export const POST = p;
export const PUT = pu;
export const PATCH = pa;
export const DELETE = d;
export const OPTIONS = o;
export const HEAD = h;
