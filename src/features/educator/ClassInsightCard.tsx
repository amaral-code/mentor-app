import { Flame } from 'lucide-react';
import type { InsightTurma } from '../../shared/storage/SupabaseRepository';

interface Props {
  insight: InsightTurma;
  horas: number;
}

/**
 * EPICO 3: bloco de atencao do dashboard do educador.
 * Tipografia forte + numero em destaque, dark minimalista, sem graficos.
 * Nunca recebe (nem exibe) chat individual: so agregados da RPC.
 */
export function ClassInsightCard({ insight, horas }: Props) {
  const topico = insight.topico || insight.materia || 'Conteúdo geral';
  /* `taxaDificuldade` é a taxa de ERRO nas respostas, de 0 a 100 (020 e
     029). Não é "parte da turma": a frase antiga dizia "71% da turma
     (5 alunos)", misturando duas medidas. Agora cada uma tem o seu nome. */
  const taxaErro = Math.round(insight.taxaDificuldade);
  const critico = taxaErro >= 50;
  const n = insight.alunosComDificuldade;
  const total = insight.totalAlunos;

  return (
    <article
      aria-label={`Alerta sobre ${topico}`}
      className={`rounded-2xl border p-5 bg-midnight-900/80 backdrop-blur transition-colors ${
        critico ? 'border-red-500/30' : 'border-white/10 hover:border-amber-500/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            critico ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          <Flame size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {critico ? 'Retomar em aula' : 'Atenção'} · {insight.materia || 'Geral'}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            <span className="font-black text-white text-lg tabular-nums">
              {total > 0 ? `${n} de ${total}` : n}
            </span>{' '}
            {n === 1 ? 'aluno errou' : 'alunos erraram'} questões de{' '}
            <strong className="text-amber-300">{topico}</strong> nas últimas {horas} horas.
          </p>
          <p className="mt-2 text-[11px] text-slate-500 tabular-nums">
            Taxa de erro de <span className={critico ? 'text-red-300 font-semibold' : 'text-slate-300 font-semibold'}>{taxaErro}%</span>
            {' '}({insight.totalErros} de {insight.totalRespostas} respostas)
            {insight.perguntas24h > 0 ? ` · ${insight.perguntas24h} questões exibidas` : ''}
          </p>
        </div>
      </div>
    </article>
  );
}
