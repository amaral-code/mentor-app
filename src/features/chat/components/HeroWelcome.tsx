import { memo } from 'react';
import { ArrowRight, Feather, Lightbulb, Ruler, Zap } from 'lucide-react';

interface HeroWelcomeProps {
  titulo: string;
  subtitulo: string;
  onPrompt: (query: string) => void;
}

/* Cards do estado vazio (protótipo 1:1): rótulo curto visível e consulta
   completa digitada no input ao clicar. */
const CARDS = [
  {
    id: 'card-tri',
    rotulo: 'Dicas ENEM',
    titulo: 'Como não zerar e pontuar alto pela TRI?',
    query: 'Como não zerar e pontuar alto pela TRI? Explique a coerência pedagógica.',
    icone: Zap,
    borda: 'border-amber-500/30 hover:border-amber-400/90',
    brilho: 'hover:shadow-[0_0_28px_rgba(245,158,11,0.35)]',
    orbe: 'bg-amber-500/15 group-hover:bg-amber-500/30',
    selo: 'from-amber-500/20 to-amber-600/20 border-amber-400/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    iconeCor: 'text-amber-400',
    rodape: 'group-hover:text-amber-300',
  },
  {
    id: 'card-redacao',
    rotulo: 'Redação',
    titulo: 'Estrutura infalível para a introdução nota 1000',
    query: 'Qual a estrutura infalível para uma introdução nota 1000 na redação do ENEM?',
    icone: Feather,
    borda: 'border-emerald-500/30 hover:border-emerald-400/90',
    brilho: 'hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]',
    orbe: 'bg-emerald-500/15 group-hover:bg-emerald-500/30',
    selo: 'from-emerald-500/20 to-teal-600/20 border-emerald-400/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]',
    iconeCor: 'text-emerald-400',
    rodape: 'group-hover:text-emerald-300',
  },
  {
    id: 'card-matematica',
    rotulo: 'Matemática',
    titulo: 'Macetes rápidos de porcentagem e escala',
    query: 'Me mostre macetes rápidos de porcentagem e escala para a prova de Matemática do ENEM.',
    icone: Ruler,
    borda: 'border-cyan-500/30 hover:border-cyan-400/90',
    brilho: 'hover:shadow-[0_0_28px_rgba(6,182,212,0.35)]',
    orbe: 'bg-cyan-500/15 group-hover:bg-cyan-500/30',
    selo: 'from-cyan-500/20 to-blue-600/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)]',
    iconeCor: 'text-cyan-400',
    rodape: 'group-hover:text-cyan-300',
  },
];

/**
 * Boas-vindas do Mentor (protótipo AGcode 1:1): lâmpada hero com anéis
 * orbitais + 3 cards de prompt com hover 3D.
 *
 * Memorizada: carta estatica; o pai re-renderiza a cada tecla e tick.
 */
export const HeroWelcome = memo(function HeroWelcome({ titulo, subtitulo, onPrompt }: HeroWelcomeProps) {
  return (
    <div
      className="w-full max-w-4xl flex flex-col items-center text-center my-auto transition-all duration-300"
      id="heroWelcome"
    >
      {/* Lâmpada hero com anéis concêntricos, órbitas e partículas */}
      <div className="relative mb-7 flex items-center justify-center">
        <div className="absolute w-40 h-40 rounded-full border border-dashed border-amber-500/35 animate-spin-orbit pointer-events-none" />
        <div className="absolute w-32 h-32 rounded-full border border-dotted border-cyan-400/40 animate-spin-orbit-rev pointer-events-none" />
        <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-amber-500/40 via-amber-400/25 to-emerald-400/25 blur-2xl animate-pulse" />
        <div className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_10px_#f59e0b] animate-particle-1 pointer-events-none" />
        <div className="absolute w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee] animate-particle-2 pointer-events-none" />
        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-b from-[#1c2742] via-[#101828] to-[#0a0f1b] border-2 border-amber-400/70 flex items-center justify-center text-amber-300 animate-hero-bulb cursor-pointer hover:scale-105 transition-transform">
          <Lightbulb size={40} strokeWidth={1.6} className="drop-shadow-[0_0_15px_rgba(245,158,11,0.9)]" />
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-midnight-950 flex items-center justify-center shadow-[0_0_12px_#f59e0b] ring-2 ring-[#070a14]">
            <Zap size={10} strokeWidth={3} />
          </div>
        </div>
      </div>

      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-amber-300 drop-shadow-[0_2px_18px_rgba(245,158,11,0.3)]">
        {titulo}
      </h1>
      <p className="text-xs sm:text-sm text-slate-300/90 max-w-lg mx-auto font-sans leading-relaxed mb-8 drop-shadow-sm">
        {subtitulo}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
        {CARDS.map((c) => {
          const Icone = c.icone;
          return (
            <button
              key={c.id}
              onClick={() => onPrompt(c.query)}
              className={`prompt-lift-card group relative bg-gradient-to-b from-[#141b2e]/90 to-[#0b101c]/90 hover:from-[#1c2642] hover:to-[#121a2c] backdrop-blur-xl border ${c.borda} p-4 rounded-2xl flex flex-col justify-between shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${c.brilho} cursor-pointer text-left overflow-hidden active:scale-[0.98]`}
            >
              <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-xl transition-all duration-300 ${c.orbe}`} />
              <div className="relative z-10">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gradient-to-r border text-[11px] font-bold mb-2.5 ${c.selo}`}>
                  <Icone size={12} className={c.iconeCor} />
                  <span>{c.rotulo}</span>
                </div>
                <p className="text-[13px] text-slate-200 font-sans leading-snug group-hover:text-white transition-colors font-medium">
                  {c.titulo}
                </p>
              </div>
              <div className={`mt-4 pt-2 border-t border-white/5 text-[10px] font-semibold text-slate-400 flex items-center justify-between transition-colors relative z-10 ${c.rodape}`}>
                <span>Perguntar agora</span>
                <ArrowRight size={10} className="card-arrow transition-transform duration-300" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
