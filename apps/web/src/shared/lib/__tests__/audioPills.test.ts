import { describe, expect, it } from 'vitest';
import {
  VELOCIDADE_PADRAO,
  VOZES,
  escolherVozNativa,
  montarPedidoTTS,
  roteiroLocalEmergencia,
} from '../audioPills';

describe('voz padrao das pilulas', () => {
  it('padrao e feminina (Ana) e rapida', () => {
    expect(VOZES[0].genero).toBe('feminina');
    expect(VOZES[0].id).toBe('pt-BR-Neural2-A');
    expect(VELOCIDADE_PADRAO).toBeGreaterThan(1);
    expect(montarPedidoTTS('oi')).toMatchObject({ voz: 'pt-BR-Neural2-A', velocidade: VELOCIDADE_PADRAO });
  });
});

describe('escolherVozNativa', () => {
  it('prefere pt-BR feminina conhecida', () => {
    const vozes = [
      { name: 'Microsoft Daniel - Portuguese (Brazil)', lang: 'pt-BR' },
      { name: 'Google português do Brasil', lang: 'pt-BR' },
      { name: 'Microsoft Maria - Portuguese (Brazil)', lang: 'pt-BR' },
      { name: 'Alex', lang: 'en-US' },
    ];
    expect(escolherVozNativa(vozes)).toBe(2);
  });

  it('nunca escolhe outro idioma quando ha pt', () => {
    const vozes = [
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Joana', lang: 'pt-PT' },
    ];
    expect(escolherVozNativa(vozes)).toBe(1);
  });

  it('lista vazia devolve -1 (chamador usa default do sistema)', () => {
    expect(escolherVozNativa([])).toBe(-1);
  });

  it('rejeita voz robotizada mesmo em pt-BR', () => {
    const vozes = [
      { name: 'eSpeak pt', lang: 'pt-BR' },
      { name: 'Luciana', lang: 'pt-BR' },
    ];
    expect(escolherVozNativa(vozes)).toBe(1);
  });
});

describe('roteiroLocalEmergencia', () => {
  it('cita materia e topico e nao inventa conteudo', () => {
    const r = roteiroLocalEmergencia('Biologia', 'Fotossíntese', 'Plantas convertem luz em energia.');
    expect(r).toContain('Fotossíntese');
    expect(r).toContain('Biologia');
    expect(r).toContain('Plantas convertem luz em energia.');
    expect(r).toContain('versão de bolso');
  });

  it('funciona sem resumo', () => {
    const r = roteiroLocalEmergencia('Matemática', 'Funções');
    expect(r.length).toBeGreaterThan(200);
    expect(r).toContain('Funções');
  });
});
