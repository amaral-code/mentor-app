import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useStoreStore } from '../../stores/storeStore';
import { getStoreItem } from '../../shared/lib/storeCatalog';
import { AppIcon } from '../../shared/ui/AppIcon';
import { safeGet, safeSet } from '../../shared/lib/safeStorage';

const FOCUS_MIN = 25;
const CYCLE_XP = 5;

const SAGUI_FOCUS = '/assets/sagui_estudando_caderno_2.png';
const SAGUI_REST = '/assets/sagui_acenando_2.png';
const SAGUI_FOCUS_FALLBACK = '/assets/sagui_estudando_2.png';
const SAGUI_REST_FALLBACK = '/assets/sagui_meditando_2.png';

type Phase = 'idle' | 'focus' | 'rest';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusCompanion() {
  const { addXP, addLog, setToast } = useAppStore();
  const inventory = useStoreStore(s => s.inventory);
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(FOCUS_MIN * 60);
  const [showRestAlert, setShowRestAlert] = useState(false);
  const [imgErrored, setImgErrored] = useState<Record<string, boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Botão móvel + transparente (a pedido): arrasta para onde quiser e pode
     deixar fantasma. Posição e transparência salvas no aparelho. */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = safeGet('mm_foco_pos');
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (typeof p?.x === 'number' && typeof p?.y === 'number') return { x: p.x, y: p.y };
    } catch { /* valor antigo inválido: volta ao lugar padrão */ }
    return null;
  });
  const [transparente, setTransparente] = useState(() => safeGet('mm_foco_transparente') === '1');
  const arrasteRef = useRef<{ inicioX: number; inicioY: number; baseX: number; baseY: number; movendo: boolean } | null>(null);
  // Instante do fim do último arrasto: o clique que o navegador dispara logo
  // após soltar é ignorado (era um arrasto, não um toque). Com tempo em vez
  // de flag porque flag ficava presa quando o clique caía fora de um botão
  // e o TOQUE SEGUINTE era comido — o "botão não funciona" intermitente.
  const ultimoArrasteFimRef = useRef(0);

  function alternarTransparente() {
    setTransparente((v) => {
      safeSet('mm_foco_transparente', v ? '0' : '1');
      return !v;
    });
  }

  function limitar(x: number, y: number) {
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, vw - 88)),
      y: Math.min(Math.max(8, y), Math.max(8, vh - 88)),
    };
  }

  function aoIniciarArraste(e: React.PointerEvent, ancora: HTMLElement | null) {
    // Só botão esquerdo/toque. Sem setPointerCapture de propósito: capturar
    // o ponteiro no container roubava o clique dos botões de dentro (−, 👁, ▾).
    // Os movimentos são ouvidos na janela e o clique continua no botão.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = ancora?.getBoundingClientRect();
    const base = pos ?? (r ? { x: r.left, y: r.top } : { x: window.innerWidth - 88, y: window.innerHeight - 88 });
    arrasteRef.current = { inicioX: e.clientX, inicioY: e.clientY, baseX: base.x, baseY: base.y, movendo: false };
    window.addEventListener('pointermove', aoMoverArraste);
    window.addEventListener('pointerup', aoSoltarArraste);
    window.addEventListener('pointercancel', aoSoltarArraste);
  }

  function aoMoverArraste(e: PointerEvent) {
    const a = arrasteRef.current;
    if (!a) return;
    const dx = e.clientX - a.inicioX, dy = e.clientY - a.inicioY;
    if (!a.movendo && Math.hypot(dx, dy) < 7) return;
    a.movendo = true;
    setPos(limitar(a.baseX + dx, a.baseY + dy));
  }

  function aoSoltarArraste() {
    window.removeEventListener('pointermove', aoMoverArraste);
    window.removeEventListener('pointerup', aoSoltarArraste);
    window.removeEventListener('pointercancel', aoSoltarArraste);
    const a = arrasteRef.current;
    arrasteRef.current = null;
    if (a?.movendo) {
      ultimoArrasteFimRef.current = Date.now();
      setPos((p) => {
        if (p) safeSet('mm_foco_pos', JSON.stringify(p));
        return p;
      });
    }
  }

  function cliqueSeNaoArrastou(e: React.SyntheticEvent) {
    if (Date.now() - ultimoArrasteFimRef.current < 300) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  // Reseta o flag de erro a cada troca de fase, garantindo a re-tentativa do asset oficial
  useEffect(() => {
    setImgErrored(null);
  }, [phase]);

  const handleImgError = (key: 'focus' | 'rest') => {
    setImgErrored(prev => ({ ...(prev ?? {}), [key]: true }));
  };

  const sprite = phase === 'focus' ? SAGUI_FOCUS : SAGUI_REST;
  const spriteAlt = phase === 'focus' ? SAGUI_FOCUS_FALLBACK : SAGUI_REST_FALLBACK;
  const resolvedSprite = imgErrored?.[phase] ? spriteAlt : sprite;

  // Item equipado na Loja -> acessório exibido junto ao Sagui
  const equippedId = Object.entries(inventory).find(([, v]) => v.purchased && v.equipped)?.[0] ?? null;
  const equippedItem = equippedId ? getStoreItem(equippedId) : null;

  // Timer (1s)
  useEffect(() => {
    if (phase !== 'focus') return;
    timerRef.current = setInterval(() => {
      setSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // Ciclo chega a zero
  useEffect(() => {
    if (phase === 'focus' && seconds === 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setPhase('rest');
      setShowRestAlert(true);
      addXP(CYCLE_XP);
      addLog({ timestamp: Date.now(), type: 'foco', description: `Ciclo de foco completo na Companhia (${FOCUS_MIN}min)`, xp: CYCLE_XP });
      setToast(`+${CYCLE_XP} XP - ciclo completo! `, 'success');
    }
  }, [phase, seconds, addXP, addLog, setToast]);

  function recolher() {
    setOpen(false);
    setMini(false);
  }

  function startFocus() {
    setShowRestAlert(false);
    setSeconds(FOCUS_MIN * 60);
    setPhase('focus');
  }

  function stopFocus(rest: boolean) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setShowRestAlert(rest);
    setPhase('rest');
    if (rest) setToast('Hora de descansar a mente e recuperar as energias ', 'info');
  }

  // Em descanso o anel mostra 100% (concluído); antes travava num valor
  // intermediário porque `seconds` é zerado ao fim do foco.
  const progresso = phase === 'idle' ? 0 : phase === 'rest' ? 100 : ((FOCUS_MIN * 60 - seconds) / (FOCUS_MIN * 60)) * 100;

  // Fica logo acima da bottom nav, nao no meio da tela: em 375px o card
  // cobria o controle de Cansaco do Dashboard. A safe-area entra na conta
  // para nao encostar na barra de gestos do iPhone. Se o aluno arrastou,
  // vale a posição dele (left/top); senão, a âncora padrão (right/bottom).
  const ancoraRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ancoraRef}
      className={`fixed z-[80] w-[min(300px,calc(100vw-1.5rem))] pointer-events-none transition-opacity ${transparente ? 'opacity-40 hover:opacity-100 focus-within:opacity-100' : ''}`}
      style={pos
        ? { left: pos.x, top: pos.y }
        : { right: '0.75rem', bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto">
      {!open ? (
        /* FAB colapsado: arrasta para mover; botão ao lado deixa fantasma */
        <div className="ml-auto flex items-center justify-end gap-1.5">
          <button
            onClick={alternarTransparente}
            onClickCapture={cliqueSeNaoArrastou}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl glass border border-white/10 text-gray-400 hover:text-white transition-all"
            aria-label={transparente ? 'Voltar ao normal' : 'Deixar transparente'}
            title={transparente ? 'Voltar ao normal' : 'Deixar transparente'}
          >
            {transparente ? '👁' : '👁‍🗨'}
          </button>
          <button
            onClick={() => setOpen(true)}
            onClickCapture={cliqueSeNaoArrastou}
            onPointerDown={(e) => aoIniciarArraste(e, ancoraRef.current)}
            className="flex items-center gap-2.5 glass rounded-2xl border border-emerald-500/15 hover:border-emerald-500/30 px-3 py-2.5 transition-all group cursor-grab active:cursor-grabbing touch-none select-none"
            aria-label="Abrir Companhia de Foco (arraste para mover)"
          >
          <span className="relative shrink-0">
            <img
              src={phase === 'focus' ? resolvedSprite : SAGUI_REST}
              alt="Sagui companheiro"
              draggable={false}
              onError={() => handleImgError(phase as 'focus' | 'rest')}
              className="w-10 h-10 object-contain mascot-assist-idle"
            />
            {phase === 'focus' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0b1120]" />
            )}
          </span>
          <span className="text-left">
            <span className="block text-xs font-semibold text-white">
              {phase === 'focus' ? 'Estudando com você' : phase === 'rest' ? 'Hora de descansar' : 'Companhia de Foco'}
            </span>
            <span className="block text-[10px] text-emerald-400 tabular-nums font-medium">{formatTime(seconds)}</span>
          </span>
          </button>
        </div>
      ) : (
        /* Painel expandido */
        <div className="glass rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
          {/* Header: arrasta para mover */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.03] cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={(e) => aoIniciarArraste(e, ancoraRef.current)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">⏱</span>
              <p className="text-sm font-bold text-white">Companhia de Foco</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={alternarTransparente}
                onClickCapture={cliqueSeNaoArrastou}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label={transparente ? 'Voltar ao normal' : 'Deixar transparente'}
                title={transparente ? 'Voltar ao normal' : 'Deixar transparente'}
              >
                {transparente ? '👁' : '👁‍🗨'}
              </button>
              <button
                onClick={() => setMini(true)}
                onClickCapture={cliqueSeNaoArrastou}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all text-lg font-bold"
                aria-label="Diminuir painel"
                title="Diminuir"
              >
                −
              </button>
              <button
                onClick={recolher}
                onClickCapture={cliqueSeNaoArrastou}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Recolher"
              >
                ▾
              </button>
            </div>
          </div>

          {mini ? (
            /* Barrinha diminuída: só o tempo + play/pausa + aumentar */
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${phase === 'focus' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm font-extrabold tabular-nums text-white">{formatTime(seconds)}</span>
              {phase === 'focus' ? (
                <button onClick={() => stopFocus(true)} onClickCapture={cliqueSeNaoArrastou} className="text-xs text-gray-400 hover:text-white px-1" aria-label="Pausar">⏸</button>
              ) : (
                <button onClick={startFocus} onClickCapture={cliqueSeNaoArrastou} className="text-xs text-gray-400 hover:text-white px-1" aria-label="Iniciar">▶</button>
              )}
              <button onClick={() => setMini(false)} onClickCapture={cliqueSeNaoArrastou} className="ml-auto text-gray-400 hover:text-white px-1.5 text-sm font-bold" aria-label="Aumentar painel" title="Aumentar">+</button>
            </div>
          ) : (
          <div className="p-4">
            {/* Sagui + acessório equipado */}
            <div className="relative flex justify-center mt-1 mb-3">
              <img
                src={resolvedSprite}
                alt={phase === 'focus' ? 'Sagui estudando junto com você' : 'Sagui meditando para descansar'}
                draggable={false}
                onError={() => handleImgError(phase as 'focus' | 'rest')}
                className={`w-28 h-28 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] transition-all duration-500 ${
                  phase === 'focus' ? 'mascot-anim-typing' : 'mascot-anim-idle'
                }`}
              />
              {equippedItem && (
                <span
                  key={equippedItem.id}
                  className="absolute -top-1 right-[18%] text-2xl select-none drop-shadow-lg animate-bounce"
                  title={`Acessório equipado: ${equippedItem.name}`}
                  aria-label={`Acessório equipado: ${equippedItem.name}`}
                >
                  <AppIcon name={equippedItem.icon} size={22} className="text-amber-300" />
                </span>
              )}
              <span className={`absolute bottom-2 left-[18%] text-[9px] font-bold px-2 py-0.5 rounded-full ${
                phase === 'focus' ? 'bg-emerald-500/90 text-emerald-950' : 'bg-violet-500/20 text-violet-300 border border-violet-500/25'
              }`}>
                {phase === 'focus' ? ' FOCADO' : phase === 'rest' ? ' DESCANSO' : ' PRONTO'}
              </span>
            </div>

            {/* Timer */}
            <div className="relative w-32 h-32 mx-auto mb-3">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={phase === 'focus' ? '#10b981' : phase === 'rest' ? '#f59e0b' : '#475569'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(progresso / 100) * 326.7} 326.7`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold tabular-nums text-white tracking-tight">{formatTime(seconds)}</span>
                <span className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">
                  {phase === 'idle' && 'Pronto'}
                  {phase === 'focus' && 'Foco'}
                  {phase === 'rest' && 'Descanso'}
                </span>
              </div>
            </div>

            {/* Status e alerta amigável */}
            {phase === 'focus' ? (
              <p className="text-center text-xs text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/15 rounded-xl px-3 py-2.5 mb-3"> O Sagui está estudando junto com você. Continue firme!
              </p>
            ) : showRestAlert ? (
              <p className="text-center text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/15 rounded-xl px-3 py-2.5 mb-3 animate-fade-up"> Ciclo concluído! Hora de descansar a mente e recuperar as energias. Aproveite 5 minutinhos longe da tela.
              </p>
            ) : null}

            {/* Controles */}
            <div className="flex items-center justify-center gap-2.5">
              {phase === 'focus' ? (
                <button onClick={() => stopFocus(true)} className="btn-secondary !px-4 !py-2.5 text-sm flex-1">
                  ⏸ Terminar Ciclo
                </button>
              ) : (
                <button onClick={startFocus} className="btn-primary flex-1 !py-2.5 text-sm">
                  ▶ Iniciar Foco ({FOCUS_MIN} min)
                </button>
              )}
            </div>

            {phase === 'rest' && (
              <button
                onClick={() => { setShowRestAlert(false); startFocus(); }}
                className="w-full mt-2 text-xs text-gray-500 hover:text-amber-300 transition-colors"
              > Sentiram falta do companheiro? Voltar a estudar 
              </button>
            )}

            <p className="text-center text-[10px] text-gray-600 mt-3">
              +{CYCLE_XP} XP por ciclo completo · Tutor IA recomenda pausas breves para fixar o conteúdo.
            </p>
          </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}