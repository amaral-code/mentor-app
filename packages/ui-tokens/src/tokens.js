/**
 * Tokens do visual lúdico claro (Figma "Midnight Mentor · Visual Lúdico").
 *
 * FONTE ÚNICA: o tailwind.config.js do web e o do app Expo (NativeWind)
 * importam daqui, e o `tema.ts` do app também. Antes os mesmos hex
 * moravam em três lugares, e o primeiro ajuste de tom divergiria.
 *
 * JavaScript puro (com .d.ts ao lado), e não TypeScript, porque o
 * Tailwind carrega a configuração no Node sem compilador.
 */

/** Paletas por família, no formato do Tailwind (`bg-azul-600`). */
export const paletas = {
  tinta: { 900: '#0B0F19', 700: '#1E2538', 500: '#475569' },
  azul: { 50: '#F3F6FC', 100: '#E6ECF7', 200: '#CCD7EC', 500: '#3A5088', 600: '#2A3B63', 700: '#1E2538' },
  ceu: { 50: '#F0F6FF', 100: '#E3EEFF', 200: '#C7DCFD', 500: '#4C8DF6', 600: '#2F6FDB', 700: '#1E56B8' },
  cinza: { 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8' },
  ambar: { 50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
  esmeralda: { 50: '#ECFDF5', 500: '#10B981', 600: '#059669', 700: '#047857' },
  vermelho: { 50: '#FEF2F2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
  violeta: { 600: '#7C3AED', 800: '#5B21B6' },
  laranja: { 600: '#EA580C' },
};

export const superficie = '#F4F7FB';
export const branco = '#FFFFFF';

/** Espaçamento em pontos (px no web). */
export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Raios de borda. */
export const raio = { sm: 10, md: 16, lg: 20, xl: 24, pilula: 999 };

/** "Lábio" do botão e do cartão adesivo: borda inferior sólida. */
export const labio = 4;

/** Alvo de toque mínimo (WCAG 2.5.5, guias da Apple e do Google). */
export const alvoToque = 48;

/** Fonte do visual lúdico (no celular, a do sistema até a Nunito ser embarcada). */
export const fonte = { familia: 'Nunito', reserva: ['system-ui', 'sans-serif'] };
