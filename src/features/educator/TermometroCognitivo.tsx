import { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, RefreshCw, Thermometer } from 'lucide-react';
import { termometroRepository } from '../../shared/storage/TermometroRepository';
import {
  AMOSTRA_MINIMA,
  ROTULO_CALOR,
  resumoRede,
  turmasOcultas,
  turmasVisiveis,
  type TurmaTermometro,
} from '../../shared/lib/termometroCognitivo';
import { TurmaHeatCard } from './TurmaHeatCard';

const JANELAS = [
  { dias: 1, rotulo: 'Hoje' },
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
] as const;

/**
 * TERMOMETRO COGNITIVO — mapa de calor anonimo da escola.
 *
 * Complementa o "o que a turma erra" (EducatorInsights) com o "como a
 * turma esta": quantos alunos entraram em fadiga/esgotamento, puxados
 * pelo indice que o proprio app ja calcula, e o que fazer na aula de
 * hoje por causa disso.
 *
 * O que NAO existe aqui, de proposito: nome de aluno, lista de alunos,
 * link para conversa individual. A RPC so devolve agregado de turma com
 * pelo menos 5 alunos medidos; este componente nem teria de onde tirar o
 * individual se quisesse.
 */
/**
 * `escopo` só muda as palavras: quem decide QUAIS turmas entram é
 * `minhas_turmas()` no banco (026). Para o professor, "Escola: 30%"
 * seria falso, porque o número cobre só as turmas dele.
 */
export function TermometroCognitivo({ escopo = 'escola' }: { escopo?: 'escola' | 'professor' }) {
  const [dias, setDias] = useState<number>(1);
  const [dados, setDados] = useState<TurmaTermometro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await termometroRepository.carregar(dias));
    } catch {
      setErro('Não foi possível carregar o termômetro agora. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Derivacoes so mudam com os dados — nao a cada render do painel.
  const visiveis = useMemo(() => turmasVisiveis(dados), [dados]);
  const ocultas = useMemo(() => turmasOcultas(dados), [dados]);
  const rede = useMemo(() => resumoRede(dados), [dados]);
  const janela = dias === 1 ? 'hoje' : 'semana';

  return (
    <section aria-label={escopo === 'escola' ? 'Termômetro cognitivo da escola' : 'Termômetro cognitivo das suas turmas'} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
            <Thermometer size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white">
              {escopo === 'escola' ? 'Como a escola está' : 'Como suas turmas estão'}
            </h2>
            <p className="text-xs text-slate-500">
              {escopo === 'escola'
                ? `Cansaço por turma, anônimo, com mínimo de ${AMOSTRA_MINIMA} alunos medidos`
                : `Cansaço de cada turma, anônimo, para ajustar a aula de hoje. Mínimo de ${AMOSTRA_MINIMA} alunos medidos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Janela do termômetro" className="flex gap-1 rounded-xl bg-white/5 p-1">
            {JANELAS.map((j) => (
              <button
                key={j.dias}
                onClick={() => setDias(j.dias)}
                aria-pressed={dias === j.dias}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  dias === j.dias ? 'bg-violet-500/20 text-violet-200' : 'text-slate-400 hover:text-white'
                }`}
              >
                {j.rotulo}
              </button>
            ))}
          </div>
          <button
            onClick={() => void carregar()}
            disabled={carregando}
            aria-label="Atualizar termômetro"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Numero do topo: todas as turmas juntas, ponderado por aluno. Com
          UMA turma so ele repetia o cartao logo abaixo, palavra por
          palavra; o caso comum do professor. */}
      {!carregando && !erro && visiveis.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-midnight-900/60 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {escopo === 'escola' ? 'Escola' : 'Suas turmas'} · {ROTULO_CALOR[rede.nivel]}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            <span className="text-2xl font-black text-white tabular-nums">{rede.percentualExaustao}%</span>{' '}
            dos {rede.alunosMedidos} alunos medidos em {rede.turmasMedidas}{' '}
            {rede.turmasMedidas === 1 ? 'turma' : 'turmas'} estão em fadiga ou esgotamento{' '}
            {janela === 'hoje' ? 'hoje' : `nos últimos ${dias} dias`}.
          </p>
        </div>
      )}

      {carregando ? (
        <div className="space-y-3" aria-label="Carregando termômetro">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : erro ? (
        <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {erro}
        </p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-midnight-900/60 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-white">Sem leitura para esta janela</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
            {ocultas > 0
              ? `${ocultas} ${ocultas === 1 ? 'turma ficou' : 'turmas ficaram'} de fora por ter menos de ${AMOSTRA_MINIMA} alunos medidos. Com grupo pequeno, a porcentagem deixaria de ser anônima.`
              : 'Nenhuma turma tem índice de fadiga calculado no período. O índice aparece conforme os alunos estudam pelo app.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visiveis.map((t) => (
              <TurmaHeatCard key={t.turmaId} turma={t} janela={janela} escopo={escopo} />
            ))}
          </div>
          {ocultas > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <EyeOff size={12} />
              {ocultas} {ocultas === 1 ? 'turma oculta' : 'turmas ocultas'} por amostra menor que {AMOSTRA_MINIMA} alunos.
            </p>
          )}
        </>
      )}

      <p className="text-[11px] leading-relaxed text-slate-600">
        Leitura pedagógica, não diagnóstico clínico. Os números são agregados por turma e não
        identificam alunos. Se um estudante precisa de apoio individual, o caminho é a rede de
        acolhimento, não este painel.
      </p>
    </section>
  );
}
