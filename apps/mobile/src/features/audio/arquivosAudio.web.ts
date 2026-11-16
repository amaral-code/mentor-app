/**
 * Web: sem disco para guardar MP3 (o localStorage não comporta). O áudio
 * toca direto do data URL e o botão "baixar" não aparece.
 */
export const podeBaixar = false;

export function audioBaixado(_moduloId: string, _voz: string): string | null {
  return null;
}

export async function paraTocar(_moduloId: string, _voz: string, dataUrl: string): Promise<string> {
  return dataUrl;
}

export async function baixar(_moduloId: string, _voz: string, dataUrl: string): Promise<string> {
  return dataUrl;
}

export function apagarBaixado(_moduloId: string, _voz: string): void {}
