import { memo, useCallback, useState } from 'react';
import { DoorOpen, MessageSquareOff, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { EmptyState } from '../../shared/ui/EmptyState';
import {
  colegasNaSala,
  formatarCronometro,
  formatarTempoFoco,
  iniciaisDeSala,
  resumoSala,
  rotuloMateria,
  totalColegas,
  type PresencaSala,
} from '../../shared/lib/salaFoco';
import { useSalaFoco } from './useSalaFoco';

/** Materias sugeridas na entrada — digitar antes de estudar ja e atrito. */
const MATERIAS = [
  'Matemática',
  'Redação',
  'Linguagens',
  'Humanas',
  'Natureza',
  'Revisão geral',
] as const;

/* Cartao de uma pessoa. Memorizado: a lista recarrega a cada 20s e o
   cronometro local bate a cada 1s — sem memo, cada segundo re-renderizava
   a sala inteira. */
const CartaoPresenca = memo(function CartaoPresenca({ pessoa }: { pessoa: PresencaSala }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
        pessoa.ehVoce
          ? 'border-violet-500/35 bg-violet-500/[0.07]'
          : 'border-white/[0.07] bg-white/[0.02]'
      }`}
    >
      <span className="relative shrink-0">
        {pessoa.avatarUrl ? (
          <img
            src={pessoa.avatarUrl}
            alt=""
            loading="lazy"
            className="h-11 w-11 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-midnight-700/80 text-sm font-bold text-slate-300">
            {iniciaisDeSala(pessoa.nome)}
          </span>
        )}
        {/* Verde discreto: "presente", nao "online para conversar". */}
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-midnight-900 bg-emerald-500"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {pessoa.nome}
          {pessoa.ehVoce && <span className="ml-1.5 text-[10px] font-bold text-violet-300">VOCÊ</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{rotuloMateria(pessoa.materia)}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-emerald-300 tabular-nums">
        {formatarTempoFoco(pessoa.minutosFoco)}
      </span>
    </li>
  );
});

/**
 * SALA DE FOCO — body doubling assincrono.
 *
 * Ver alguem estudando sustenta o proprio estudo: e o efeito de
 * biblioteca, trazido para quem estuda sozinho as 22h. A sala mostra
 * quem da sua escola esta focando agora, em que materia e ha quanto
 * tempo — e para por aí.
 *
 * SEM CHAT, POR DESENHO. Nao ha campo de texto, reacao, cutucada ou
 * notificacao para colega: transformar a sala em rede social seria
 * devolver a distracao pela porta dos fundos.
 */
export function SalaFocoPage() {
  const setToast = useAppStore((s) => s.setToast);
  const [materia, setMateria] = useState<string>(MATERIAS[0]);
  const { presencas, dentro, entrando, carregando, segundosFoco, entrar, sair } = useSalaFoco();

  /* Sem useMemo de proposito: o filtro depende de Date.now(), entao uma
     memo com `agora` nas deps recalcularia a cada render do mesmo jeito —
     so que fingindo economia. A lista tem dezenas de itens, e o custo
     real esta nos cartoes, que sao memorizados. */
  const agora = Date.now();
  const lista = colegasNaSala(presencas, agora);
  const colegas = totalColegas(presencas, agora);

  const aoEntrar = useCallback(async () => {
    try {
      await entrar(materia);
      setToast('Você entrou na Sala de Foco. Bom estudo, em silêncio.', 'success');
    } catch {
      setToast('Não foi possível entrar na sala agora. Verifique sua conexão.', 'error');
    }
  }, [entrar, materia, setToast]);

  const aoSair = useCallback(async () => {
    await sair();
    setToast('Você saiu da Sala de Foco.', 'info');
  }, [sair, setToast]);

  return (
    <div className="mx-auto max-w-lg animate-fade-up space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-600/10">
          <Users size={20} className="text-violet-300" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white md:text-2xl">Sala de Foco</h1>
          <p className="mt-0.5 text-sm text-gray-500">Estude junto, em silêncio</p>
        </div>
      </div>

      {/* Estado da sala + entrada/saida. */}
      <div className="glass rounded-2xl p-5">
        <p className="text-sm leading-relaxed text-slate-300" aria-live="polite">
          {resumoSala(colegas, dentro)}
        </p>

        {dentro ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 rounded-xl bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Seu foco nesta sessão</p>
              <p className="text-lg font-bold text-white tabular-nums">{formatarCronometro(segundosFoco)}</p>
            </div>
            <button onClick={() => void aoSair()} className="btn-secondary min-h-[44px] px-5 text-sm">
              <DoorOpen size={16} className="mr-1.5 inline-block align-[-0.15em]" />
              Sair da sala
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="sala-materia" className="text-[10px] uppercase tracking-wider text-slate-500">
                O que você vai estudar
              </label>
              <select
                id="sala-materia"
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-midnight-850 px-3 py-3 text-sm text-white focus:border-violet-500/40 focus:outline-none"
              >
                {MATERIAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => void aoEntrar()}
              disabled={entrando}
              className="btn-primary min-h-[48px] w-full text-base disabled:opacity-60"
            >
              {entrando ? 'Entrando…' : 'Entrar na Sala de Foco'}
            </button>
          </div>
        )}
      </div>

      {/* Quem esta focando agora. */}
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">
          Focando agora <span className="text-gray-500 tabular-nums">({lista.length})</span>
        </h2>

        {carregando ? (
          <div className="space-y-2" aria-label="Carregando a sala">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : lista.length === 0 ? (
          <EmptyState
            pose="meditando"
            compacto
            titulo="Ninguém na sala ainda"
            descricao="Entre primeiro: quem chegar depois vê que você já está estudando, e fica."
          />
        ) : (
          <ul className="space-y-2">
            {lista.map((p) => (
              <CartaoPresenca key={`${p.nome}-${p.entrouEm}`} pessoa={p} />
            ))}
          </ul>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-xl glass-light px-4 py-3 text-xs leading-relaxed text-gray-500">
        <MessageSquareOff size={15} className="mt-0.5 shrink-0 text-gray-600" />
        A sala não tem chat, curtida nem cutucada, só presença. Você aparece apenas para colegas da
        sua escola, com o primeiro nome, e some da lista dois minutos depois de fechar o app.
      </p>
    </div>
  );
}
