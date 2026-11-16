import { Directory, File, Paths } from 'expo-file-system';
import { base64DoDataUrl, nomeArquivoPilula } from '../../lib/audio';

/**
 * Onde o MP3 das pílulas mora no celular.
 *
 * O web guarda o áudio só na memória (um data URL de 3 minutos tem ~1,5 MB
 * e estoura o localStorage). No celular há disco de verdade:
 *
 * - `cache/`: o que acabou de ser sintetizado, para tocar. O sistema pode
 *   apagar quando faltar espaço, e tudo bem: sintetiza de novo.
 * - `document/pilulas/`: o que o aluno BAIXOU para ouvir sem internet. O
 *   sistema não apaga; só o aluno.
 *
 * O player nativo não toca `data:` de forma confiável no iOS (AVPlayer),
 * então o áudio sempre vira arquivo antes de tocar. O web tem o arquivo
 * `.web.ts`, que devolve o próprio data URL.
 */
const pasta = () => new Directory(Paths.document, 'pilulas');

function arquivoBaixado(moduloId: string, voz: string): File {
  return new File(pasta(), nomeArquivoPilula(moduloId, voz));
}

export const podeBaixar = true;

/** URI local do áudio baixado, ou null. */
export function audioBaixado(moduloId: string, voz: string): string | null {
  const f = arquivoBaixado(moduloId, voz);
  return f.exists ? f.uri : null;
}

/** Grava o áudio sintetizado num arquivo temporário e devolve a URI para tocar. */
export async function paraTocar(moduloId: string, voz: string, dataUrl: string): Promise<string> {
  const f = new File(Paths.cache, nomeArquivoPilula(moduloId, voz));
  if (f.exists) f.delete();
  f.create();
  await f.write(base64DoDataUrl(dataUrl), { encoding: 'base64' });
  return f.uri;
}

/** Guarda para ouvir offline. */
export async function baixar(moduloId: string, voz: string, dataUrl: string): Promise<string> {
  const p = pasta();
  if (!p.exists) p.create({ intermediates: true });
  const f = arquivoBaixado(moduloId, voz);
  if (f.exists) f.delete();
  f.create();
  await f.write(base64DoDataUrl(dataUrl), { encoding: 'base64' });
  return f.uri;
}

export function apagarBaixado(moduloId: string, voz: string): void {
  const f = arquivoBaixado(moduloId, voz);
  if (f.exists) f.delete();
}
