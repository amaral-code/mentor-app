import { describe, expect, it } from 'vitest';
import { estaAtrasada, lembretesDeRevisao, revisoesDoDia, semanasDoMes } from '../calendarioRevisoes';
import type { RevisaoEspacada } from '../types';

const rev = (topicoNome: string, proximaRevisao: string, materia = 'Física'): RevisaoEspacada => ({
  topicoId: topicoNome.toLowerCase(),
  topicoNome,
  materia,
  nivelMemoria: 1,
  intervaloDias: 3,
  facilidade: 2.5,
  revisoesFeitas: 1,
  proximaRevisao,
});

const HOJE = new Date(2026, 10, 16, 22, 30); // 16/11, 22h30 (já é 17 em UTC)

describe('estaAtrasada', () => {
  it('compara no fuso do aparelho, não em UTC', () => {
    expect(estaAtrasada(rev('a', '2026-11-16'), HOJE)).toBe(false);
    expect(estaAtrasada(rev('a', '2026-11-15'), HOJE)).toBe(true);
  });
});

describe('semanasDoMes', () => {
  it('novembro de 2026: começa no domingo dia 1 e as vencidas contam hoje', () => {
    const semanas = semanasDoMes(2026, 10, [rev('a', '2026-11-10'), rev('b', '2026-11-16'), rev('c', '2026-11-20')], HOJE);
    expect(semanas[0][0]).toMatchObject({ data: '2026-11-01', doMes: true });
    const dias = semanas.flat();
    expect(dias.find((d) => d.data === '2026-11-16')).toMatchObject({ hoje: true, quantidade: 2 });
    expect(dias.find((d) => d.data === '2026-11-10')?.quantidade).toBe(0);
    expect(dias.find((d) => d.data === '2026-11-20')?.quantidade).toBe(1);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas.at(-1)!.some((d) => d.data === '2026-11-30')).toBe(true);
  });
});

describe('revisoesDoDia', () => {
  it('hoje inclui as vencidas; outro dia, só as dele', () => {
    const lista = [rev('Óptica', '2026-11-10'), rev('Ondas', '2026-11-16'), rev('Calor', '2026-11-20')];
    expect(revisoesDoDia(lista, '2026-11-16', HOJE).map((r) => r.topicoNome)).toEqual(['Óptica', 'Ondas']);
    expect(revisoesDoDia(lista, '2026-11-20', HOJE).map((r) => r.topicoNome)).toEqual(['Calor']);
  });
});

describe('lembretesDeRevisao', () => {
  it('um por dia, sem o nome do tópico na notificação', () => {
    const l = lembretesDeRevisao([rev('Reprodução humana', '2026-11-14', 'Biologia'), rev('Óptica', '2026-11-16'), rev('Longe', '2026-12-30')], 7, HOJE);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ data: '2026-11-16', quantidade: 2, titulo: '2 revisões para hoje' });
    expect(l[0].corpo).toContain('Biologia');
    expect(l[0].corpo).not.toContain('Reprodução');
  });
});
