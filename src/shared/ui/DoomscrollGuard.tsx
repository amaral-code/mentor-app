import { useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useAppStore } from '../../stores/appStore';
import { useBemEstarStore } from '../../stores/bemEstarStore';
import { criarRastreadorOciosidade, sugestaoLocal } from '../lib/idleTracker';
import { aiAvailable, gerarIntervencaoDoomscroll } from '../lib/aiService';
import { MOOD_LABEL } from '../lib/utils';

/**
 * INTERVENCAO DE DOOMSCROLLING ACADEMICO.
 *
 * Fica montado no shell (uma instancia so) e observa a interface inteira.
 * Quando idleTracker detecta rolagem sem decisao por 2 minutos, a tela
 * escurece SUAVEMENTE - 400 ms de fade, sem susto - e o Sagui propoe uma
 * unica tarefa pequena.
 *
 * DECISOES QUE PARECEM DETALHE E NAO SAO
 * - "Agora nao" fecha e nao pergunta de novo por 15 minutos. Insistir
 *   transformaria a ajuda em perseguicao.
 * - Nao ha lista de opcoes: escolher e exatamente o que a pessoa nao
 *   esta conseguindo fazer.
 * - O congelamento NAO bloqueia o app: qualquer clique fora fecha. E um
 *   convite, nao um pedagio.
 * - A resposta (aceitou ou nao) vai para AI_Interventions_Log, que e
 *   como se descobre se a intervencao ajuda ou irrita.
 */
export function DoomscrollGuard() {
  const reduzir = useReducedMotion();
  const apiKey = useAppStore((s) => s.apiKey);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const quizResults = useAppStore((s) => s.quizResults);
  const currentMood = useAppStore((s) => s.currentMood);
  const intervencao = useBemEstarStore((s) => s.intervencao);
  const mostrarIntervencao = useBemEstarStore((s) => s.mostrarIntervencao);
  const responderIntervencao = useBemEstarStore((s) => s.responderIntervencao);

  useEffect(() => {
    const rastreador = criarRastreadorOciosidade(async (avaliacao) => {
      // Materia sugerida: a ultima praticada, senao Biologia (a de maior
      // volume no ENEM). Sugerir "escolha uma materia" seria repetir o
      // problema.
      const materia = quizResults.at(-1)?.materia || 'Biologia';
      const local = sugestaoLocal(materia);

      const base = {
        titulo: local.titulo,
        convite: local.convite,
        acao: local.acao,
        materia,
        segundosVagando: avaliacao.segundosVagando,
      };

      // Mostra o texto local IMEDIATAMENTE e troca pelo da IA quando
      // chegar: esperar 2 s por rede em cima de alguem travado seria
      // somar espera a espera.
      await mostrarIntervencao(base);

      if (!aiAvailable(apiKey)) return;
      try {
        const ia = await gerarIntervencaoDoomscroll(
          {
            materiaSugerida: materia,
            segundosVagando: avaliacao.segundosVagando,
            horaLocal: new Date().getHours(),
            humor: MOOD_LABEL[currentMood],
          },
          apiKey,
        );
        useBemEstarStore.setState((s) =>
          s.intervencao ? { intervencao: { ...s.intervencao, ...ia } } : s,
        );
      } catch {
        // Fica o texto local. Uma intervencao empatica que nao aparece
        // por falha de rede e pior que uma frase padrao.
      }
    });

    return () => rastreador.parar();
  }, [apiKey, quizResults, currentMood]);

  if (!intervencao) return null;

  async function aceitar() {
    const materia = intervencao?.materia;
    await responderIntervencao(true);
    // Entrega a tarefa pronta: 3 questoes da materia sugerida.
    (window as any).__intervencaoQuiz = { materia, quantidade: 3 };
    setActiveTab('quiz');
  }

  return (
    <AnimatePresence>
      {intervencao && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <m.button
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
            aria-label="Continuar navegando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => responderIntervencao(false)}
          />

          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doomscroll-titulo"
            className="relative z-10 w-full max-w-sm glass rounded-3xl p-6 text-center border border-white/[0.06]"
            initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={reduzir ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduzir ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="/assets/sagui_meditando_2.png"
              alt=""
              width={96}
              height={96}
              className="mx-auto mb-3 opacity-90"
            />

            <h2 id="doomscroll-titulo" className="text-lg font-bold text-white">
              {intervencao.titulo}
            </h2>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{intervencao.convite}</p>

            <div className="flex flex-col gap-2 mt-5">
              <button onClick={aceitar} className="btn-primary py-3">
                {intervencao.acao}
              </button>
              <button
                onClick={() => responderIntervencao(false)}
                className="btn-ghost text-sm text-gray-500 hover:text-gray-300 py-2"
              >
                Agora nao
              </button>
            </div>

            <p className="text-[10px] text-gray-600 mt-4">
              Aparece no maximo uma vez a cada 15 minutos.
            </p>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
