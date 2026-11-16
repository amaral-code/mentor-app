import { describe, expect, it } from 'vitest';
import {
  SYSTEM_PROMPT_DESCOMPRESSAO,
  calcularMetricas,
  destaquesDaSemana,
  deveGerarRelatorio,
  inicioDaSemana,
  promptDescompressao,
  textoLocalDescompressao,
} from '../decompressionReport';
import type { LogEntry, QuizResult, SessaoOffline } from '../../types';

const DIA = 86_400_000;
const SEXTA = new Date('2026-03-13T18:00:00'); // sexta-feira

function log(parcial: Partial<LogEntry>): LogEntry {
  return { timestamp: Date.now(), type: 'quiz', description: 'x', xp: 10, ...parcial };
}

describe('inicioDaSemana', () => {
  it('devolve sempre a segunda-feira', () => {
    expect(inicioDaSemana(new Date('2026-03-13T18:00:00'))).toBe('2026-03-09'); // sexta
    expect(inicioDaSemana(new Date('2026-03-09T01:00:00'))).toBe('2026-03-09'); // a propria segunda
    expect(inicioDaSemana(new Date('2026-03-15T23:00:00'))).toBe('2026-03-09'); // domingo
  });
});

describe('deveGerarRelatorio', () => {
  it('gera na sexta quando ainda nao houve relatorio da semana', () => {
    expect(deveGerarRelatorio(null, SEXTA)).toBe(true);
    expect(deveGerarRelatorio('2026-03-02', SEXTA)).toBe(true);
  });

  it('nao repete se a semana ja tem relatorio', () => {
    expect(deveGerarRelatorio('2026-03-09', SEXTA)).toBe(false);
  });

  it('nao gera no meio da semana', () => {
    expect(deveGerarRelatorio(null, new Date('2026-03-11T18:00:00'))).toBe(false);
  });

  it('ainda gera no sabado e no domingo para quem nao abriu na sexta', () => {
    expect(deveGerarRelatorio(null, new Date('2026-03-14T10:00:00'))).toBe(true);
    expect(deveGerarRelatorio(null, new Date('2026-03-15T10:00:00'))).toBe(true);
  });
});

describe('calcularMetricas', () => {
  const agora = new Date('2026-03-13T18:00:00');
  /** Instante a N dias de 13/03/2026, na hora indicada. */
  const t = (dias: number, hora = 20) => {
    const d = new Date('2026-03-13T00:00:00');
    d.setDate(d.getDate() - dias);
    d.setHours(hora, 0, 0, 0);
    return d.getTime();
  };

  const entrada = {
    logs: [log({ timestamp: t(0) }), log({ timestamp: t(1) }), log({ timestamp: t(2, 2) })],
    sessoesOffline: [
      { inicio: new Date(t(1)).toISOString(), fim: new Date(t(1)).toISOString(), minutosOffline: 50, interrupcoes: 0, modo: 'enem', moedasCreditadas: 75 } as SessaoOffline,
      { inicio: new Date(t(30)).toISOString(), fim: new Date(t(30)).toISOString(), minutosOffline: 999, interrupcoes: 0, modo: 'enem', moedasCreditadas: 0 } as SessaoOffline,
    ],
    sessoesFoco: [
      { tipo: 'foco', minutos: 25, data: new Date(t(1)).toISOString() },
      { tipo: 'pausa', minutos: 5, data: new Date(t(1)).toISOString() },
    ],
    quizzes: [{ materia: 'Biologia', acertos: 7, total: 10, xpGanho: 210, timestamp: t(1) } as QuizResult],
    registrosSono: [7, 8, 6],
    streak: 4,
    revisoesEmDia: 3,
  };

  it('conta apenas os ultimos 7 dias', () => {
    const m = calcularMetricas(entrada, agora);
    expect(m.minutosOffline).toBe(50);
    expect(m.diasAtivos).toBe(3);
  });

  it('agrega foco, quiz e sono', () => {
    const m = calcularMetricas(entrada, agora);
    expect(m.minutosFoco).toBe(25);
    expect(m.questoesRespondidas).toBe(10);
    expect(m.taxaAcerto).toBe(70);
    expect(m.horasSonoMedia).toBe(7);
  });

  it('conta noites de madrugada por dia distinto', () => {
    expect(calcularMetricas(entrada, agora).sessoesMadrugada).toBe(1);
  });

  it('nao divide por zero sem quiz', () => {
    const m = calcularMetricas({ ...entrada, quizzes: [], registrosSono: [] }, agora);
    expect(m.taxaAcerto).toBe(0);
    expect(m.horasSonoMedia).toBe(0);
  });
});

describe('texto local', () => {
  const base = {
    diasAtivos: 4,
    minutosOffline: 120,
    minutosFoco: 75,
    horasSonoMedia: 7.5,
    questoesRespondidas: 40,
    taxaAcerto: 65,
    streak: 4,
    sessoesMadrugada: 0,
    revisoesEmDia: 3,
  };

  it('cita numeros concretos e usa o primeiro nome', () => {
    const texto = textoLocalDescompressao(base, 'Ana');
    expect(texto).toContain('Ana');
    expect(texto).toContain('4');
    expect(texto).toContain('120');
  });

  it('valida sem cobrar quando a semana foi vazia', () => {
    const texto = textoLocalDescompressao({ ...base, diasAtivos: 0, minutosOffline: 0, minutosFoco: 0 });
    expect(texto.toLowerCase()).not.toContain('deveria');
    expect(texto.toLowerCase()).not.toContain('precisa');
    expect(texto.length).toBeGreaterThan(40);
  });

  it('nao passa de quatro frases', () => {
    const frases = textoLocalDescompressao(base, 'Ana').split(/(?<=\.)\s/);
    expect(frases.length).toBeLessThanOrEqual(4);
  });

  it('monta quatro destaques com rotulo e valor', () => {
    const d = destaquesDaSemana(base);
    expect(d).toHaveLength(4);
    expect(d[0].valor).toBe('4/7');
    expect(d[1].valor).toBe('2h00');
  });
});

describe('prompts', () => {
  it('o system prompt proibe cobranca e coach', () => {
    expect(SYSTEM_PROMPT_DESCOMPRESSAO).toContain('Nunca');
    expect(SYSTEM_PROMPT_DESCOMPRESSAO).toContain('coach');
    expect(SYSTEM_PROMPT_DESCOMPRESSAO).toContain('4 frases');
  });

  it('o prompt de usuario leva todas as metricas', () => {
    const p = promptDescompressao(
      {
        diasAtivos: 3,
        minutosOffline: 90,
        minutosFoco: 50,
        horasSonoMedia: 6.5,
        questoesRespondidas: 20,
        taxaAcerto: 55,
        streak: 3,
        sessoesMadrugada: 2,
        revisoesEmDia: 1,
      },
      'Joao',
    );
    expect(p).toContain('Joao');
    expect(p).toContain('90 minutos');
    expect(p).toContain('6.5 horas');
    expect(p).toContain('0h e 5h');
  });
});
