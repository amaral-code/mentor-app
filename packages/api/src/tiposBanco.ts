/**
 * Atalhos sobre os tipos GERADOS das migrations (database.types.ts).
 *
 * O cliente Supabase ainda não é tipado (`createClient<Database>`): ligar
 * isso de uma vez mexeria em todos os repositórios. Enquanto isso, cada
 * repositório tipa a linha crua com estes atalhos no lugar de `any`. Se
 * uma migration renomear ou remover uma coluna, o `tsc` aponta o
 * repositório que ficou para trás, em vez de a tela mostrar `undefined`.
 */
import type { Database, Rpc } from './database.types';

type Funcoes = Database['public']['Functions'];

/** Uma linha do retorno de uma função (RPC). Para `setof`, o item da lista. */
export type LinhaRpc<T extends keyof Funcoes> = Rpc<T>['Returns'] extends (infer L)[] ? L : Rpc<T>['Returns'];

export type { Database, Enums, Json, Rpc, Tables, TablesInsert, TablesUpdate } from './database.types';
