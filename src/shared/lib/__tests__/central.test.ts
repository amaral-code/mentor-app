import { describe, expect, it } from 'vitest';
import { atividadeDaSemana, faixaSobrecarga, plural, saudacao } from '../central';

describe('saudacao', () => {
  it('segue a hora local', () => {
    expect(saudacao(6)).toBe('Bom dia');
    expect(saudacao(13)).toBe('Boa tarde');
    expect(saudacao(23)).toBe('Boa noite');
    // Madrugada também é noite: é justamente quem o app atende.
    expect(saudacao(2)).toBe('Boa noite');
  });
});

describe('atividadeDaSemana', () => {
  const agora = new Date(2026, 9, 15, 21, 0); // quinta, 15/10/2026, 21h
  const em = (diasAtras: number, hora = 20) =>
    ({ timestamp: new Date(2026, 9, 15 - diasAtras, hora).getTime() });

  it('devolve 7 dias terminando hoje', () => {
    const { dias } = atividadeDaSemana([], agora);
    expect(dias).toHaveLength(7);
    expect(dias[6].hoje).toBe(true);
    expect(dias.filter((d) => d.hoje)).toHaveLength(1);
  });

  it('o total da semana NAO conta o que é mais antigo que 7 dias', () => {
    // O bug: "Total 7 dias" usava logs.length, que somava estes dois
    // registros de um mês atrás.
    const logs = [em(0), em(0), em(3), em(30), em(31)];
    const r = atividadeDaSemana(logs, agora);
    expect(r.totalSemana).toBe(3);
    expect(r.totalHoje).toBe(2);
    expect(r.dias[3].total).toBe(1);
  });

  it('conta o dia pela meia-noite local, não por 24h corridas', () => {
    const ontemTarde = em(1, 23);
    const hojeCedo = em(0, 0);
    const r = atividadeDaSemana([ontemTarde, hojeCedo], agora);
    expect(r.dias[5].total).toBe(1);
    expect(r.dias[6].total).toBe(1);
  });
});

describe('faixaSobrecarga', () => {
  it('número alto é sobrecarga alta (e não "prontidão" alta)', () => {
    expect(faixaSobrecarga(10).tom).toBe('ok');
    expect(faixaSobrecarga(55).tom).toBe('atencao');
    expect(faixaSobrecarga(85)).toEqual({ rotulo: 'alta', tom: 'risco' });
  });
});

describe('plural', () => {
  it('concorda com o número', () => {
    expect(plural(1, 'atividade')).toBe('1 atividade');
    expect(plural(0, 'atividade')).toBe('0 atividades');
    expect(plural(2, 'dia seguido', 'dias seguidos')).toBe('2 dias seguidos');
  });
});
