import { describe, expect, it } from 'vitest';
import { base64DoDataUrl, deveSalvarProgresso, nomeArquivoPilula, proximaVelocidade } from '../audio';

describe('player de pílulas', () => {
  it('nome de arquivo sem barra nem ponto vindo do banco', () => {
    expect(nomeArquivoPilula('../mat/funcoes', 'pt-BR-Neural2-A')).toBe('___mat_funcoes__pt_BR_Neural2_A.mp3');
  });
  it('base64 sem o cabeçalho do data URL', () => {
    expect(base64DoDataUrl('data:audio/mpeg;base64,QUJD')).toBe('QUJD');
    expect(base64DoDataUrl('QUJD')).toBe('QUJD');
  });
  it('progresso a cada 15 segundos', () => {
    expect(deveSalvarProgresso(0, 14_999)).toBe(false);
    expect(deveSalvarProgresso(0, 15_000)).toBe(true);
  });
  it('velocidade gira 1, 1,25, 1,5', () => {
    expect(proximaVelocidade(1)).toBe(1.25);
    expect(proximaVelocidade(1.5)).toBe(1);
    expect(proximaVelocidade(3)).toBe(1);
  });
});
