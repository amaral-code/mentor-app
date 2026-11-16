import { describe, expect, it } from 'vitest';
import { ANIMACAO_DA_POSE, MOVIMENTOS, SUBIDA_POR_CICLO, movimentoDaPose, quadroNoTempo, type Animacao } from '../animacaoSagui';

describe('animações do sagui', () => {
  it('todas as 26 poses têm animação', () => {
    const poses = Object.keys(ANIMACAO_DA_POSE);
    expect(poses).toHaveLength(26);
    for (let i = 1; i <= 20; i++) expect(poses).toContain(`pose_${String(i).padStart(2, '0')}`);
  });

  it('todo ciclo começa e termina no mesmo lugar (sem tranco no laço), menos a escalada', () => {
    for (const [nome, m] of Object.entries(MOVIMENTOS) as [Animacao, (typeof MOVIMENTOS)[Animacao]][]) {
      const ini = m.quadros[0];
      const fim = m.quadros[m.quadros.length - 1];
      expect(ini.t).toBe(0);
      expect(fim.t).toBe(1);
      if (nome === 'escalar') continue;
      expect([fim.y, fim.escalaX, fim.escalaY, fim.giro]).toEqual([ini.y, ini.escalaX, ini.escalaY, ini.giro]);
    }
  });

  it('quadros em ordem de tempo', () => {
    for (const m of Object.values(MOVIMENTOS)) {
      for (let i = 1; i < m.quadros.length; i++) expect(m.quadros[i].t).toBeGreaterThanOrEqual(m.quadros[i - 1].t);
    }
  });

  it('nenhum movimento deforma a arte além de 10%', () => {
    for (const m of Object.values(MOVIMENTOS)) {
      for (const qd of m.quadros) {
        expect(Math.abs(qd.escalaX - 1)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(qd.escalaY - 1)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it('a escalada alterna os braços e sobe a cada puxada', () => {
    const m = MOVIMENTOS.escalar;
    const espelhos = [0.1, 0.35, 0.6, 0.85].map((t) => quadroNoTempo(m, t).espelhar);
    expect(espelhos).toEqual([false, true, false, true]);
    const alturas = [0, 0.25, 0.5, 0.75, 0.999].map((t) => quadroNoTempo(m, t).y);
    for (let i = 1; i < alturas.length; i++) expect(alturas[i]).toBeLessThan(alturas[i - 1]);
    expect(quadroNoTempo(m, 0.999).y).toBeCloseTo(-SUBIDA_POR_CICLO, 1);
  });

  it('interpola entre quadros e volta ao início depois de 1', () => {
    const m = MOVIMENTOS.flutuar;
    expect(quadroNoTempo(m, 0.25).y).toBeCloseTo(-0.025);
    expect(quadroNoTempo(m, 1.25).y).toBeCloseTo(quadroNoTempo(m, 0.25).y);
  });

  it('o arquivo "acenando" (sagui meditando) flutua, não acena', () => {
    expect(movimentoDaPose('acenando').animacao).toBe('flutuar');
    expect(movimentoDaPose('pose_01').animacao).toBe('acenar');
  });
});

describe('trajetos da floresta', () => {
  it('a escalada sai do chão e chega exatamente na porta, sempre subindo', async () => {
    const { trajetoDaEscalada } = await import('../animacaoSagui');
    const { pontos, duracaoMs } = trajetoDaEscalada(300, 120, 50);
    expect(pontos[0].y).toBe(300);
    expect(pontos[pontos.length - 1].y).toBe(120);
    for (let i = 1; i < pontos.length; i++) {
      expect(pontos[i].t).toBeGreaterThanOrEqual(pontos[i - 1].t);
      expect(pontos[i].y).toBeLessThanOrEqual(pontos[i - 1].y);
    }
    expect(pontos.some((p) => p.escalaX < 0)).toBe(true);
    expect(pontos[pontos.length - 1].escalaX).toBe(1);
    expect(duracaoMs).toBe(1800);
  });

  it('a duração da subida bate com a fase da floresta', async () => {
    const { trajetoDaEscalada, DURACAO_DA_ENTRADA } = await import('../animacaoSagui');
    const { duracaoDaFase } = await import('../florestaDoDia');
    expect(trajetoDaEscalada(10, 0, 0).duracaoMs).toBe(duracaoDaFase('subindo', false));
    expect(DURACAO_DA_ENTRADA).toBe(duracaoDaFase('entrando', false));
  });

  it('a entrada termina invisível, no centro da toca', async () => {
    const { trajetoDaEntrada } = await import('../animacaoSagui');
    const pts = trajetoDaEntrada({ x: 90, y: 60 }, { x: 80, y: 150 }, 70);
    const fim = pts[pts.length - 1];
    expect(fim.opacidade).toBe(0);
    expect(fim.x + 35).toBe(80);
    expect(fim.y + 35).toBe(150);
    expect(pts[0]).toMatchObject({ x: 90, y: 60, opacidade: 1 });
  });
});

describe('entrada e câmera', () => {
  it('o sagui já sumiu quando o zoom começa', async () => {
    const { trajetoDaEntrada, INICIO_DO_ZOOM } = await import('../animacaoSagui');
    const pts = trajetoDaEntrada({ x: 0, y: 0 }, { x: 50, y: 100 }, 60);
    for (const p of pts) if (p.t >= INICIO_DO_ZOOM) expect(p.opacidade).toBe(0);
  });
});
