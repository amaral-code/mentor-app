import { describe, expect, it } from 'vitest';
import {
  CONFIG_PADRAO,
  avaliarOciosidade,
  estadoInicial,
  sugestaoLocal,
  type EstadoOciosidade,
} from '../idleTracker';

const AGORA = 1_700_000_000_000;

function estado(parcial: Partial<EstadoOciosidade>): EstadoOciosidade {
  return {
    ...estadoInicial(AGORA - CONFIG_PADRAO.limiarMs - 1000),
    ultimaInteracao: AGORA - 2000,
    eventosNavegacao: 20,
    ...parcial,
  };
}

describe('avaliarOciosidade', () => {
  it('intervem quando rola por 2 min sem clicar em nada', () => {
    const r = avaliarOciosidade(estado({}), AGORA);
    expect(r.deveIntervir).toBe(true);
    expect(r.motivo).toBe('doomscroll');
    expect(r.segundosVagando).toBeGreaterThanOrEqual(120);
  });

  it('nao intervem se houve acao de compromisso', () => {
    const r = avaliarOciosidade(estado({ acoesDecisivas: 1 }), AGORA);
    expect(r.deveIntervir).toBe(false);
    expect(r.motivo).toBe('ativo');
  });

  it('nao intervem se a pessoa largou o aparelho', () => {
    const r = avaliarOciosidade(estado({ ultimaInteracao: AGORA - 120_000 }), AGORA);
    expect(r.motivo).toBe('ausente');
  });

  it('nao intervem antes do limiar de tempo', () => {
    const r = avaliarOciosidade(estado({ inicioJanela: AGORA - 30_000 }), AGORA);
    expect(r.motivo).toBe('cedo');
  });

  it('nao intervem com pouca rolagem (leitura atenta)', () => {
    const r = avaliarOciosidade(estado({ eventosNavegacao: 2 }), AGORA);
    expect(r.motivo).toBe('cedo');
  });

  it('respeita o cooldown de 15 minutos', () => {
    const r = avaliarOciosidade(estado({ ultimaIntervencao: AGORA - 60_000 }), AGORA);
    expect(r.deveIntervir).toBe(false);
    expect(r.motivo).toBe('cooldown');
  });

  it('volta a intervir depois do cooldown', () => {
    const r = avaliarOciosidade(
      estado({ ultimaIntervencao: AGORA - CONFIG_PADRAO.cooldownMs - 1000 }),
      AGORA,
    );
    expect(r.deveIntervir).toBe(true);
  });
});

describe('sugestaoLocal', () => {
  it('propoe uma unica tarefa curta na materia informada', () => {
    const s = sugestaoLocal('Historia');
    expect(s.convite).toContain('Historia');
    expect(s.convite).toContain('3 questoes');
    expect(s.acao.split(' ').length).toBeLessThanOrEqual(5);
  });

  it('tem materia padrao quando nao ha historico', () => {
    expect(sugestaoLocal(null).convite).toContain('Biologia');
  });
});
