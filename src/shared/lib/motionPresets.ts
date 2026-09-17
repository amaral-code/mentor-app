import type { Transition, Variants } from 'motion/react';

/**
 * Variants compartilhados de animação.
 *
 * Tudo que se move no app sai daqui. Variant declarado inline em cada tela
 * diverge com o tempo: um usa 200ms, outro 320ms, e o conjunto deixa de
 * parecer um produto só.
 *
 * Duas regras valem para todo preset:
 *
 * 1. Só `transform` e `opacity`. Animar width, height, margin ou top força
 *    o navegador a recalcular layout a cada quadro, o que derruba o frame
 *    rate em celular mediano, que é o aparelho do nosso aluno.
 *
 * 2. Quem decide se anima é o componente, via `useReducedMotion()`. Estes
 *    objetos são só a descrição do movimento.
 */

/** Easing de entrada do projeto. Já estava no tailwind.config.js. */
export const EASE_SAIDA = [0.16, 1, 0.3, 1] as const;

/* ====================================================================
   Transições de página
   ==================================================================== */

/**
 * Entrada de página: sobe 12px enquanto aparece.
 *
 * A saída é mais rápida que a entrada (150 contra 300ms) de propósito:
 * ninguém quer esperar para sair de onde já decidiu sair, mas a chegada
 * precisa de tempo para o olho acompanhar.
 */
/*
 * Entrada e saida de PAGINA (troca de aba).
 *
 * Os tempos somam, porque o AppShell usa `mode="wait"`: a pagina que sai
 * termina antes de a nova comecar. Era 0.15 + 0.3 = 0.45s por troca, e
 * navegacao com quase meio segundo de espera passa sensacao de app
 * travado - ainda mais para quem percorre varias abas seguidas.
 *
 * Agora sao 0.1 + 0.2 = 0.3s: continua suave o bastante para orientar o
 * olho sobre o que mudou, sem virar pedagio. O deslocamento tambem
 * encolheu (12 -> 8px), porque movimento vertical grande em pagina
 * inteira chama mais atencao que o proprio conteudo.
 */
/*
 * Versao para quem pede MOVIMENTO REDUZIDO.
 *
 * Antes, com a preferencia ligada, a troca de aba nao animava NADA: o
 * conteudo era substituido de uma vez, sem nenhuma pista visual de que a
 * secao mudou. Isso e mais do que a preferencia pede.
 *
 * O que incomoda quem ativa "reduzir movimento" e DESLOCAMENTO -
 * parallax, deslize, escala, coisas que o sistema vestibular le como
 * movimento real. Opacidade nao desloca nada, e por isso a recomendacao
 * corrente e justamente trocar o deslize por um crossfade, nao remover a
 * transicao.
 *
 * Entao aqui sai o `y` e fica so o fade, mais curto - quem pediu menos
 * movimento tambem nao quer esperar por ele.
 */
export const pageEnterSuave: Variants = {
  inicial: { opacity: 0 },
  animar: { opacity: 1, transition: { duration: 0.16, ease: 'linear' } },
  sair: { opacity: 0, transition: { duration: 0.09, ease: 'linear' } },
};

export const pageEnter: Variants = {
  inicial: { opacity: 0, y: 8 },
  animar: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: EASE_SAIDA },
  },
  sair: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
};

/* ====================================================================
   Listas em cascata
   ==================================================================== */

/** Máximo de itens que entram escalonados. Do 11º em diante, todos juntos. */
export const MAX_STAGGER = 10;

/**
 * Contêiner da lista. O atraso de 50ms entre filhos é o que dá a leitura
 * de "montado com capricho"; acima disso a lista começa a parecer lenta.
 */
export const listContainer: Variants = {
  inicial: {},
  animar: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

export const listItem: Variants = {
  inicial: { opacity: 0, y: 8 },
  animar: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE_SAIDA },
  },
};

/**
 * Atraso do item já calculado com o teto.
 * Use quando precisar controlar item a item em vez de usar staggerChildren.
 */
export function atrasoDoItem(indice: number): number {
  return Math.min(indice, MAX_STAGGER) * 0.05;
}

/* ====================================================================
   Física de toque
   ==================================================================== */

/**
 * Spring de resposta ao toque.
 *
 * stiffness alto com damping médio dá o leve overshoot que caracteriza
 * app nativo. Ease linear no lugar disto faz parecer site.
 */
export const springTap: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
};

/** Spring mais macio, para painéis grandes (bottom sheet, modal). */
export const springPainel: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

/** Entrada de modal e overlay: cresce de 0.9 com overshoot. */
export const popIn: Variants = {
  inicial: { opacity: 0, scale: 0.9 },
  animar: {
    opacity: 1,
    scale: 1,
    transition: springTap,
  },
  sair: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.14, ease: 'easeIn' },
  },
};

/* ====================================================================
   Celebração
   ==================================================================== */

/**
 * Comemoração de level up: sai de 0.5 com overshoot forte.
 * É o único movimento do app autorizado a passar de 400ms.
 */
export const celebracao: Variants = {
  inicial: { opacity: 0, scale: 0.5 },
  animar: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 18 },
  },
  sair: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
};

/** Brilho pulsando atrás da celebração. Opacity, nunca box-shadow. */
export const brilhoPulsante: Variants = {
  inicial: { opacity: 0, scale: 0.6 },
  animar: {
    opacity: [0, 0.55, 0.3],
    scale: [0.6, 1.15, 1],
    transition: { duration: 0.6, ease: EASE_SAIDA },
  },
};

/* ====================================================================
   Troca de conteúdo dentro da mesma tela
   ==================================================================== */

/** Avanço horizontal curto: próxima questão do quiz, próximo passo. */
export const avancar: Variants = {
  inicial: { opacity: 0, x: 24 },
  animar: { opacity: 1, x: 0, transition: { duration: 0.26, ease: EASE_SAIDA } },
  sair: { opacity: 0, x: -24, transition: { duration: 0.15, ease: 'easeIn' } },
};

/* ====================================================================
   Bottom sheet
   ==================================================================== */

export const bottomSheet: Variants = {
  inicial: { y: '100%' },
  animar: { y: 0, transition: springPainel },
  sair: { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
};

/** Arrastar além disto (ou com velocidade alta) fecha o painel. */
export const LIMITE_ARRASTO = 80;
export const VELOCIDADE_FECHAR = 500;
