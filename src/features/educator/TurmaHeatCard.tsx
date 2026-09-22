import { memo } from 'react';
import { AlarmClock, Gauge, Lightbulb, MoonStar, Timer } from 'lucide-react';
import {
  ROTULO_CALOR,
  nivelDeCalor,
  percentualAlerta,
  percentualExaustao,
  resumoTurma,
  sugerirIntervencao,
  type NivelCalor,
  type TurmaTermometro,
} from '../../shared/lib/termometroCognitivo';

/* Paleta do calor. Fica no componente (e nao na lib) porque classe do
   Tailwind e assunto de tela: a lib decide o NIVEL, a tela decide a cor. */
const CORES: Record<NivelCalor, { barra: string; texto: string; borda: string; chip: string }> = {
  calmo: {
    barra: 'from-emerald-500 to-emerald-400',
    texto: 'text-emerald-300',
    borda: 'border-emerald-500/25',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  },
  atencao: {
    barra: 'from-amber-500 to-yellow-400',
    texto: 'text-amber-300',
    borda: 'border-amber-500/25',
    chip: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  },
  alerta: {
    barra: 'from-orange-500 to-red-400',
    texto: 'text-orange-300',
    borda: 'border-orange-500/30',
    chip: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  },
  critico: {
    barra: 'from-red-600 to-rose-500',
    texto: 'text-red-300',
    borda: 'border-red-500/40',
    chip: 'bg-red-500/15 text-red-300 border-red-500/40',
  },
};

interface Props {
  turma: TurmaTermometro;
  janela: 'hoje' | 'semana';
}

/**
 * TERMOMETRO COGNITIVO — uma turma do mapa de calor.
 *
 * Memorizado: o painel recarrega a lista inteira a cada troca de janela,
 * e sem memo todos os cards re-renderizavam mesmo com os mesmos numeros.
 *
 * Nunca recebe (nem tem como exibir) aluno individual: o que chega aqui
 * e o agregado da RPC 022, que ja descartou turma pequena demais.
 */
export const TurmaHeatCard = memo(function TurmaHeatCard({ turma, janela }: Props) {
  const pct = percentualExaustao(turma);
  const pctAlerta = percentualAlerta(turma);
  const nivel = nivelDeCalor(pct);
  const cor = CORES[nivel];
  const intervencao = sugerirIntervencao(turma);

  return (
    <article
      aria-label={`Termômetro da ${turma.turmaNome}`}
      className={`rounded-2xl border bg-midnight-900/80 p-5 backdrop-blur transition-colors ${cor.borda}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-white">{turma.turmaNome}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
            {turma.comIndice} de {turma.totalAlunos} alunos com índice na janela
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cor.chip}`}>
          {ROTULO_CALOR[nivel]}
        </span>
      </div>

      {/* Barra de calor: a leitura de 1 segundo do professor. */}
      <div className="mt-4 flex items-center gap-3">
        <span className={`text-3xl font-black tabular-nums ${cor.texto}`}>{pct}%</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            role="meter"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Percentual da turma em exaustão cognitiva"
            className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${cor.barra}`}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{resumoTurma(turma, janela)}</p>

      {/* Sinais que compoem o calor. */}
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <dt className="flex items-center gap-1 text-[10px] text-slate-500">
            <Gauge size={11} /> Índice médio
          </dt>
          <dd className="text-sm font-bold text-white tabular-nums">{turma.scoreMedio.toFixed(0)}/100</dd>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <dt className="flex items-center gap-1 text-[10px] text-slate-500">
            <Timer size={11} /> Foco contínuo
          </dt>
          <dd className="text-sm font-bold text-white tabular-nums">{Math.round(turma.minutosFocoMedio)} min</dd>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <dt className="flex items-center gap-1 text-[10px] text-slate-500">
            <AlarmClock size={11} /> Distrações
          </dt>
          <dd className="text-sm font-bold text-white tabular-nums">{turma.distracoesMedia.toFixed(1)}/sessão</dd>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <dt className="flex items-center gap-1 text-[10px] text-slate-500">
            <MoonStar size={11} /> Madrugada
          </dt>
          <dd className="text-sm font-bold text-white tabular-nums">{Math.round(turma.fracaoMadrugada * 100)}%</dd>
        </div>
      </dl>

      {pctAlerta > 0 && (
        <p className="mt-3 text-[11px] text-slate-500">
          Mais <span className="font-semibold text-slate-400 tabular-nums">{pctAlerta}%</span> em alerta.
          Ainda dá para evitar que virem exaustão.
        </p>
      )}

      {/* Intervencao pedagogica sugerida (a razao de o painel existir). */}
      <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
          <Lightbulb size={12} /> Intervenção sugerida
        </p>
        <p className="mt-1 text-sm font-semibold text-white">{intervencao.titulo}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{intervencao.acao}</p>
        <p className="mt-1.5 text-[11px] text-slate-500">Por quê: {intervencao.motivo}</p>
      </div>
    </article>
  );
});
