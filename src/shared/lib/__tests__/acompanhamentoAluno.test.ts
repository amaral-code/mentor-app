import { describe, expect, it } from 'vitest';
import {
  dadosSuficientes,
  faltaParaTendencia,
  horasPorSemana,
  paraMesCurto,
  paraRegistrosMensais,
  rotuloMes,
  rotuloSemana,
  semAtividade,
  totaisDoPeriodo,
} from '../acompanhamentoAluno';
import type { ResumoMensal } from '../../storage/AcompanhamentoRepository';
import { calculateDropoutRisk } from '../dropoutRisk';

const mes = (iso: string, questoes: number, acertos: number, minutos = 60, dias = 5): ResumoMensal => ({
  mes: iso,
  minutos,
  questoes,
  acertos,
  taxaAcerto: questoes > 0 ? Math.round((acertos * 100) / questoes) : 0,
  diasAtivos: dias,
});

describe('rotuloMes', () => {
  it('traduz o mes', () => {
    expect(rotuloMes('2026-09-01')).toBe('Set');
    expect(rotuloMes('2026-01-01')).toBe('Jan');
  });

  /* `new Date('2026-09-01')` e meia-noite UTC: num fuso a oeste o dia 1
     volta para agosto e o grafico inteiro fica um mes atrasado. */
  it('nao desloca o mes por fuso horario', () => {
    expect(rotuloMes('2026-03-01')).toBe('Mar');
    expect(rotuloMes('2026-12-01')).toBe('Dez');
  });

  it('devolve a entrada quando nao reconhece', () => {
    expect(rotuloMes('abacaxi')).toBe('abacaxi');
  });
});

describe('rotuloSemana', () => {
  it('vira dia/mes', () => {
    expect(rotuloSemana('2026-09-15')).toBe('15/09');
  });
});

describe('paraRegistrosMensais', () => {
  it('leva a taxa de acerto como desempenho e converte minutos em horas', () => {
    const r = paraRegistrosMensais([mes('2026-09-01', 10, 8, 90)]);
    expect(r).toEqual([{ month: '2026-09', notaMedia: 80, tempoUso: 1.5 }]);
  });

  /* O caso real que o painel dos pais errou: tres meses vazios antes de
     o aluno comecar, e depois 70%, 60%, 49%. Com os vazios como 0% a
     reta subia, e a tela dizia "tendencia de alta confirmada". */
  it('meses antes da primeira atividade nao entram na tendencia', () => {
    const resumo = [
      mes('2026-04-01', 0, 0, 0, 0),
      mes('2026-05-01', 0, 0, 0, 0),
      mes('2026-06-01', 0, 0, 0, 0),
      mes('2026-07-01', 100, 70),
      mes('2026-08-01', 100, 60),
      mes('2026-09-01', 100, 49),
    ];
    const r = paraRegistrosMensais(resumo);
    expect(r.map((x) => x.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(calculateDropoutRisk(r).trend).toBe('falling');
  });

  /* Parar de estudar E sinal. Mes vazio depois do inicio fica. */
  it('mes vazio depois do inicio continua na serie', () => {
    const r = paraRegistrosMensais([mes('2026-07-01', 50, 40), mes('2026-08-01', 0, 0, 0, 0), mes('2026-09-01', 30, 20)]);
    expect(r).toHaveLength(3);
  });

  it('sem atividade nenhuma, nao ha serie', () => {
    expect(paraRegistrosMensais([mes('2026-08-01', 0, 0, 0, 0)])).toEqual([]);
  });

  it('paraMesCurto corta o dia', () => {
    expect(paraMesCurto('2026-09-01')).toBe('2026-09');
  });
});

describe('totaisDoPeriodo', () => {
  /* Media das taxas mensais faria um mes de 2 questoes pesar igual a um
     mes de 200. A conta e sobre o total. */
  it('calcula a taxa sobre o total, nao como media das medias', () => {
    const t = totaisDoPeriodo([mes('2026-08-01', 2, 2), mes('2026-09-01', 98, 49)]);
    expect(t.questoes).toBe(100);
    expect(t.acertos).toBe(51);
    expect(t.taxaAcerto).toBe(51); // a media das medias daria 75
  });

  it('conta so os meses com atividade', () => {
    const t = totaisDoPeriodo([mes('2026-07-01', 0, 0, 0, 0), mes('2026-08-01', 30, 20)]);
    expect(t.mesesComAtividade).toBe(1);
  });

  it('periodo vazio nao divide por zero', () => {
    expect(totaisDoPeriodo([]).taxaAcerto).toBe(0);
    expect(totaisDoPeriodo([mes('2026-08-01', 0, 0, 0, 0)]).taxaAcerto).toBe(0);
  });
});

describe('dadosSuficientes', () => {
  /* O caso que o mock escondia: quem acabou de entrar. Regressao sobre
     tres pontos quase vazios devolve "Alto risco" com cara de
     conclusao. */
  it('recusa quem tem volume, mas so um mes de uso', () => {
    expect(dadosSuficientes([mes('2026-09-01', 200, 150)])).toBe(false);
  });

  it('recusa quem tem meses, mas quase nenhuma questao', () => {
    expect(
      dadosSuficientes([mes('2026-07-01', 2, 1), mes('2026-08-01', 2, 1), mes('2026-09-01', 2, 2)]),
    ).toBe(false);
  });

  it('aceita quando os dois criterios batem', () => {
    expect(
      dadosSuficientes([mes('2026-07-01', 10, 7), mes('2026-08-01', 10, 6), mes('2026-09-01', 10, 8)]),
    ).toBe(true);
  });

  it('diz quanto falta, para a tela explicar em vez de so esconder', () => {
    const falta = faltaParaTendencia([mes('2026-09-01', 6, 4)]);
    expect(falta.meses).toBe(2);
    expect(falta.questoes).toBe(14);
  });
});

describe('semAtividade', () => {
  it('reconhece quem nunca estudou pelo app', () => {
    expect(semAtividade([mes('2026-08-01', 0, 0, 0, 0), mes('2026-09-01', 0, 0, 0, 0)])).toBe(true);
  });

  it('uma questao ja e atividade', () => {
    expect(semAtividade([mes('2026-09-01', 1, 0)])).toBe(false);
  });
});

describe('horasPorSemana', () => {
  it('converte e arredonda a uma casa', () => {
    expect(horasPorSemana([{ semana: '2026-09-14', minutos: 95, questoes: 12 }])).toEqual([
      { rotulo: '14/09', horas: 1.6 },
    ]);
  });
});
