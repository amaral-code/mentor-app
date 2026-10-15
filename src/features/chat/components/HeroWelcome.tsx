import { memo } from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroWelcomeProps {
  titulo: string;
  subtitulo: string;
  onPrompt: (query: string) => void;
}

/* Perguntas de partida: o rótulo diz a área, o título é a pergunta como o
   aluno a faria, e a consulta completa vai para a caixa de texto ao tocar.
   Sem promessa ("infalível", "nota 1000"): o Mentor explica, não garante. */
const SUGESTOES = [
  {
    id: 'card-tri',
    area: 'Estratégia de prova',
    titulo: 'Como a TRI calcula a minha nota e o que muda na estratégia?',
    query: 'Como a TRI calcula a nota do ENEM? Explique a coerência pedagógica e o que isso muda na minha estratégia de prova.',
  },
  {
    id: 'card-redacao',
    area: 'Redação',
    titulo: 'Como montar a introdução da redação?',
    query: 'Como montar uma boa introdução na redação do ENEM? Mostre a estrutura e um exemplo.',
  },
  {
    id: 'card-matematica',
    area: 'Matemática',
    titulo: 'Atalhos de porcentagem e escala para a prova',
    query: 'Me mostre atalhos de porcentagem e escala para a prova de Matemática do ENEM, com uma questão de exemplo.',
  },
];

/**
 * Estado vazio do Mentor: quem responde e por onde começar.
 *
 * Antes: lâmpada de 96px com dois anéis tracejados, partículas, halo
 * pulsando e três cartões com orbe de luz no canto, todos iguais. Era a
 * tela de entrada de qualquer chat de IA. Agora é o sagui, uma frase e
 * três perguntas reais numa lista, que é o que a pessoa vai ler.
 *
 * Memorizada: o pai re-renderiza a cada tecla e tick.
 */
export const HeroWelcome = memo(function HeroWelcome({ titulo, subtitulo, onPrompt }: HeroWelcomeProps) {
  return (
    <div className="w-full max-w-2xl my-auto" id="heroWelcome">
      <div className="flex items-end gap-4">
        <img src="/assets/sagui_estudando_2.png" alt="" width={72} height={72} className="w-[72px] h-[72px] object-contain shrink-0" />
        <div className="pb-1">
          <h2 className="text-2xl md:text-[1.75rem] text-white">{titulo}</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-lg">{subtitulo}</p>
        </div>
      </div>

      <p className="rotulo mt-8 mb-2">Para começar</p>
      <ul className="painel rounded-2xl overflow-hidden pauta">
        {SUGESTOES.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onPrompt(c.query)}
              className="prompt-lift-card group w-full text-left px-4 py-3.5 flex items-center gap-4"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-gray-500">{c.area}</span>
                <span className="block text-[0.9375rem] text-gray-100 mt-0.5">{c.titulo}</span>
              </span>
              <ArrowRight size={16} className="card-arrow text-gray-500 group-hover:text-amber-400 shrink-0" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mt-3">Tocar numa pergunta só preenche a caixa de texto: dá para ajustar antes de enviar.</p>
    </div>
  );
});
