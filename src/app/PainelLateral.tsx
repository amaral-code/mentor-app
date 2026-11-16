import { useMemo } from 'react';
import { ChevronRight, Flame, Target, Trophy, Users } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { TabId } from '../shared/types';

/*
 * Painel lateral do desktop (como a coluna da direita do Duolingo).
 *
 * Existe porque, no computador, as telas do aluno ficavam numa coluna
 * estreita cercada de branco: o celular enchia a tela, o PC parecia vazio.
 * Só lê o que já está no appStore; não busca nada no servidor, então abrir
 * uma aba não custa consulta extra.
 */

/* Dica fixa por aba: curta, sem traço (regra de escrita do produto). */
const DICAS: Partial<Record<TabId, string>> = {
  dashboard: 'Uma bolinha por vez. Terminar o plano do dia vale mais que maratonar.',
  quiz: 'Errou? Peça a explicação do tutor. É no erro que a matéria gruda.',
  profile: 'Entregue seu código só para quem você confia acompanhar seus estudos.',
  ranking: 'Cada quiz e cada tarefa concluída sobem o seu XP no ranking.',
  comunidade: 'Liga boa é liga ativa: bata a meta com a sua equipe.',
  estatisticas: 'A matéria com menos acerto é a que mais rende pontos agora.',
  calendario: 'Revisar no dia certo é metade do caminho para não esquecer.',
  essay: 'Treine a introdução: tema, tese e dois argumentos.',
  foco: 'Celular longe e 25 minutos de foco. Depois, pausa de verdade.',
  notebook: 'Anote com as suas palavras. Copiar não é aprender.',
  store: 'Junte XP estudando para liberar novos visuais do sagui.',
};

export function CartaoOfensiva() {
  const streak = useAppStore((s) => s.gamification.streak);
  const logs = useAppStore((s) => s.logs);
  /* Mesma conta do resumo da Central: dia com qualquer atividade acende. */
  const semana = useMemo(() => {
    const dias: { rotulo: string; ativo: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toDateString();
      dias.push({
        rotulo: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 1).toUpperCase(),
        ativo: logs.some((l) => new Date(l.timestamp).toDateString() === ds),
      });
    }
    return dias;
  }, [logs]);
  const acesa = streak >= 1;

  return (
    <section className="cartao p-5" aria-label="Ofensiva">
      <div className="flex items-center gap-3">
        <Flame size={44} className={acesa ? 'text-amber-500' : 'text-slate-300'} fill="currentColor" aria-hidden="true" />
        <div>
          <p className="text-3xl font-black text-tinta-900 leading-none tabular-nums">{streak}</p>
          <p className="text-sm font-extrabold text-slate-500">{streak === 1 ? 'dia de ofensiva' : 'dias de ofensiva'}</p>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-4">
        {semana.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center ${d.ativo ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
              <Flame size={16} fill="currentColor" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-extrabold text-slate-400">{d.rotulo}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CartaoMetaDoDia({ comBotao = true }: { comBotao?: boolean }) {
  /* Lê o plano e deriva fora do seletor: `s.dailyPlan?.tasks ?? []` criava
     uma lista nova a cada leitura quando ainda não há plano, e o React
     entrava em laço de render ("getSnapshot should be cached"). */
  const plano = useAppStore((s) => s.dailyPlan);
  const tarefas = plano?.tasks ?? [];
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const feitas = tarefas.filter((t) => t.completed).length;
  const pct = tarefas.length ? (feitas / tarefas.length) * 100 : 0;
  return (
    <section className="cartao p-5" aria-label="Meta do dia">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-extrabold text-tinta-900 flex items-center gap-2">
          <Target size={20} className="text-emerald-500" strokeWidth={2.5} /> Meta do dia
        </h2>
        <span className="text-sm font-black text-emerald-600 tabular-nums">{feitas}/{tarefas.length}</span>
      </div>
      <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 relative xp-bar" style={{ width: `${pct}%` }}>
          {pct > 8 && <span className="absolute left-2 right-2 top-1 h-1 rounded-full bg-white/35" aria-hidden="true" />}
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-500 mt-2">
        {tarefas.length === 0
          ? 'Diga como você está na Central e o sagui monta o plano.'
          : feitas === tarefas.length
            ? 'Plano do dia completo. Mandou bem!'
            : `Faltam ${tarefas.length - feitas} tarefa${tarefas.length - feitas === 1 ? '' : 's'} na trilha.`}
      </p>
      {comBotao && (
        <button type="button" onClick={() => setActiveTab('dashboard')} className="btn-secondary w-full h-11 mt-4 uppercase text-xs">
          Ir para a trilha
        </button>
      )}
    </section>
  );
}

export function CartaoLigas() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  return (
    <section className="cartao p-5" aria-label="Ligas">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <Trophy size={30} className="text-amber-500" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-tinta-900">Ligas e ranking</h2>
          <p className="text-xs font-semibold text-slate-500">Estude com a sua turma e suba de posição.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button type="button" onClick={() => setActiveTab('comunidade')} className="btn-secondary h-11 text-xs uppercase gap-1.5">
          <Users size={16} /> Ligas
        </button>
        <button type="button" onClick={() => setActiveTab('ranking')} className="btn-secondary h-11 text-xs uppercase gap-1.5">
          <Trophy size={16} /> Ranking
        </button>
      </div>
    </section>
  );
}

export function CartaoDicaSagui({ aba }: { aba: TabId }) {
  const dica = DICAS[aba] ?? DICAS.dashboard!;
  return (
    <section className="cartao p-4 flex items-end gap-2" aria-label="Dica do sagui">
      <img
        src="/assets/sagui_aprovacao_2.png"
        alt=""
        width={88}
        height={88}
        loading="lazy"
        className="w-20 h-20 object-contain shrink-0 motion-safe:animate-float-suave"
      />
      <div className="relative flex-1 rounded-2xl border-2 border-slate-200 bg-azul-50 px-3 py-2.5 mb-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-azul-600 mb-0.5">Dica do sagui</p>
        <p className="text-sm font-bold text-tinta-900 leading-snug">{dica}</p>
      </div>
    </section>
  );
}

/* Atalho de volta à Central quando a aba aberta é outra. */
function AtalhoCentral() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  return (
    <button
      type="button"
      onClick={() => setActiveTab('dashboard')}
      className="w-full flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-slate-400 hover:text-ceu-600 px-1"
    >
      Voltar para a Central <ChevronRight size={16} strokeWidth={3} />
    </button>
  );
}

export function PainelLateral({ aba }: { aba: TabId }) {
  return (
    <aside className="space-y-5 sticky top-8" aria-label="Seu dia">
      <CartaoOfensiva />
      <CartaoMetaDoDia />
      <CartaoLigas />
      <CartaoDicaSagui aba={aba} />
      <AtalhoCentral />
    </aside>
  );
}
