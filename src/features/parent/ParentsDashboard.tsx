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
import { Brain, TriangleAlert } from 'lucide-react';
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

const AMBER_LIGHT = '#f3b53f';
const EMERALD = '#7cc78a';
const GRID = 'rgba(255,255,255,0.05)';
const TICK = '#8a8376';

const barOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(28,26,22,0.97)', titleColor: '#f3efe6', bodyColor: '#ddd7cb', displayColors: false } },
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
      labels: { color: '#aaa395', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, font: { size: 11 } },
    },
    tooltip: { backgroundColor: 'rgba(28,26,22,0.97)', titleColor: '#f3efe6', bodyColor: '#ddd7cb' },
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
  gradient?: string;
  children?: ReactNode;
}

/* Um número com rótulo e explicação, sem caixa própria: os três ficam
   numa faixa única, separados por fio. O ícone em quadradinho colorido
   que cada um tinha repetia o rótulo. */
function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <div className="p-5">
      <p className="rotulo">{label}</p>
      <p className="numero text-[2rem] text-white mt-1">{value}</p>
      <p className="text-sm text-gray-500 mt-1 leading-snug">{sub}</p>
    </div>
  );
}

function ProjectionAlert({ projection }: { projection: DropoutProjection }) {
  if (projection.trend === 'rising') {
    return (
      <div className="border-l-2 border-emerald-400 pl-4" role="status">
        <p className="text-emerald-300 font-semibold text-[0.9375rem]">O acerto no app vem subindo</p>
        <p className="text-sm text-gray-300 mt-1 leading-relaxed">
          Se o ritmo continuar, a tendência é seguir assim nos próximos meses. Vale dizer ao estudante que você percebeu.
        </p>
      </div>
    );
  }

  if (projection.trend === 'falling') {
    const dropPct = projection.currentAverage > 0
      ? Math.max(0, Math.round(((projection.currentAverage - projection.projectedAverage) / projection.currentAverage) * 100))
      : 0;
    return (
      <div className="border-l-2 border-red-400 pl-4" role="alert">
        <p className="text-red-300 font-semibold text-[0.9375rem]">O acerto no app vem caindo</p>
        <p className="text-sm text-gray-300 mt-1 leading-relaxed">Se nada mudar, a média dos próximos 4 meses pode ficar <b>{dropPct}% abaixo</b> da média de hoje.
          O que costuma ajudar: conversar com o estudante sem cobrança, perguntar como está a rotina e, se
          fizer sentido, falar com a escola.
        </p>
        {/* "Inclinação" e "Ajuste R²" saíram: jargão de estatística para
            quem só quer saber se o filho vai bem. E R² de 100% com três
            pontos não quer dizer nada, mas soa como certeza absoluta. */}
        {/* O segundo número é a MÉDIA dos 4 meses projetados, e a tela
            dizia "em 4 meses": ao lado da linha mês a mês, que termina
            bem mais baixo, parecia que um dos dois estava errado. */}
        <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <div>
            <dt className="text-gray-500">Média de acerto hoje</dt>
            <dd className="font-mono text-white tabular-nums">{Math.round(projection.currentAverage)}%</dd>
          </div>
          <div>
            <dt className="text-gray-500">Média dos próximos 4 meses, se nada mudar</dt>
            <dd className="font-mono text-red-300 tabular-nums">{Math.round(projection.projectedAverage)}%</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="border-l-2 border-gray-500 pl-4" role="status">
      <p className="text-white font-semibold text-[0.9375rem]">O acerto no app está estável</p>
      <p className="text-sm text-gray-300 mt-1 leading-relaxed">
        Não há subida nem queda que chame atenção. Acompanhar de perto ajuda a perceber uma mudança cedo.
      </p>
    </div>
  );
}

const RISK_META = {
  green: {
    label: 'Seguro',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    chipBg: 'bg-emerald-500/10',
    sub: 'O acerto no app está estável ou subindo.',
    gradient: 'bg-emerald-500/[0.06]',
    icon: 'text-emerald-400',
  },
  yellow: {
    label: 'Atenção',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    chipBg: 'bg-amber-500/10',
    sub: 'O acerto no app começou a cair. Vale acompanhar a rotina.',
    gradient: 'bg-amber-500/[0.06]',
    icon: 'text-amber-400',
  },
  red: {
    label: 'Crítico',
    dot: 'bg-red-400',
    text: 'text-red-400',
    border: 'border-red-500/25',
    chipBg: 'bg-red-500/10',
    sub: 'O acerto no app caiu bastante nos últimos meses. Vale conversar esta semana.',
    gradient: 'bg-red-500/[0.06]',
    icon: 'text-red-400',
  },
} as const;

const AI_RISK = {
  Baixo: {
    icon: 'brilho',
    chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/10',
  },
  Médio: {
    icon: 'brilho',
    chip: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-500/10',
  },
  Alto: {
    icon: 'brilho',
    chip: 'bg-red-500/10 text-red-400 border-red-500/25',
    text: 'text-red-400',
    border: 'border-red-500/25',
    bg: 'bg-red-500/10',
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
        backgroundColor: 'rgba(233,161,28,0.85)',
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
        // Mes sem questao nenhuma e LACUNA, e nao "0% de acerto": o zero
        // desenhava uma queda que nao aconteceu.
        data: mensal.map(r => (r.questoes > 0 ? r.taxaAcerto : null)),
        spanGaps: false,
        borderColor: EMERALD,
        backgroundColor: 'rgba(124,199,138,0.06)',
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
          <h1 className="text-[1.75rem] md:text-[2rem] text-white">
            {ficha?.nome ?? aluno.nome}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {ficha?.escola && <>{ficha.escola}<span className="text-gray-600"> · </span></>}
            {/* Sem escola vinculada nao inventa turma: o estudante pode
                estar usando o app por conta propria. */}
            {ficha?.turma ? (
              <>{ficha.turma}<span className="text-gray-600"> · </span></>
            ) : null}
            Responsável: <span className="text-gray-400">{session?.nome || 'não informado'}</span>
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
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/25'
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
            <div key={i} className="painel rounded-2xl p-5 border border-white/5">
              <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
              <div className="h-8 w-20 rounded bg-white/5 animate-pulse mt-4" />
            </div>
          ))}
        </div>
      )}

      {/* Nunca estudou pelo app: a tela DIZ isso, em vez de desenhar
          graficos zerados que parecem queda de desempenho. */}
      {vazio && (
        <div className="painel rounded-2xl p-6 border border-white/5 text-center">
          <h2 className="text-lg font-bold text-white">Ainda não há atividade para mostrar</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed max-w-lg mx-auto">
            {ficha?.nome ?? aluno.nome} ainda não respondeu exercícios pelo app neste período.
            Os números aparecem sozinhos assim que os estudos começarem. Não há nada para
            configurar aqui.
          </p>
        </div>
      )}

      {/* ── Métricas rápidas ── */}
      <div className={`painel rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-linha ${vazio || carregando ? 'hidden' : ''}`}>
        <MetricCard
          label="Tempo de estudo"
          value={totalFocus >= 1 ? `${Math.round(totalFocus)}h` : `${totais.minutos}min`}
          sub={`Em ${totais.diasAtivos} dia(s) de estudo nos últimos ${period} meses.`}
        />

        <MetricCard
          label="Acerto nos exercícios"
          value={totais.questoes > 0 ? `${totais.taxaAcerto}%` : 'sem dados'}
          sub={
            totais.questoes > 0
              ? `${totais.acertos} acertos em ${totais.questoes} questões respondidas no app.`
              : 'Nenhuma questão respondida neste período.'
          }
        />

        {/* Status de Risco Atual -- so com historico que o sustente */}
        {!podeProjetar ? (
          <div className="p-5">
            <p className="rotulo">Risco de abandono</p>
            <p className="text-lg font-semibold text-gray-300 mt-2">Ainda não dá para dizer</p>
            <p className="text-sm text-gray-500 mt-1 leading-snug">
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
        <div className="p-5">
          <div>
            <p className="rotulo">Risco de abandono</p>
            <p className={`numero text-[2rem] mt-1 ${risk.text}`}>{risk.label}</p>
            <p className="text-sm text-gray-500 mt-1 leading-snug">{risk.sub}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-gray-500 font-mono tabular-nums shrink-0">{projection.riskScore} de 100</span>
              <span className="w-full h-1.5 rounded-full bg-folha-3 overflow-hidden">
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
        <div className="painel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Horas de estudo por semana</h3>
              <p className="text-sm text-gray-500 mt-0.5">Últimas 4 semanas, contando só o tempo dentro do app</p>
            </div>
          </div>
          <div className="relative h-56">
            <Bar data={frequencyData} options={barOptions} />
          </div>
        </div>

        <div className="painel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Acerto mês a mês</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Nos exercícios do app, últimos {period} meses.
                Não é boletim escolar: o app não recebe notas da escola.
              </p>
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
        <section>
          <h3 className="text-xl text-white font-display font-semibold">Por matéria</h3>
          <p className="text-sm text-gray-500 mt-1 mb-2 max-w-2xl">
            Últimos 3 meses, da matéria com mais dificuldade para a com menos.
            Matérias com poucas questões ficam de fora, porque pouca amostra assusta sem significar.
          </p>
          <ul className="pauta border-t border-linha">
            {materias.map((m) => (
              <li key={m.materia} className="py-3 grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-4">
                <span className="text-[0.9375rem] text-white truncate">{m.materia}</span>
                <div className="h-1.5 rounded-full bg-folha-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${m.taxaAcerto}%`,
                      background: m.taxaAcerto >= 70 ? '#7cc78a' : m.taxaAcerto >= 50 ? '#e9a11c' : '#f4a08a',
                    }}
                  />
                </div>
                <span className="text-right">
                  <span className="font-mono text-sm font-medium tabular-nums" style={{
                    color: m.taxaAcerto >= 70 ? '#7cc78a' : m.taxaAcerto >= 50 ? '#e9a11c' : '#f4a08a',
                  }}>
                    {m.taxaAcerto}%
                  </span>
                  <span className="block text-xs text-gray-500 tabular-nums">{m.acertos} de {m.questoes}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Projeção Cognitiva de 4 Meses ── */}
      {podeProjetar && (
      <div className="painel rounded-2xl p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-5">
          <div className="flex-1">
            <h3 className="text-xl text-white font-display font-semibold">Para onde está indo</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {aiState.status === 'ready'
                ? `Leitura da IA sobre ${records.length} meses de acerto no app e tempo de estudo.`
                : aiState.status === 'loading'
                  ? `Enviando ${records.length} meses de dados para a IA...`
                  : `Estimativa local sobre ${records.length} meses de acerto no app e tempo de estudo.`}
            </p>
          </div>

          {aiState.status === 'loading' ? (
            <span className="px-3 py-1.5 rounded-full text-[11px] font-bold border bg-tinta-500/10 text-tinta-300 border-tinta-500/25 self-start sm:self-auto animate-pulse whitespace-nowrap">
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
              {projection.trend === 'falling' ? 'Tendência de queda' : projection.trend === 'rising' ? 'Tendência de alta' : 'Estável'}
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
              <p className="text-xs font-semibold text-gray-400 mb-2">
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
                Recomendação gerada por IA sobre o uso do app. Não substitui a escola nem um profissional.
              </p>
              <button
                onClick={() => setAnalysisNonce(n => n + 1)}
                className="shrink-0 text-[11px] font-semibold text-tinta-300 hover:text-tinta-200 bg-tinta-500/10 border border-tinta-500/20 rounded-lg px-3 py-1.5 transition-all"
                title="Reexecutar a análise com a IA"
              > Reanalisar
              </button>
            </div>
          </div>
        ) : (
          /* Fallback: regressão linear local quando a IA não está disponível */
          <div className="space-y-4 animate-fade-up">
            <div className="text-sm text-gray-400 flex items-start gap-2">
              <TriangleAlert size={15} className="shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
              <span className="flex-1">
                {/* O texto antigo pedia para "ativar a chave no Perfil ou o
                    proxy serverless": recado de programador numa tela de
                    mãe, que nem tem chave no Perfil. */}
                {aiState.status === 'error'
                  ? 'A análise com inteligência artificial não respondeu agora. Mostrando a estimativa feita pelo próprio app.'
                  : 'Mostrando a estimativa feita pelo próprio app, a partir do histórico acima.'}
              </span>
              <button
                onClick={() => setAnalysisNonce(n => n + 1)}
                className="shrink-0 text-amber-300 hover:text-amber-200 font-medium underline underline-offset-4"
              >
                Tentar de novo
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Acerto projetado nos exercícios do app se o ritmo dos últimos meses continuar. É uma estimativa, não um destino.
            </p>

            {/* Projecao mes a mes (regressao local) */}
            <div className="grid grid-cols-4 rounded-md border border-linha divide-x divide-linha">
              {projection.projection.map((p, i) => {
                const prev = i === 0 ? projection.currentAverage : projection.projection[i - 1].notaMedia;
                const delta = p.notaMedia - prev;
                return (
                  <div key={p.month} className="px-2 py-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{rotuloMesCurto(p.month)}</p>
                    <p className={`numero text-xl ${
                      delta < -0.5 ? 'text-red-400' : delta > 0.5 ? 'text-emerald-400' : 'text-gray-300'
                    }`}>
                      {Math.max(0, Math.round(p.notaMedia))}%
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      delta < -0.5 ? 'text-red-400/80' : delta > 0.5 ? 'text-emerald-400/80' : 'text-gray-500'
                    }`}>
                      {delta < -0.5 ? `caindo` : delta > 0.5 ? `subindo` : 'estável'}
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