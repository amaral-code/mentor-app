import type { SVGProps } from 'react';

/**
 * Ícones próprios do Midnight Mentor.
 *
 * ------------------------------------------------------------------
 * POR QUE NÃO SÃO OS DA BIBLIOTECA
 * ------------------------------------------------------------------
 * Ofensiva com chama, XP com raio e nível com estrela são a combinação
 * que identifica outro app de estudo. O dono pediu símbolos próprios,
 * para o produto não ser confundido com ele (2026-11-14). O tema daqui
 * é a NOITE de estudo, e os três saem dele:
 *
 *   ofensiva -> lua que acende     (era a chama)
 *   XP       -> estrela cadente    (era o raio)
 *   nível    -> brasão com divisas (era a estrela)
 *
 * O desenho aprovado está no Figma, página "Fundamentos", componentes
 * `Ícone/…`. Não volte a usar Flame, Zap ou Star da lucide para estes
 * três significados. Estrela de AVALIAÇÃO (nota do psicólogo) e raio de
 * "energia" continuam sendo os da biblioteca: lá o sentido é outro.
 *
 * Mesma assinatura dos ícones da lucide (`size`, `className`), para
 * entrar onde havia um deles sem mexer no resto. A cor vem do texto
 * (`currentColor`), como já era: `text-amber-500`, `text-slate-300`.
 * `fill` e `strokeWidth` são aceitos e ignorados, porque os chamadores
 * antigos ainda passam.
 */
type IconeProps = Omit<SVGProps<SVGSVGElement>, 'fill' | 'strokeWidth'> & {
  size?: number | string;
  fill?: string;
  strokeWidth?: number | string;
};

function base({ size = 24, fill: _fill, strokeWidth: _sw, ...resto }: IconeProps) {
  return { width: size, height: size, viewBox: '0 0 64 64', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', ...resto } as const;
}

/** Sombra do "lábio": o mesmo desenho, 3px abaixo, escurecido. */
const LABIO = { transform: 'translate(0 3)' } as const;

const LUA = 'M28.49 12.05 A22 22 0 1 0 51.21 39.83 A18 18 0 0 1 28.49 12.05 Z';
const ESTRELINHA = 'M46 6 L48.4 13.6 L56 16 L48.4 18.4 L46 26 L43.6 18.4 L36 16 L43.6 13.6 Z';

/** Ofensiva: noites seguidas de estudo. */
export function LuaOfensiva(props: IconeProps) {
  return (
    <svg {...base(props)}>
      <path d={LUA} {...LABIO} fill="currentColor" />
      <path d={LUA} {...LABIO} fill="#000" fillOpacity="0.18" />
      <path d={LUA} fill="currentColor" />
      <path d={ESTRELINHA} fill="currentColor" fillOpacity="0.75" />
    </svg>
  );
}

const ESTRELA = 'M40 9 L43.82 18.74 L54.27 19.36 L46.18 26.01 L48.82 36.14 L40 30.5 L31.18 36.14 L33.82 26.01 L25.73 19.36 L36.18 18.74 Z';

/** XP: cada acerto é uma estrela cadente. */
export function EstrelaCadente(props: IconeProps) {
  return (
    <svg {...base(props)}>
      <path d="M29 39 L9 57" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M20 31 L7 42" stroke="currentColor" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M39 47 L28 58" stroke="currentColor" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d={ESTRELA} fill="currentColor" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

/** Nível: brasão, com as divisas vazadas. */
export function BrasaoNivel(props: IconeProps) {
  return (
    <svg {...base(props)}>
      <path d="M32 5 L54 17 V45 L32 59 L10 45 V17 Z" fill="currentColor" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M20 30 L32 21 L44 30" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 43 L32 34 L44 43" stroke="#fff" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
