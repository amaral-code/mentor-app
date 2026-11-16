/** Navegador: a foto vira Blob (o `uri` é blob: ou data:). */
export async function arquivoParaFormData(uri: string, _nome: string, tipo: string): Promise<Blob> {
  const blob = await (await fetch(uri)).blob();
  return blob.type ? blob : new Blob([blob], { type: tipo });
}
