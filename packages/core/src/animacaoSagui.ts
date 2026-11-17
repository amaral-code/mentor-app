/**
 * Animações do sagui, uma para cada pose.
 *
 * A arte não muda: nada aqui desenha um sagui novo. O movimento vem de
 * transformações da imagem inteira (subir, encolher, girar, espelhar),
 * que é o que mantém o traço do artista intacto em qualquer pose. A
 * escalada, que não tem desenho próprio, alterna a pose "pulando" (um
 * braço no alto) com o espelho dela: braço esquerdo, braço direito, como
 * quem puxa o corpo tronco acima.
 *
 * Os quadros ficam no core para o web (motion) e o app (Reanimated)
 * tocarem exatamente o mesmo movimento.
 */

/** Todas as poses que existem em arte (as 6 do app são um subconjunto). */
export type PoseSagui =
  | 'acenando'
  | 'aprovacao'
  | 'estudando'
  | 'estudando_caderno'
  | 'meditando'
  | 'pulando'
  | `pose_${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20'}`;

export type Animacao = 'flutuar' | 'respirar' | 'balancar' | 'acenar' | 'pular' | 'comemorar' | 'escalar';

export interface Quadro {
  /** Posição no ciclo, de 0 a 1. */
  t: number;
  /** Deslocamento vertical em fração do tamanho (negativo sobe). */
  y: number;
  escalaX: number;
  escalaY: number;
  /** Giro em graus, com o eixo no pé do sagui. */
  giro: number;
  /** Escalada: troca para o espelho da pose (o outro braço no alto). */
  espelhar: boolean;
}

export interface Movimento {
  animacao: Animacao;
  duracaoMs: number;
  quadros: Quadro[];
}

const q = (t: number, p: Partial<Omit<Quadro, 't'>> = {}): Quadro => ({
  t,
  y: p.y ?? 0,
  escalaX: p.escalaX ?? 1,
  escalaY: p.escalaY ?? 1,
  giro: p.giro ?? 0,
  espelhar: p.espelhar ?? false,
});

export const MOVIMENTOS: Record<Animacao, Movimento> = {
  // Meditando: sobe e desce devagar, como quem respira fundo.
  flutuar: { animacao: 'flutuar', duracaoMs: 3200, quadros: [q(0), q(0.5, { y: -0.05, escalaY: 1.015 }), q(1)] },
  // Parado: só o peito enche e esvazia. Pouco, para não cansar a vista.
  respirar: {
    animacao: 'respirar',
    duracaoMs: 2600,
    quadros: [q(0), q(0.45, { escalaX: 0.985, escalaY: 1.03 }), q(1)],
  },
  // Estudando: a cabeça acompanha a leitura, de um lado para o outro.
  balancar: {
    animacao: 'balancar',
    duracaoMs: 2800,
    quadros: [q(0), q(0.25, { giro: -3 }), q(0.5), q(0.75, { giro: 3 }), q(1)],
  },
  // Acenando: o corpo todo vai e volta, puxado pelo braço.
  acenar: {
    animacao: 'acenar',
    duracaoMs: 1400,
    quadros: [q(0), q(0.2, { giro: -6 }), q(0.4, { giro: 5 }), q(0.6, { giro: -4 }), q(0.8, { giro: 2 }), q(1)],
  },
  // Pulando: agacha (achata), sobe esticado, cai e amortece.
  pular: {
    animacao: 'pular',
    duracaoMs: 1100,
    quadros: [
      q(0),
      q(0.15, { escalaX: 1.08, escalaY: 0.9 }),
      q(0.4, { y: -0.18, escalaX: 0.94, escalaY: 1.08 }),
      q(0.65, { y: 0, escalaX: 1.06, escalaY: 0.93 }),
      q(0.8, { escalaX: 0.98, escalaY: 1.02 }),
      q(1),
    ],
  },
  // Aprovação: um pulinho curto e um "estalo" de tamanho, como quem diz "isso!".
  comemorar: {
    animacao: 'comemorar',
    duracaoMs: 1600,
    quadros: [q(0), q(0.12, { y: -0.06, escalaX: 1.06, escalaY: 1.06 }), q(0.25), q(0.37, { y: -0.04, giro: 4 }), q(0.5), q(1)],
  },
  // Escalada: quatro puxadas por ciclo, alternando o braço que vai no alto.
  // Cada puxada sobe o corpo e dá um leve tranco de lado.
  escalar: {
    animacao: 'escalar',
    duracaoMs: 600,
    quadros: [
      q(0, { giro: -4 }),
      q(0.22, { y: -0.06, giro: 3, escalaY: 1.04 }),
      q(0.25, { y: -0.06, giro: 3, espelhar: true }),
      q(0.47, { y: -0.12, giro: -3, escalaY: 1.04, espelhar: true }),
      q(0.5, { y: -0.12, giro: -3 }),
      q(0.72, { y: -0.18, giro: 3, escalaY: 1.04 }),
      q(0.75, { y: -0.18, giro: 3, espelhar: true }),
      q(0.97, { y: -0.24, giro: -4, escalaY: 1.04, espelhar: true }),
      q(1, { y: -0.24, giro: -4 }),
    ],
  },
};

/** Qual animação combina com cada desenho (pelo que o desenho mostra, não pelo nome). */
export const ANIMACAO_DA_POSE: Record<PoseSagui, Animacao> = {
  // O arquivo "acenando" mostra o sagui sentado de olhos fechados: medita.
  acenando: 'flutuar',
  meditando: 'flutuar',
  pose_08: 'flutuar',
  aprovacao: 'comemorar',
  pose_10: 'comemorar',
  estudando: 'balancar',
  estudando_caderno: 'balancar',
  pose_06: 'balancar',
  pose_13: 'balancar',
  pose_14: 'balancar',
  pose_20: 'balancar',
  pose_01: 'acenar',
  pose_15: 'acenar',
  pulando: 'pular',
  pose_07: 'pular',
  pose_11: 'pular',
  pose_12: 'pular',
  pose_17: 'pular',
  pose_18: 'pular',
  pose_19: 'pular',
  pose_02: 'respirar',
  pose_03: 'respirar',
  pose_04: 'respirar',
  pose_05: 'respirar',
  pose_09: 'respirar',
  pose_16: 'respirar',
};

/** Pose usada na escalada (a que tem um braço no alto). */
export const POSE_DA_ESCALADA: PoseSagui = 'pulando';

export function movimentoDaPose(pose: PoseSagui): Movimento {
  return MOVIMENTOS[ANIMACAO_DA_POSE[pose] ?? 'respirar'];
}

const mistura = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * O quadro num instante do ciclo (0 a 1), interpolando entre os vizinhos.
 * O espelho não interpola: é o desenho do outro braço, troca de uma vez.
 */
export function quadroNoTempo(m: Movimento, t: number): Quadro {
  const tt = ((t % 1) + 1) % 1;
  const qs = m.quadros;
  for (let i = 0; i < qs.length - 1; i++) {
    const a = qs[i];
    const b = qs[i + 1];
    if (tt >= a.t && tt <= b.t) {
      const k = b.t === a.t ? 0 : (tt - a.t) / (b.t - a.t);
      return {
        t: tt,
        y: mistura(a.y, b.y, k),
        escalaX: mistura(a.escalaX, b.escalaX, k),
        escalaY: mistura(a.escalaY, b.escalaY, k),
        giro: mistura(a.giro, b.giro, k),
        espelhar: a.espelhar,
      };
    }
  }
  return { ...qs[qs.length - 1], t: tt };
}

/** Quanto o sagui sobe num ciclo de escalada (fração do tamanho dele). */
export const SUBIDA_POR_CICLO = 0.24;

/**
 * Movimento reduzido: pose parada. Vale para todas as animações, sem
 * exceção; quem pede para reduzir não quer um mascote se mexendo na tela.
 */
export function quadroParado(): Quadro {
  return q(0);
}

/* ------------------------------------------------------------------ */

/**
 * Um ponto da trajetória em pixels, pronto para o motion (web) e o
 * Reanimated (app). `escalaX` já vem com o sinal do espelho.
 */
export interface Ponto {
  t: number;
  x: number;
  y: number;
  escalaX: number;
  escalaY: number;
  giro: number;
  opacidade: number;
}

export const CICLOS_DA_ESCALADA = 3;

/**
 * A subida do pé da árvore até a porta da toca: três ciclos de escalada,
 * cada um sobe um terço do caminho. A distância muda com o tamanho da
 * árvore, então a puxada estica para chegar exatamente na porta.
 */
/** Quanto o corpo pende para o lado da mão que agarra o tronco, em pixels. */
export const PENDULO_ESCALADA = 7;

export function trajetoDaEscalada(yChao: number, yPorta: number, x: number): { pontos: Ponto[]; duracaoMs: number } {
  const m = MOVIMENTOS.escalar;
  const porCiclo = (yChao - yPorta) / CICLOS_DA_ESCALADA;
  const pontos: Ponto[] = [];
  for (let c = 0; c < CICLOS_DA_ESCALADA; c++) {
    for (const qd of m.quadros) {
      // Último quadro de um ciclo = primeiro do seguinte: não repete.
      if (c > 0 && qd.t === 0) continue;
      const fracao = qd.y / -SUBIDA_POR_CICLO; // 0 no início do ciclo, 1 no fim
      pontos.push({
        t: (c + qd.t) / CICLOS_DA_ESCALADA,
        // Pende para o lado do braço levantado: o corpo "pesa" na mão que
        // agarrou o tronco, e isso é o que faz a subida parecer mão sobre
        // mão em vez de flutuar ao lado da árvore.
        x: x + (qd.espelhar ? -PENDULO_ESCALADA : PENDULO_ESCALADA),
        y: yChao - porCiclo * (c + fracao),
        escalaX: qd.espelhar ? -qd.escalaX : qd.escalaX,
        escalaY: qd.escalaY,
        giro: qd.giro,
        opacidade: 1,
      });
    }
  }
  // Pé no chão (começo) e porta (fim) ficam centrados no tronco, sem lean.
  pontos[0] = { ...pontos[0], x };
  pontos[pontos.length - 1] = { ...pontos[pontos.length - 1], x, y: yPorta, giro: 0, escalaX: 1, escalaY: 1 };
  return { pontos, duracaoMs: m.duracaoMs * CICLOS_DA_ESCALADA };
}

export const DURACAO_DA_ENTRADA = 1100;
/** A partir de que ponto da entrada a câmera começa o zoom na toca. */
export const INICIO_DO_ZOOM = 0.7;

/**
 * A entrada na toca: agacha, pula para cima do buraco e mergulha de
 * cabeça, girando e encolhendo até sumir no escuro. `x` e `y` são o canto
 * da imagem; o centro do buraco fica em (tocaX, tocaY).
 */
export function trajetoDaEntrada(porta: { x: number; y: number }, toca: { x: number; y: number }, tamanho: number): Ponto[] {
  const p = (t: number, x: number, y: number, ex: number, ey: number, giro: number, opacidade: number): Ponto => ({ t, x, y, escalaX: ex, escalaY: ey, giro, opacidade });
  const sobreToca = { x: toca.x - tamanho / 2, y: toca.y - tamanho * 1.15 };
  const dentro = { x: toca.x - tamanho / 2, y: toca.y - tamanho / 2 };
  return [
    p(0, porta.x, porta.y, 1, 1, 0, 1),
    p(0.14, porta.x, porta.y + tamanho * 0.04, 1.08, 0.88, 0, 1), // agacha
    p(0.36, (porta.x + sobreToca.x) / 2, sobreToca.y - tamanho * 0.12, 0.95, 1.08, -10, 1), // pulo
    p(0.5, sobreToca.x, sobreToca.y, 1, 1, 15, 1), // em cima do buraco
    // Mergulho: some no buraco ANTES do zoom da câmera começar; depois
    // do zoom ele apareceria nove vezes maior por cima da toca.
    p(INICIO_DO_ZOOM - 0.08, dentro.x, dentro.y, 0.35, 0.35, 150, 0.9),
    p(INICIO_DO_ZOOM, dentro.x, dentro.y, 0.08, 0.08, 190, 0),
    p(1, dentro.x, dentro.y, 0.05, 0.05, 200, 0),
  ];
}

/** Zoom da câmera na toca: depois do mergulho, a árvore cresce até o buraco cobrir a tela. */
export const ZOOM_FINAL = 9;
