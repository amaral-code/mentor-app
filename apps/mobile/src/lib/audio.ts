/**
 * Regras do player de pílulas, sem tela (testáveis no Node).
 */

/** Nome de arquivo seguro para a pílula baixada (id e voz vêm do banco). */
export function nomeArquivoPilula(moduloId: string, voz: string): string {
  const limpar = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 60);
  return `${limpar(moduloId)}__${limpar(voz)}.mp3`;
}

/** Tira o cabeçalho `data:audio/mpeg;base64,` e devolve só o base64. */
export function base64DoDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf('base64,');
  return i >= 0 ? dataUrl.slice(i + 'base64,'.length) : dataUrl;
}

/**
 * Salvar progresso a cada segundo seria uma escrita no banco por segundo
 * de áudio. A cada 15 s (e na pausa e no fim) basta: perder 15 s de
 * posição ao fechar o app é aceitável.
 */
export const INTERVALO_SALVAR_MS = 15_000;

export function deveSalvarProgresso(ultimoSalvoMs: number, agoraMs: number): boolean {
  return agoraMs - ultimoSalvoMs >= INTERVALO_SALVAR_MS;
}

export const VELOCIDADES = [1, 1.25, 1.5] as const;

export function proximaVelocidade(atual: number): number {
  const i = VELOCIDADES.findIndex((v) => Math.abs(v - atual) < 0.01);
  return VELOCIDADES[(i + 1) % VELOCIDADES.length];
}
