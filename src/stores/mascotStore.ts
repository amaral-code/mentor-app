import { create } from 'zustand';

/**
 * Máquina de estados do mascote.
 *
 * Estados da FSM (fluxo esperado no app):
 * idle -> usuário ocioso / lendo a questão (sagui_meditando.png)
 * typing -> usuário digitando / interagindo (caderno + lápis)
 * loading -> aguardando a IA / avaliando (tablete com joia de aprovação)
 * success -> usuário acertou / meta cumprida (sagui pulando de alegria)
 * error -> resposta errada (incentivo) (imagem neutra)
 */
export type MascotState = 'idle' | 'typing' | 'loading' | 'success' | 'error';

/** Sprite renderizado por estado. */
export const MASCOT_SPRITE: Record<MascotState, string> = {
  idle: '/assets/sagui_meditando_2.png',
  typing: '/assets/sagui_estudando_2.png',
  loading: '/assets/sagui_aprovacao_2.png',
  success: '/assets/sagui_pulando_2.png',
  error: '/assets/sagui_acenando_2.png',
};

/** Fallback caso algum sprite falhe (evita ícone quebrado). */
export const MASCOT_FALLBACK = '/assets/sagui_meditando_2.png';

/** Classe de animação (keyframes) aplicada por estado. */
export const MASCOT_ANIM: Record<MascotState, string> = {
  idle: 'mascot-anim-idle',
  typing: 'mascot-anim-typing',
  loading: 'mascot-anim-loading',
  success: 'mascot-anim-success',
  error: 'mascot-anim-error',
};

/** Mensagem padrão quando o balão está sem texto dinâmico. */
export const MASCOT_DEFAULT_MSG: Record<MascotState, string> = {
  idle: 'Respira fundo… leia a questão com calma. ',
  typing: 'Estou te acompanhando! Continua aí. ',
  loading: 'Analisando com a IA',
  success: 'Mandou bem! ',
  error: 'Quase lá! Analisa a explicação e tenta de novo. ',
};

interface MascotStore {
  state: MascotState;
  message: string | null;
  messageId: number;
  /** Troca o estado (e opcionalmente o texto do balão). O balão some ao trocar. */
  setState: (state: MascotState, message?: string) => void;
  /** Fala uma mensagem transitória sem mudar de estado (auto-remove após durationMs). */
  say: (message: string, durationMs?: number) => void;
  clearMessage: () => void;
}

let counter = 0;
let sayTimer: ReturnType<typeof setTimeout> | null = null;

export const mascotStore = create<MascotStore>((set) => ({
  state: 'idle',
  message: null,
  messageId: 0,
  setState: (state, message) => {
    if (sayTimer) {
      clearTimeout(sayTimer);
      sayTimer = null;
    }
    set({ state, message: message ?? null, messageId: ++counter });
  },
  say: (message, durationMs = 4000) => {
    if (sayTimer) {
      clearTimeout(sayTimer);
      sayTimer = null;
    }
    set({ message, messageId: ++counter });
    sayTimer = setTimeout(() => {
      set((s) => (s.message === message ? { message: null, messageId: ++counter } : s));
      sayTimer = null;
    }, durationMs);
  },
  clearMessage: () => set({ message: null, messageId: ++counter }),
}));

/** Conveniência: acessa o store sem hook. */
export const mascot = () => mascotStore.getState();
