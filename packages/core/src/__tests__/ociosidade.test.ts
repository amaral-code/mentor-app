import { describe, expect, it } from 'vitest';
import { criarDetectorDeToque } from '../ociosidade';

/** Relógio de mentira: o teste anda o tempo na mão. */
function relogio() {
  let t = 1_000_000;
  return { agora: () => t, andar: (ms: number) => (t += ms) };
}

function arrastar(d: ReturnType<typeof criarDetectorDeToque>, r: ReturnType<typeof relogio>) {
  d.tocou(100, 500);
  r.andar(100);
  d.moveu(100, 400);
  d.moveu(100, 300); // o mesmo arrasto não conta duas vezes
  r.andar(100);
  d.soltou();
}

describe('detector de doomscroll por toque', () => {
  it('2 minutos arrastando sem tocar em nada: intervém uma vez e respeita o intervalo', () => {
    const r = relogio();
    const d = criarDetectorDeToque(undefined, r.agora);
    for (let i = 0; i < 12; i++) {
      arrastar(d, r);
      r.andar(10_000);
    }
    expect(d.estado().eventosNavegacao).toBe(12);
    expect(d.avaliar()?.motivo).toBe('doomscroll');
    for (let i = 0; i < 12; i++) {
      arrastar(d, r);
      r.andar(10_000);
    }
    expect(d.avaliar()).toBeNull(); // menos de 15 minutos depois
  });

  it('um toque parado num botão é decisão e zera a janela', () => {
    const r = relogio();
    const d = criarDetectorDeToque(undefined, r.agora);
    for (let i = 0; i < 12; i++) {
      arrastar(d, r);
      r.andar(10_000);
    }
    d.tocou(50, 50);
    r.andar(120);
    d.soltou();
    expect(d.estado().eventosNavegacao).toBe(0);
    expect(d.avaliar()).toBeNull();
  });

  it('segurar o dedo parado não conta como decisão', () => {
    const r = relogio();
    const d = criarDetectorDeToque(undefined, r.agora);
    arrastar(d, r);
    d.tocou(10, 10);
    r.andar(900);
    d.soltou();
    expect(d.estado().eventosNavegacao).toBe(1);
  });

  it('celular largado na mesa não é doomscroll', () => {
    const r = relogio();
    const d = criarDetectorDeToque(undefined, r.agora);
    for (let i = 0; i < 10; i++) arrastar(d, r);
    r.andar(5 * 60_000);
    expect(d.avaliar()).toBeNull();
  });
});
