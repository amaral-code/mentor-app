import { beforeEach, describe, expect, it } from 'vitest';
import { configurarPlataforma, criarArmazenamentoEmMemoria, _resetarPlataforma } from '../plataforma';
import { obterRoteiroDaPilula } from '../roteiroPilula';
import type { ModuloAudio } from '../types';

const modulo = (roteiro = ''): ModuloAudio => ({
  id: 'm1', materia: 'Física', topico: 'Óptica', titulo: 'Óptica em 3 min', resumo: 'Luz anda em linha reta.', roteiro, duracaoSegundos: 180, voz: 'v',
});

beforeEach(() => {
  _resetarPlataforma();
  const mem = criarArmazenamentoEmMemoria();
  configurarPlataforma({ armazenamento: () => mem });
});

describe('obterRoteiroDaPilula', () => {
  it('guardado no aparelho vence tudo', async () => {
    const texto = 'x'.repeat(500);
    configurarPlataforma({ armazenamento: () => criarArmazenamentoEmMemoria({ mm_roteiro_audio_m1: texto }) });
    expect(await obterRoteiroDaPilula(modulo('y'.repeat(600)), '')).toEqual({ texto, origem: 'aparelho' });
  });

  it('roteiro completo do banco, sem chamar a IA', async () => {
    const r = await obterRoteiroDaPilula(modulo('z'.repeat(600)), '');
    expect(r.origem).toBe('banco');
  });

  it('esboço do seed e sem IA: versão de bolso, sem inventar conteúdo', async () => {
    const r = await obterRoteiroDaPilula(modulo('Esboço [roteiro completo gerado pela IA]'), '');
    expect(r.origem).toBe('bolso');
    expect(r.texto).toContain('Luz anda em linha reta.');
  });
});
