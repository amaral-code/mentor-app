import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { BarChart3, Brain, PartyPopper, TriangleAlert } from 'lucide-react';
import { AppIcon } from '../../shared/ui/AppIcon';

import { calculateDropoutRisk } from '../../shared/lib/dropoutRisk';
import type { DropoutProjection } from '../../shared/lib/dropoutRisk';
import { analyzeStudentData, aiAvailable } from '../../shared/lib/aiService';
import type { StudentRiskAnalysis } from '../../shared/lib/aiService';
import { useAppStore } from '../../stores/appStore';
import { acompanhamentoRepository } from '../../shared/storage/AcompanhamentoRepository';
import type { FichaAluno, MateriaResumo, ResumoMensal, ResumoSemanal } from '../../shared/storage/AcompanhamentoRepository';
import {
  dadosSuficientes,
  faltaParaTendencia,
  horasPorSemana,
  paraRegistrosMensais,
  rotuloMes,
  semAtividade,
  totaisDoPeriodo,
} from '../../shared/lib/acompanhamentoAluno';

type PeriodKey = 3 | 6 | 12;

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
  { value: 12, label: 'Últimos 12 meses' },
];

/** 'AAAA-MM' do motor de evasao -> 'Set'. */
const rotuloMesCurto = (mes: string) => rotuloMes(`${mes}-01`);

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const AMBER_LIGHT = '#fbbf24';
const EMERALD = '#10b981';
const GRID = 'rgba(255,255,255,0.05)';
const TICK = '#64748b';

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', displayColors: false } },
  scales: {
    x: { grid: { color: GRID }, ticks: { color: TICK, font: { size: 11 } } },
    y: { beginAtZero: true, grid: { color: GRID }, ticks: { color: TICK, font: { size: 11 }, stepSize: 4 }, title: { display: true, text: 'Horas', color: TICK, font: { size: 10 } } },
  },
};

const lineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11 } },
    },
    tooltip: { backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#f1f5f9', bodyColor: '#cbd5e1' },
  },
  scales: {
    x: { grid: { color: GRID }, ticks: { color: TICK, font: { size: 11 } } },
    // 0-100 fixo: a escala apertada de antes (40-90) transformava
    // variacao de 3 pontos em despenhadeiro visual.
    y: { min: 0, max: 100, grid: { color: GRID }, ticks: { color: TICK, font: { size: 11 } }, title: { display: true, text: 'Acerto (%)', color: TICK, font: { size: 10 } } },
  },
};

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  gradient: string;
  children: ReactNode;
}

function MetricCard({ label, value, sub, gradient, children }: MetricCardProps) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/5 group hover:border-white/[0.08] transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
          {children}
        </div>
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-extrabold text-white tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-1.5 leading-snug">{sub}</p>
    </div>
  );
}

function ProjectionAlert({ projection }: { projection: DropoutProjection }) {
  if (projection.trend === 'rising') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 animate-fade-up" role="status">
        <p className="flex items-center gap-2 text-emerald-400 font-bold text-sm"><PartyPopper size={16} className="inline-block align-[-0.15em] text-amber-400" /> Tendência de alta confirmada</p>
        <p className="text-sm text-emerald-200/80 mt-2 leading-relaxed"> Excelência! A projeção matemática aponta <b>evolução contínua</b> nas próximos 4 meses.
          O estudante está em uma trajetória de alta - mantenha o incentivo e o acompanhamento diário.
        </p>
      </div>
    );
  }

  if (projection.trend === 'falling') {
    const dropPct = projection.currentAverage > 0
      ? Math.max(0, Math.round(((projection.currentAverage - projection.projectedAverage) / projection.currentAverage) * 100))
      : 0;
    return (
      <div className="rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/10 to-transparent p-5 animate-fade-up" role="alert">
        <p className="flex items-center gap-2 text-red-400 font-bold text-sm"><TriangleAlert size={16} className="inline-block align-[-0.15em] text-amber-400" /> Tendência de queda detectada - intervenção recomendada</p>
        <p className="text-sm text-red-200/80 mt-2 leading-relaxed"> A projeção dos próximos 4 meses indica declínio no desempenho (queda estimada de até <b>{dropPct}%</b>).
          Recomenda-se: conversar com o estudante, alinhar com a escola, incentivar a rotina de estudos no app e
          monitorar presença no ensino noturno.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center">
          <div className="rounded-xl bg-black/30 py-2 px-1">
            <p className="text-[10px] text-gray-500">Nota atual</p>
            <p className="text-sm font-bold text-red-300 tabular-nums">{projection.currentAverage.toLocaleString('pt-BR')}</p>
          </div>
          <div className="rounded-xl bg-black/30 py-2 px-1">
            <p className="text-[10px] text-gray-500">Projeção (4m)</p>
            <p className="text-sm font-bold text-red-300 tabular-nums">{projection.projectedAverage.toLocaleString('pt-BR')}</p>
          </div>
          <div className="rounded-xl bg-black/30 py-2 px-1">
            <p className="text-[10px] text-gray-500">Inclinação</p>
            <p className="text-sm font-bold text-red-300 tabular-nums">{Math.abs(projection.slope).toFixed(2).replace('.', ',')} pts/mês</p>
          </div>
          <div className="rounded-xl bg-black/30 py-2 px-1">
            <p className="text-[10px] text-gray-500">Ajuste R²</p>
            <p className="text-sm font-bold text-red-300 tabular-nums">{(projection.r2 * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5 animate-fade-up" role="status">
      <p className="flex items-center gap-2 text-amber-400 font-bold text-sm"><BarChart3 size={16} className="inline-block align-[-0.15em] text-cyan-400" /> Tendência estável</p>
      <p className="text-sm text-amber-200/80 mt-2 leading-relaxed"> A projeção não aponta variação significativa. Mantenha o acompanhamento próximo para identificar mudanças cedo.
      </p>
    </div>
  );
}

const RISK_META = {
  green: {
    label: 'Seguro',
    dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    chipBg: 'bg-emerald-500/10',
    sub: 'Trajetória saudável. Continue monitorando semanalmente.',
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    icon: 'text-emerald-400',
  },
  yellow: {
    label: 'Atenção',
    dot: 'bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    chipBg: 'bg-amber-500/10',
    sub: 'Sinais de queda. Acompanhe presença e rotina de estudos.',
    gradient: 'from-amber-500/15 to-orange-600/5',
    icon: 'text-amber-400',
  },
  red: {
    label: 'Crítico',
    dot: 'bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.6)]',
    text: 'text-red-400',
    border: 'border-red-500/25',
    chipBg: 'bg-red-500/10',
    sub: 'Risco elevado de evasão. Intervenção urgente recomendada.',
    gradient: 'from-red-500/15 to-rose-600/5',
    icon: 'text-red-400',
  },
} as const;

const AI_RISK = {
  Baixo: {
    icon: 'brilho',
    chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-gradient-to-br from-emerald-500/10 to-transparent',
  },
  Médio: {
    icon: 'brilho',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-gradient-to-br from-amber-500/10 to-transparent',
  },
  Alto: {
    icon: 'brilho',
    chip: 'bg-red-500/10 text-red-400 border-red-500/25',
    text: 'text-red-400',
    border: 'border-red-500/25',
    bg: 'bg-gradient-to-br from-red-500/10 to-transparent',
  },
} as const;

interface Props {
  aluno: { id: string; nome: string };
}

export function ParentsDashboard({ aluno }: Props) {
  const session = useAppStore((s) => s.session);
  const apiKey = useAppStore((s) => s.apiKey);
  const [period, setPeriod] = useState<PeriodKey>(6);

  const [mensal, setMensal] = useState<ResumoMensal[]>([]);
  const [semanal, setSemanal] = useState<ResumoSemanal[]>([]);
  const [materias, setMaterias] = useState<MateriaResumo[]>([]);
  const [ficha, setFicha] = useState<FichaAluno | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    void Promise.all([
      acompanhamentoRepository.resumoMensal(aluno.id, period),
      acompanhamentoRepository.resumoSemanal(aluno.id, 4),
      acompanhamentoRepository.materias(aluno.id, 3),
      acompanhamentoRepository.ficha(aluno.id).catch(() => null),
    ])
      .then(([m, s, mat, f]) => {
        if (!vivo) return;
        setMensal(m);
        setSemanal(s);
        setMaterias(mat);
        setFicha(f);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [aluno.id, period]);

  const records = useMemo(() => paraRegistrosMensais(mensal), [mensal]);
  const totais = useMemo(() => totaisDoPeriodo(mensal), [mensal]);
  /* A projecao so existe com historico que a sustente. Regressao sobre
     tres pontos quase vazios devolve uma reta com inclinacao enorme e um
     "Alto risco" com cara de conclusao -- assustar um pai com estatistica
     de nada e pior que nao mostrar. */
  const podeProjetar = useMemo(() => dadosSuficientes(mensal), [mensal]);
  const projection = useMemo(() => calculateDropoutRisk(records), [records]);
  const totalFocus = totais.minutos / 60;
  const risk = RISK_META[projection.riskLevel];
  const vazio = !carregando && semAtividade(mensal);

  // Analise preditiva de evasao (regressao linear)
  const [aiState, setAiState] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    result?: StudentRiskAnalysis;
    error?: string;
  }>({ status: 'idle' });
  const [analysisNonce, setAnalysisNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    if (!aiAvailable(apiKey) || !podeProjetar) {
      setAiState({ status: 'idle' });
      return;
    }

    setAiState({ status: 'loading' });
    analyzeStudentData(records, { apiKey, signal: controller.signal })
      .then(result => setAiState({ status: 'ready', result }))
      .catch(err => {
        if (err?.name !== 'AbortError') {
          setAiState({ status: 'error', error: err?.message || 'Erro ao conectar com a IA' });
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, apiKey, analysisNonce, podeProjetar]);

  const semanas = horasPorSemana(semanal);

  const frequencyData: ChartData<'bar'> = {
    labels: semanas.map(w => w.rotulo),
    datasets: [
      {
        label: 'Horas estudadas',
        data: semanas.map(w => w.horas),
        backgroundColor: 'rgba(245,158,11,0.7)',
        hoverBackgroundColor: AMBER_LIGHT,
        borderRadius: 8,
        maxBarThickness: 40,
      },
    ],
  };

  /* Uma serie so, e ela e o acerto NO APP.
     A segunda linha do painel antigo se chamava "Desempenho Escolar" e
     nao tinha de onde vir: nenhuma tabela deste banco guarda boletim. */
  const evolutionData: ChartData<'line'> = {
    labels: mensal.map(r => rotuloMes(r.mes)),
    datasets: [
      {
        label: 'Acerto nos exercícios do app (%)',
        data: mensal.map(r => r.taxaAcerto),
        borderColor: EMERALD,
        backgroundColor: 'rgba(16,185,129,0.06)',
        pointBackgroundColor: EMERALD,
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6 animate-fade-up">
      {/* ── Cabeçalho: aluno + seletor de período ── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1">Painel do Responsável</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3 flex-wrap">
            {ficha?.nome ?? aluno.nome}
            {ficha?.escola && (
              <span className="px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-semibold border border-violet-500/20">
                {ficha.escola}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {/* Sem escola vinculada nao inventa turma: o estudante pode
                estar usando o app por conta propria. */}
            {ficha?.turma ? (
              <>{ficha.turma}<span className="text-gray-600"> · </span></>
            ) : null}
            Responsável: <span className="text-gray-400">{session?.nome || '-'}</span>
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-white/[0.04] border border-white/5 p-1 gap-1 self-start lg:self-auto" role="tablist" aria-label="Período de análise">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              role="tab"
              aria-selected={period === opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                period === opt.value
                  ? 'bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-300 border-amber-500/25 shadow-[0_0_16px_rgba(245,158,11,0.08)]'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {carregando && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl p-5 border border-white/5">
              <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
              <div className="h-8 w-20 rounded bg-white/5 animate-pulse mt-4" />
            </div>
          ))}
        </div>
      )}

      {/* Nunca estudou pelo app: a tela DIZ isso, em vez de desenhar
          graficos zerados que parecem queda de desempenho. */}
      {vazio && (
        <div className="glass rounded-2xl p-6 border border-white/5 text-center">
          <h2 className="text-lg font-bold text-white">Ainda não há atividade para mostrar</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed max-w-lg mx-auto">
            {ficha?.nome ?? aluno.nome} ainda não respondeu exercícios pelo app neste período.
            Os números aparecem sozinhos assim que os estudos começarem — não há nada para
            configurar aqui.
          </p>
        </div>
      )}

      {/* ── Métricas rápidas ── */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${vazio || carregando ? 'hidden' : ''}`}>
        <MetricCard
          label="Tempo de Foco Total"
          value={totalFocus >= 1 ? `${Math.round(totalFocus)}h` : `${totais.minutos}min`}
          sub={`Em ${totais.diasAtivos} dia(s) de estudo nos últimos ${period} meses.`}
          gradient="from-amber-500/15 to-orange-600/10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </MetricCard>

        <MetricCard
          label="Acerto nos Exercícios"
          value={totais.questoes > 0 ? `${totais.taxaAcerto}%` : '—'}
          sub={
            totais.questoes > 0
              ? `${totais.acertos} acertos em ${totais.questoes} questões respondidas no app.`
              : 'Nenhuma questão respondida neste período.'
          }
          gradient="from-emerald-500/15 to-cyan-600/10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </MetricCard>

        {/* Status de Risco Atual -- so com historico que o sustente */}
        {!podeProjetar ? (
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <BarChart3 size={18} className="text-gray-500" />
              </div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status de Risco</span>
            </div>
            <p className="text-xl font-extrabold text-gray-300">Ainda não dá para dizer</p>
            <p className="text-xs text-gray-500 mt-1.5 leading-snug">
              {(() => {
                const f = faltaParaTendencia(mensal);
                const partes = [];
                if (f.meses > 0) partes.push(`mais ${f.meses} mês(es) de uso`);
                if (f.questoes > 0) partes.push(`mais ${f.questoes} questões`);
                return partes.length
                  ? `Falta ${partes.join(' e ')} para a tendência significar alguma coisa.`
                  : 'Falta histórico para a tendência significar alguma coisa.';
              })()}
            </p>
          </div>
        ) : (
        <div className={`glass rounded-2xl p-5 border ${risk.border} transition-all relative overflow-hidden`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${risk.gradient} pointer-events-none`} />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${risk.chipBg} flex items-center justify-center`}>
                <span className={`w-2.5 h-2.5 rounded-full ${risk.dot} animate-pulse`} />
              </div>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status de Risco Atual</span>
            </div>
            <p className={`text-3xl font-extrabold tracking-tight ${risk.text}`}>{risk.label}</p>
            <p className="text-xs text-gray-500 mt-1.5 leading-snug">{risk.sub}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-gray-600 tabular-nums">Score: {projection.riskScore}/100</span>
              <span className={`w-full max-w-[45%] h-1.5 rounded-full bg-white/[0.06] overflow-hidden ml-3`}>
                <span
                  className={`block h-full rounded-full transition-all duration-700 ${
                    projection.riskLevel === 'red' ? 'bg-red-400' : projection.riskLevel === 'yellow' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${projection.riskScore}%` }}
                />
              </span>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ── Gráficos ── */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${vazio || carregando ? 'hidden' : ''}`}>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Frequência Semanal no App</h3>
              <p className="text-xs text-gray-500 mt-0.5">Horas por semana, nas últimas 4 semanas</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
          </div>
          <div className="relative h-56">
            <Bar data={frequencyData} options={barOptions} />
          </div>
        </div>

        <div className="glass rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Evolução no app</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Proporção de acerto nos exercícios do app, mês a mês ({period} meses).
                Não é boletim escolar — o app não recebe notas da escola.
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
          </div>
          <div className="relative h-56">
            <Line data={evolutionData} options={lineOptions} />
          </div>
        </div>
      </div>

      {/* ── Onde ele acerta e onde ele apanha ──
          Nome de materia e padrao, nao conteudo: dizer "matematica vai
          mal" nao entrega nenhuma resposta do estudante. E o dado que
          vira conversa ("quer ajuda em matematica?") em vez de cobranca. */}
      {materias.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h3 className="text-sm font-bold text-white">Por matéria</h3>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">
            Últimos 3 meses, da matéria com mais dificuldade para a com menos.
            Matérias com poucas questões ficam de fora — pouca amostra assusta sem significar.
          </p>
          <ul className="space-y-2">
            {materias.map((m) => (
              <li key={m.materia} className="glass-light rounded-xl px-3 py-2.5 border border-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white font-medium truncate">{m.materia}</span>
                  <span className="text-sm font-bold tabular-nums shrink-0" style={{
                    color: m.taxaAcerto >= 70 ? '#10b981' : m.taxaAcerto >= 50 ? '#f59e0b' : '#f87171',
                  }}>
                    {m.taxaAcerto}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${m.taxaAcerto}%`,
                      background: m.taxaAcerto >= 70 ? '#10b981' : m.taxaAcerto >= 50 ? '#f59e0b' : '#f87171',
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 tabular-nums">
                  {m.acertos} de {m.questoes} questões
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Projeção Cognitiva de 4 Meses ── */}
      {podeProjetar && (
      <div className="glass rounded-2xl p-6 border border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-600/10 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
              <path d="M12 2a4 4 0 0 0-4 4c0 2 2 3 2 5v1h4v-1c0-2 2-3 2-5a4 4 0 0 0-4-4z" />
              <path d="M8 17a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3" />
              <path d="M12 22v-2" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-white">Projeção de 4 meses</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {aiState.status === 'ready'
                ? `Leitura da IA sobre ${records.length} meses de acerto no app e tempo de estudo.`
                : aiState.status === 'loading'
                  ? `Enviando ${records.length} meses de dados para a IA...`
                  : `Estimativa local sobre ${records.length} meses de acerto no app e tempo de estudo.`}
            </p>
          </div>

          {aiState.status === 'loading' ? (
            <span className="px-3 py-1.5 rounded-full text-[11px] font-bold border bg-violet-500/10 text-violet-300 border-violet-500/25 self-start sm:self-auto animate-pulse whitespace-nowrap">
              <Brain size={12} className="inline mr-1 -mt-0.5" /> Calculando projeção...
            </span>
          ) : aiState.status === 'ready' && aiState.result ? (
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${AI_RISK[aiState.result.risk].chip} self-start sm:self-auto whitespace-nowrap`}>
              <AppIcon name={AI_RISK[aiState.result.risk].icon} size={12} className="inline mr-1 -mt-0.5" /> Risco: {aiState.result.risk}
            </span>
          ) : (
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold border self-start sm:self-auto whitespace-nowrap ${
              projection.trend === 'falling'
                ? 'bg-red-500/10 text-red-400 border-red-500/25'
                : projection.trend === 'rising'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
            }`}>
              {projection.trend === 'falling' ? ' Tendência de queda' : projection.trend === 'rising' ? ' Tendência de alta' : ' Estável'}
            </span>
          )}
        </div>

        {aiState.status === 'loading' ? (
          /* Estado de carregamento: Sagui analisando os dados */
          <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-up">
            <img loading="lazy"
              src="/assets/sagui_aprovacao_2.png"
              alt="Sagui analisando dados"
              draggable={false}
              className="w-24 h-24 object-contain mascot-anim-loading"
            />
            <p className="text-sm text-gray-300 mt-4 font-medium">O Sagui está analisando o desempenho...</p>
            <p className="text-xs text-gray-500 mt-1">Gerando previsão de risco de evasão para os próximos 4 meses.</p>
          </div>
        ) : aiState.status === 'ready' && aiState.result ? (
          /* Resultado da IA renderizado dinamicamente */
          <div className="animate-fade-up">
            <div className={`rounded-2xl border ${AI_RISK[aiState.result.risk].border} ${AI_RISK[aiState.result.risk].bg} p-6`}>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-2">
                Previsão de risco de evasão · próximos 4 meses
              </p>
              <p className={`text-4xl font-extrabold ${AI_RISK[aiState.result.risk].text}`}>
                {aiState.result.risk}
              </p>
              <p className="text-sm text-gray-300 mt-3 leading-relaxed">
                {aiState.result.recommendation}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-[10px] text-gray-500">
                Recomendação gerada por IA sobre o uso do app — não substitui a escola nem um profissional.
              </p>
              <button
                onClick={() => setAnalysisNonce(n => n + 1)}
                className="shrink-0 text-[11px] font-semibold text-violet-300 hover:text-violet-200 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-1.5 transition-all"
                title="Reexecutar a análise com a IA"
              > Reanalisar
              </button>
            </div>
          </div>
        ) : (
          /* Fallback: regressão linear local quando a IA não está disponível */
          <div className="space-y-4 animate-fade-up">
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 px-4 py-3 text-xs text-amber-300/90 flex items-start gap-2">
              <span><TriangleAlert size={16} className="inline-block align-[-0.15em] text-amber-400" /></span>
              <span className="flex-1">
                {aiState.status === 'error'
                  ? `Não foi possível conectar à IA (${aiState.error}). Exibindo estimativa local por regressão linear.`
                  : 'IA não configurada. Ative a chave no Perfil ou o proxy serverless para análises inteligentes. Exibindo estimativa local.'}
              </span>
              <button
                onClick={() => setAnalysisNonce(n => n + 1)}
                className="shrink-0 text-amber-300 hover:text-amber-200 font-semibold underline"
              > Tentar de novo
              </button>
            </div>

            <p className="text-[11px] text-gray-500">
              Acerto projetado nos exercícios do app, mês a mês (regressão sobre o histórico acima).
            </p>

            {/* Projecao mes a mes (regressao local) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {projection.projection.map((p, i) => {
                const prev = i === 0 ? projection.currentAverage : projection.projection[i - 1].notaMedia;
                const delta = p.notaMedia - prev;
                return (
                  <div key={p.month} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 text-center hover:border-white/10 transition-all">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">{rotuloMesCurto(p.month)}</p>
                    <p className={`text-2xl font-extrabold tabular-nums ${
                      delta < -0.5 ? 'text-red-400' : delta > 0.5 ? 'text-emerald-400' : 'text-gray-300'
                    }`}>
                      {p.notaMedia.toLocaleString('pt-BR')}
                    </p>
                    <p className={`text-[10px] mt-1 font-medium ${
                      delta < -0.5 ? 'text-red-500/70' : delta > 0.5 ? 'text-emerald-500/70' : 'text-gray-600'
                    }`}>
                      {delta < -0.5 ? `− ${Math.abs(delta).toFixed(1).replace('.', ',')}` : delta > 0.5 ? `+ ${delta.toFixed(1).replace('.', ',')}` : 'estável'}
                    </p>
                  </div>
                );
              })}
            </div>

            <ProjectionAlert projection={projection} />
          </div>
        )}
      </div>
      )}
    </div>
  );
}