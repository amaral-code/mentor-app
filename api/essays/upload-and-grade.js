/**
 * `/api/essays/upload-and-grade` -> `server/worker.js`.
 *
 * Arquivo no caminho REAL da rota, de proposito: a versao anterior usava
 * uma rota coringa `api/[...rota].js` que, em producao, capturava apenas
 * um segmento do caminho - e as rotas de dois segmentos caiam no 404 da
 * Vercel. Ver o comentario em `server/vercelHandler.js`.
 *
 * Toda a logica vive no worker; aqui so se reexporta o handler.
 */

import { GET as g, POST as p, PUT as pu, PATCH as pa, DELETE as d, OPTIONS as o, HEAD as h } from '../../server/vercelHandler.js';

/*
 * 60s, e nao os 30s das outras rotas: aqui o servidor cria contas e
 * envia convites (importacao) ou sobe a foto e espera a leitura da folha
 * inteira (redacao). Com 30s uma turma de tamanho real estourava no
 * meio, com metade das contas criadas.
 */
export const config = { maxDuration: 60 };
export const GET = g;
export const POST = p;
export const PUT = pu;
export const PATCH = pa;
export const DELETE = d;
export const OPTIONS = o;
export const HEAD = h;
