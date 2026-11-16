import { memo } from 'react';
import { ArrowRight, Feather, Ruler, Zap } from 'lucide-react';

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
    borda: 'border-slate-200 hover:border-amber-400',
    selo: 'bg-amber-100 text-amber-700',
    iconeCor: 'text-amber-600',
    rodape: 'group-hover:text-amber-600',
  },
  {
    id: 'card-redacao',
    rotulo: 'Redação',
    titulo: 'Estrutura infalível para a introdução nota 1000',
    query: 'Qual a estrutura infalível para uma introdução nota 1000 na redação do ENEM?',
    icone: Feather,
    borda: 'border-slate-200 hover:border-emerald-400',
    selo: 'bg-emerald-100 text-emerald-700',
    iconeCor: 'text-emerald-600',
    rodape: 'group-hover:text-emerald-600',
  },
  {
    id: 'card-matematica',
    rotulo: 'Matemática',
    titulo: 'Macetes rápidos de porcentagem e escala',
    query: 'Me mostre macetes rápidos de porcentagem e escala para a prova de Matemática do ENEM.',
    icone: Ruler,
    borda: 'border-slate-200 hover:border-ceu-500',
    selo: 'bg-ceu-100 text-ceu-700',
    iconeCor: 'text-ceu-600',
    rodape: 'group-hover:text-cyan-700',
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
      {/* O sagui recebe o aluno, como o mascote do Duolingo no começo da lição. */}
      <img
        src="/assets/sagui_acenando_2.png"
        alt=""
        width={128}
        height={128}
        className="w-28 h-28 sm:w-32 sm:h-32 object-contain mb-4 motion-safe:animate-float-suave"
      />

      <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-azul-600">
        {titulo}
      </h1>
      <p className="text-sm sm:text-base font-semibold text-slate-500 max-w-lg mx-auto leading-relaxed mb-8">
        {subtitulo}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
        {CARDS.map((c) => {
          const Icone = c.icone;
          return (
            <button
              key={c.id}
              onClick={() => onPrompt(c.query)}
              className={`group relative bg-white border-2 ${c.borda} p-4 rounded-[20px] flex flex-col justify-between shadow-lip cursor-pointer text-left overflow-hidden transition-[transform,border-color] active:translate-y-1 active:shadow-none`}
            >
              <div className="relative z-10">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold mb-2.5 ${c.selo}`}>
                  <Icone size={14} className={c.iconeCor} />
                  <span>{c.rotulo}</span>
                </div>
                <p className="text-[15px] text-tinta-900 leading-snug font-bold">
                  {c.titulo}
                </p>
              </div>
              <div className={`mt-4 pt-2 border-t-2 border-slate-100 text-xs font-extrabold uppercase tracking-wide text-ceu-600 flex items-center justify-between transition-colors relative z-10 ${c.rodape}`}>
                <span>Perguntar agora</span>
                <ArrowRight size={14} strokeWidth={3} className="card-arrow transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
