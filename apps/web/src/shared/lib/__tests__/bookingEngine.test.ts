import { describe, expect, it } from 'vitest';
import {
  agruparPorDia,
  conflitaComAgenda,
  ehLinkDeSalaValido,
  formatarPreco,
  gerarSlots,
  nomeSalaJitsi,
  politicaCancelamento,
  salaEstaAberta,
  tempoAte,
} from '../bookingEngine';
import type { Agendamento, JanelaDisponibilidade } from '../../types';

// Terca-feira, 10h da manha.
const AGORA = new Date('2026-03-10T10:00:00');

const JANELAS: JanelaDisponibilidade[] = [
  { diaSemana: 2, horaInicio: '14:00', horaFim: '17:00' }, // terca
  { diaSemana: 3, horaInicio: '09:00', horaFim: '10:00' }, // quarta
];

function agendamento(parcial: Partial<Agendamento>): Agendamento {
  return {
    id: 'a1',
    alunoId: 'aluno',
    psicologoId: 'psi',
    inicio: '2026-03-10T14:00:00',
    fim: '2026-03-10T14:50:00',
    duracaoMinutos: 50,
    meetingProvider: 'jitsi',
    valorCentavos: 12000,
    statusPagamento: 'pago',
    status: 'confirmado',
    ...parcial,
  };
}

describe('gerarSlots', () => {
  it('divide a janela pela duracao da consulta', () => {
    const slots = gerarSlots(JANELAS, 60, [], AGORA, 1);
    // Terca 14h-17h com 60 min: 14h, 15h, 16h.
    expect(slots).toHaveLength(3);
    expect(new Date(slots[0].inicio).getHours()).toBe(14);
  });

  it('descarta o que nao cabe inteiro na janela', () => {
    const slots = gerarSlots([{ diaSemana: 2, horaInicio: '14:00', horaFim: '15:20' }], 50, [], AGORA, 1);
    expect(slots).toHaveLength(1);
  });

  it('respeita a antecedencia minima de 2 horas', () => {
    const slots = gerarSlots(
      [{ diaSemana: 2, horaInicio: '10:30', horaFim: '13:00' }],
      30,
      [],
      AGORA,
      1,
    );
    // 10:30 e 11:00 caem dentro das 2h e somem; sobram 12:00 e 12:30.
    expect(slots.every((s) => new Date(s.inicio).getTime() >= AGORA.getTime() + 2 * 3600_000)).toBe(true);
    expect(slots).toHaveLength(2);
  });

  it('remove horarios ja ocupados, inclusive sobreposicao parcial', () => {
    const ocupados = [{ inicio: '2026-03-10T14:30:00', fim: '2026-03-10T15:20:00' }];
    const slots = gerarSlots(JANELAS, 60, ocupados, AGORA, 1);
    const horas = slots.map((s) => new Date(s.inicio).getHours());
    expect(horas).toEqual([16]);
  });

  it('devolve vazio sem janelas ou com duracao invalida', () => {
    expect(gerarSlots([], 50, [], AGORA)).toEqual([]);
    expect(gerarSlots(JANELAS, 0, [], AGORA)).toEqual([]);
  });

  it('agrupa por dia com rotulo legivel', () => {
    const dias = agruparPorDia(gerarSlots(JANELAS, 60, [], AGORA, 3));
    expect(dias).toHaveLength(2);
    expect(dias[0].rotulo).toMatch(/^Ter, 10\/03$/);
  });
});

describe('conflito com a agenda do aluno', () => {
  it('detecta sobreposicao e ignora cancelados', () => {
    const slot = { inicio: '2026-03-10T14:30:00', fim: '2026-03-10T15:20:00' };
    expect(conflitaComAgenda(slot, [agendamento({})])).toBe(true);
    expect(conflitaComAgenda(slot, [agendamento({ status: 'cancelado' })])).toBe(false);
  });
});

describe('politica de cancelamento', () => {
  it('reembolsa integral com mais de 24h', () => {
    const p = politicaCancelamento('2026-03-12T14:00:00', AGORA);
    expect(p.podeCancelar).toBe(true);
    expect(p.reembolsoIntegral).toBe(true);
  });

  it('permite cancelar sem reembolso dentro de 24h', () => {
    const p = politicaCancelamento('2026-03-10T18:00:00', AGORA);
    expect(p.podeCancelar).toBe(true);
    expect(p.reembolsoIntegral).toBe(false);
  });

  it('nao cancela o que ja passou', () => {
    expect(politicaCancelamento('2026-03-09T18:00:00', AGORA).podeCancelar).toBe(false);
  });
});

describe('sala de video', () => {
  it('gera nome estavel e sem tracos a partir do id', () => {
    expect(nomeSalaJitsi('3f2b9c1a-1111-2222-3333-444455556666')).toBe('ampli-3f2b9c1a1111');
  });

  it('so aceita link https', () => {
    expect(ehLinkDeSalaValido('https://meet.jit.si/ampli-x')).toBe(true);
    expect(ehLinkDeSalaValido('http://meet.jit.si/ampli-x')).toBe(false);
    expect(ehLinkDeSalaValido(null)).toBe(false);
    expect(ehLinkDeSalaValido('sala-do-fulano')).toBe(false);
  });

  it('abre 10 min antes e fecha 30 min depois do fim', () => {
    const a = agendamento({});
    expect(salaEstaAberta(a, new Date('2026-03-10T13:45:00'))).toBe(false);
    expect(salaEstaAberta(a, new Date('2026-03-10T13:55:00'))).toBe(true);
    expect(salaEstaAberta(a, new Date('2026-03-10T15:15:00'))).toBe(true);
    expect(salaEstaAberta(a, new Date('2026-03-10T15:30:00'))).toBe(false);
  });
});

describe('formatacao', () => {
  it('mostra o preco em reais', () => {
    expect(formatarPreco(12000).replace(/ /g, ' ')).toBe('R$ 120,00');
  });

  it('descreve o tempo restante em linguagem curta', () => {
    expect(tempoAte('2026-03-10T10:30:00', AGORA)).toBe('em 30 min');
    expect(tempoAte('2026-03-10T14:00:00', AGORA)).toBe('em 4h');
    expect(tempoAte('2026-03-11T12:00:00', AGORA)).toBe('amanha');
    expect(tempoAte('2026-03-09T12:00:00', AGORA)).toBe('já passou');
  });
});
