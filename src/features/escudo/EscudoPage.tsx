import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Lock, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';
import { useBemEstarStore } from '../../stores/bemEstarStore';
import { useAppStore } from '../../stores/appStore';
import {
  META_MINUTOS_MODO,
  MULTIPLICADOR_MODO,
  RECOMPENSAS,
  TETO_DIARIO_MOEDAS,
  calcularMoedas,
  faixaDe,
  moedasDeHoje,
  proximaFaixa,
  resumirSessoes,
} from '../../shared/lib/focusShield';
import type { ModoEscudo } from '../../shared/types';
import { EmptyState } from '../../shared/ui/EmptyState';

/**
 * ESCUDO DE DOPAMINA - tela do aluno.
 *
 * O QUE ESTA VERSAO WEB CONSEGUE MEDIR
 * O navegador nao ve a tela do aparelho; ele ve a ABA. O sinal
 * disponivel e o Page Visibility API: aba escondida (app em segundo
 * plano, tela apagada, outro app aberto) vale como "offline". Isso e
 * suficiente para o caso principal - trancar o celular e ir estudar no
 * papel - e mede errado um caso: trocar para o Instagram tambem esconde
 * a aba. Por isso o app pede que o Modo ENEM seja iniciado com o
 * aparelho de tela para baixo, e o modulo nativo em mobile/ (React
 * Native) resolve isso de verdade, lendo o estado real da tela.
 *
 * O CRONOMETRO NAO CONFIA EM setInterval
 * Em segundo plano o navegador reduz ou congela timers. Entao o tempo e
 * calculado por diferenca de timestamps a cada tick; o intervalo so
 * dispara o recalculo. E o servidor recalcula de novo no fim, porque
 * relogio de cliente e editavel.
 */

const MODOS: { id: ModoEscudo; nome: string; descricao: string }[] = [
  { id: 'leve', nome: 'Leve', descricao: '15 min longe da tela. Para comecar.' },
  { id: 'enem', nome: 'Modo ENEM', descricao: '25 min de bloco offline, como na prova.' },
  { id: 'maratona', nome: 'Maratona', descricao: '50 min ou mais. Multiplicador maior.' },
];

export function EscudoPage() {
  const { escudo, carteira, sessoesOffline, iniciarEscudo, encerrarEscudo, cancelarEscudo, registrarInterrupcao, atualizarCronometro, gastarMoedas, carregado, carregarTudo } =
    useBemEstarStore();
  const setToast = useAppStore((s) => s.setToast);
  const addLog = useAppStore((s) => s.addLog);

  const [modo, setModo] = useState<ModoEscudo>('enem');
  const [resultado, setResultado] = useState<{ moedas: number; minutos: number } | null>(null);
  const alertouSaida = useRef(false);

  useEffect(() => {
    if (!carregado) void carregarTudo();
  }, [carregado]);

  // Cronometro por diferenca de timestamp (ver comentario do topo).
  useEffect(() => {
    if (!escudo.ativo || !escudo.inicio) return;
    const tick = () => atualizarCronometro((Date.now() - escudo.inicio!) / 60000);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [escudo.ativo, escudo.inicio]);

  /**
   * Conta interrupcao quando a aba VOLTA a ficar visivel durante uma
   * sessao. Voltar nao encerra: encerrar no primeiro deslize faria o
   * aluno abandonar o recurso. Ele perde 10% por retorno e segue.
   */
  useEffect(() => {
    if (!escudo.ativo) return;
    // Ignora o 1º disparo: alguns browsers emitem visibilitychange na
    // ativação (aba já visible) e contavam interrupção fantasma.
    let primeiroEvento = true;
    const aoMudar = () => {
      if (primeiroEvento) { primeiroEvento = false; return; }
      if (document.visibilityState === 'visible') {
        registrarInterrupcao();
        if (!alertouSaida.current) {
          alertouSaida.current = true;
          setToast('Voce voltou ao app. A sessao continua, mas cada retorno reduz as moedas.', 'info');
        }
      }
    };

    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, [escudo.ativo]);

  const minutos = Math.floor(escudo.minutosDecorridos);
  const segundos = Math.floor((escudo.minutosDecorridos - minutos) * 60);
  const jaHoje = moedasDeHoje(sessoesOffline);

  const previa = useMemo(
    () => calcularMoedas(escudo.minutosDecorridos, escudo.interrupcoes, escudo.modo, jaHoje),
    [escudo.minutosDecorridos, escudo.interrupcoes, escudo.modo, jaHoje],
  );

  const resumo = useMemo(() => resumirSessoes(sessoesOffline), [sessoesOffline]);
  const meta = META_MINUTOS_MODO[escudo.ativo ? escudo.modo : modo];
  const progressoMeta = Math.min(100, (escudo.minutosDecorridos / meta) * 100);
  const proxima = proximaFaixa(minutos);

  async function comecar() {
    setResultado(null);
    alertouSaida.current = false;
    iniciarEscudo(modo);
    setToast('Escudo ativo. Bloqueie a tela e vire o aparelho para baixo.', 'success');
  }

  async function encerrar() {
    const r = await encerrarEscudo();
    if (!r) return;
    setResultado(r);

    if (r.moedas > 0) {
      addLog({
        timestamp: Date.now(),
        type: 'foco',
        description: `Escudo de dopamina: ${r.minutos} min offline (+${r.moedas} moedas)`,
        xp: Math.min(50, Math.round(r.minutos / 2)),
      });
      setToast(`+${r.moedas} moedas de foco por ${r.minutos} min offline.`, 'success');
    } else {
      setToast(`Sessao de ${r.minutos} min registrada. A partir de 5 min ja rende moedas.`, 'info');
    }
  }

  async function resgatar(id: string, custo: number, nome: string) {
    const ok = await gastarMoedas(custo, `Recompensa: ${nome}`);
    if (ok) setToast(`${nome} resgatado.`, 'success');
  }

  return (
    <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-600/10 flex items-center justify-center">
          <ShieldCheck size={20} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-white">Escudo de Dopamina</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ganhe moedas pelo tempo em que voce NAO olha a tela</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400">
          <Coins size={16} />
          <span className="font-bold tabular-nums">{carteira.saldo}</span>
        </div>
      </div>

      {/* Cronometro / seletor de modo */}
      <div className="glass rounded-2xl p-6 text-center">
        {!escudo.ativo ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModo(m.id)}
                  aria-pressed={modo === m.id}
                  className={`rounded-2xl px-3 py-3 text-left border transition-all ${
                    modo === m.id
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-white/[0.04] glass-light hover:border-white/[0.08]'
                  }`}
                >
                  <p className={`text-sm font-bold ${modo === m.id ? 'text-cyan-300' : 'text-white'}`}>{m.nome}</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-snug">{m.descricao}</p>
                  <p className="text-[10px] text-amber-400/80 mt-1.5 tabular-nums">
                    x{MULTIPLICADOR_MODO[m.id].toFixed(2)}
                  </p>
                </button>
              ))}
            </div>

            <button onClick={comecar} className="btn-primary px-8 py-3 text-base inline-flex items-center gap-2">
              <Lock size={18} /> Ativar escudo
            </button>

            <p className="text-xs text-gray-500 mt-4 leading-relaxed max-w-sm mx-auto">
              Ao ativar, bloqueie a tela e deixe o aparelho de lado. O app conta o tempo em segundo plano
              e converte em moedas de foco.
            </p>
          </>
        ) : (
          <>
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg className="w-48 h-48 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(progressoMeta / 100) * 326.7} 326.7`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-extrabold tabular-nums text-white tracking-tight">
                  {String(minutos).padStart(2, '0')}:{String(segundos).padStart(2, '0')}
                </span>
                <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">offline</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm mb-5">
              <span className="text-amber-400 font-bold tabular-nums">+{previa.moedas} moedas</span>
              <span className="w-1 h-1 rounded-full bg-gray-600" />
              <span className="text-gray-400">faixa: {faixaDe(minutos).rotulo}</span>
              {escudo.interrupcoes > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-600" />
                  <span className="text-red-400 flex items-center gap-1">
                    <TriangleAlert size={13} /> {escudo.interrupcoes} retorno(s)
                  </span>
                </>
              )}
            </div>

            {proxima && (
              <p className="text-xs text-gray-500 mb-4">
                Faltam {proxima.faltam} min para o multiplicador x{proxima.mult.toFixed(2)}.
              </p>
            )}

            <div className="flex items-center justify-center gap-3">
              <button onClick={encerrar} className="btn-primary px-6">
                Encerrar e receber
              </button>
              <button
                onClick={() => {
                  cancelarEscudo();
                  setToast('Sessao descartada.', 'info');
                }}
                className="btn-ghost text-sm text-gray-400 hover:text-red-400"
              >
                Descartar
              </button>
            </div>
          </>
        )}
      </div>

      {resultado && (
        <div className="glass rounded-2xl p-5 text-center border border-cyan-500/20 animate-fade-up">
          <p className="text-sm text-gray-300">
            Voce ficou <strong className="text-white">{resultado.minutos} min</strong> longe da tela e ganhou{' '}
            <strong className="text-amber-400">{resultado.moedas} moedas</strong>.
          </p>
          {jaHoje >= TETO_DIARIO_MOEDAS && (
            <p className="text-xs text-gray-500 mt-2">
              Voce chegou ao teto de {TETO_DIARIO_MOEDAS} moedas de hoje. As proximas sessoes continuam
              contando no historico.
            </p>
          )}
        </div>
      )}

      {/* Estatisticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { valor: resumo.sessoesHoje, rotulo: 'Sessoes hoje' },
          { valor: `${Math.floor(resumo.totalMinutos / 60)}h`, rotulo: 'Total offline' },
          { valor: `${resumo.melhorSessao}min`, rotulo: 'Melhor sessao' },
          { valor: carteira.totalGanho, rotulo: 'Moedas ganhas' },
        ].map((s) => (
          <div key={s.rotulo} className="glass rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-white tabular-nums">{s.valor}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{s.rotulo}</p>
          </div>
        ))}
      </div>

      {/* Loja de recompensas */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Trocar moedas de foco</h2>
        <p className="text-xs text-gray-500 mb-4">
          Recompensas de descanso - nada aqui e mais conteudo para estudar.
        </p>
        <div className="space-y-2">
          {RECOMPENSAS.map((r) => {
            const podeComprar = carteira.saldo >= r.custo;
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl glass-light border border-white/[0.03]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{r.nome}</p>
                  <p className="text-[11px] text-gray-500 leading-snug">{r.descricao}</p>
                </div>
                <button
                  onClick={() => resgatar(r.id, r.custo, r.nome)}
                  disabled={!podeComprar}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold tabular-nums ${
                    podeComprar
                      ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                      : 'bg-white/[0.03] text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {r.custo} moedas
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historico */}
      {sessoesOffline.length === 0 ? (
        <div className="glass rounded-2xl p-5">
          <EmptyState
            pose="meditando"
            compacto
            titulo="Nenhuma sessao offline ainda"
            descricao="Ative o escudo, tranque a tela e volte depois. O tempo longe vira moeda."
          />
        </div>
      ) : (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Smartphone size={16} className="text-cyan-400" /> Ultimas sessoes
          </h2>
          <div className="space-y-1.5">
            {sessoesOffline.slice(0, 8).map((s, i) => (
              <div key={s.id ?? i} className="flex items-center justify-between text-sm py-2 px-3 rounded-xl hover:bg-white/[0.02]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-cyan-400">-</span>
                  <span className="text-gray-400 truncate">
                    {new Date(s.inicio).toLocaleDateString('pt-BR')} - {s.modo}
                  </span>
                </div>
                <span className="text-gray-500 text-xs tabular-nums shrink-0">
                  {s.minutosOffline} min - +{s.moedasCreditadas}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-600 leading-relaxed px-4 py-3 glass-light rounded-xl">
        No navegador o escudo mede o tempo com o app em segundo plano. No aplicativo nativo (Android/iOS)
        ele le o estado real da tela bloqueada - o codigo esta em mobile/react-native.
      </p>
    </div>
  );
}
