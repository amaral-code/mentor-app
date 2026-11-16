import { fetch as fetchExpo } from 'expo/fetch';

/**
 * `fetch` que entrega o corpo em pedaços.
 *
 * O `fetch` global do React Native só devolve o corpo inteiro no fim, e
 * o streaming do Mentor viraria "espera tudo e mostra de uma vez". O do
 * Expo (`expo/fetch`) implementa `response.body.getReader()` de verdade.
 * O web tem o arquivo `.web.ts`, com o fetch do navegador.
 */
export const fetchComStream = fetchExpo as unknown as (url: string, init: RequestInit) => Promise<Response>;
