/**
 * Como uma foto entra num FormData.
 *
 * No React Native o FormData aceita `{ uri, name, type }` e o próprio
 * fetch lê o arquivo do disco na hora do envio (sem passar os bytes pelo
 * JavaScript). No navegador isso não existe: o `.web.ts` monta um Blob.
 */
export async function arquivoParaFormData(uri: string, nome: string, tipo: string): Promise<Blob> {
  return { uri, name: nome, type: tipo } as unknown as Blob;
}
