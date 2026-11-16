/** No navegador o fetch nativo já entrega o corpo em pedaços. */
export const fetchComStream = (url: string, init: RequestInit): Promise<Response> => globalThis.fetch(url, init);
