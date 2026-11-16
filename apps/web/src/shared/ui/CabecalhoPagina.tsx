import type { ReactNode } from 'react';

/*
 * Faixa colorida de cabeçalho com o sagui (visual lúdico).
 *
 * Substitui o "ícone pequeno + título" das páginas do aluno. No computador
 * aquele cabeçalho deixava a tela sem vida: uma linha de texto cinza num
 * mar de branco. Uma cor por seção também ajuda a criança a saber onde
 * está sem ler o título.
 *
 * As cores são os tons FORTES (âmbar 600, esmeralda 600, céu 600): com o
 * tom 500 o título branco ficava abaixo do contraste mínimo.
 */

export type CorFaixa = 'azul' | 'ceu' | 'ambar' | 'esmeralda' | 'violeta';
export type PoseSagui = 'acenando' | 'aprovacao' | 'estudando' | 'estudando_caderno' | 'meditando' | 'pulando';

const FUNDO: Record<CorFaixa, string> = {
  azul: 'bg-azul-600 shadow-lip-azul',
  ceu: 'bg-ceu-600 shadow-lip-ceu-forte',
  ambar: 'bg-amber-600 shadow-lip-ambar-forte',
  esmeralda: 'bg-emerald-600 shadow-lip-esmeralda-forte',
  violeta: 'bg-violet-600 shadow-lip-violeta',
};

interface Props {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  cor: CorFaixa;
  pose: PoseSagui;
  /** Botões ou selos que ficavam ao lado do título (Meditar, Studio, saldo). */
  acao?: ReactNode;
  className?: string;
}

export function CabecalhoPagina({ titulo, subtitulo, cor, pose, acao, className = '' }: Props) {
  return (
    <header className={`relative overflow-hidden rounded-[24px] md:rounded-[28px] ${FUNDO[cor]} px-5 py-4 md:px-8 md:py-7 ${className}`}>
      {/* Bolhas decorativas: dão profundidade sem degradê nem brilho. */}
      <span className="pointer-events-none absolute -right-10 -top-12 w-44 h-44 md:w-64 md:h-64 rounded-full bg-white/10" aria-hidden="true" />
      <span className="pointer-events-none absolute right-28 -bottom-16 w-32 h-32 md:w-44 md:h-44 rounded-full bg-white/10 hidden md:block" aria-hidden="true" />
      <div className="relative z-10 min-w-0 pr-20 md:pr-48">
        <h1 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">{titulo}</h1>
        {subtitulo && <p className="text-sm md:text-lg font-bold text-white/90 mt-1 leading-snug">{subtitulo}</p>}
        {acao && <div className="mt-3 md:mt-4 flex flex-wrap items-center gap-2">{acao}</div>}
      </div>
      <img
        src={`/assets/sagui_${pose}_2.png`}
        alt=""
        width={176}
        height={176}
        loading="lazy"
        draggable={false}
        className="pointer-events-none select-none absolute right-1 md:right-6 bottom-0 w-20 h-20 md:w-44 md:h-44 object-contain object-bottom motion-safe:animate-float-suave"
      />
    </header>
  );
}

/* Botão claro para usar dentro da faixa (contraste sobre a cor). */
export const BOTAO_NA_FAIXA =
  'inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3.5 py-2 min-h-[40px] text-xs font-extrabold uppercase tracking-wide text-tinta-900 shadow-[0_3px_0_rgba(0,0,0,0.18)] active:translate-y-[3px] active:shadow-none transition-transform';

/* Selo informativo dentro da faixa (saldo, contagem). */
export const SELO_NA_FAIXA =
  'inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-extrabold text-white';
