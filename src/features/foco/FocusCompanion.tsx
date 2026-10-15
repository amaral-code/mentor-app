import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useStoreStore } from '../../stores/storeStore';
import { getStoreItem } from '../../shared/lib/storeCatalog';
import { AppIcon } from '../../shared/ui/AppIcon';
import { safeGet, safeSet } from '../../shared/lib/safeStorage';
import { ChevronDown, Eye, EyeOff, Minus, Pause, Play, Plus, Timer } from 'lucide-react';

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
  const addXP = useAppStore((s) => s.addXP);
  const addLog = useAppStore((s) => s.addLog);
  const setToast = useAppStore((s) => s.setToast);
  const activeTab = useAppStore((s) => s.activeTab);
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

  // Estaveis (useCallback vazio): o par add/removeEventListener do arrasto
  // EXIGE a mesma identidade de funcao. Como funcoes planas, cada render
  // criava novas — o remove no pointerup nunca removia o que o pointerdown
  // adicionou, e cada arrasto vazava 3 listeners na janela para sempre.
  const aoMoverArraste = useCallback((e: PointerEvent) => {
    const a = arrasteRef.current;
    if (!a) return;
    const dx = e.clientX - a.inicioX, dy = e.clientY - a.inicioY;
    if (!a.movendo && Math.hypot(dx, dy) < 7) return;
    a.movendo = true;
    setPos(limitar(a.baseX + dx, a.baseY + dy));
  }, []);

  const aoSoltarArraste = useCallback(() => {
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
  }, [aoMoverArraste]);

  // Rede de seguranca: desmontar no meio do arrasto (troca de aba) remove
  // os listeners da janela. Sem isso, o gesto seguinte herdava o estado.
  useEffect(() => {
    const soltar = () => { arrasteRef.current = null; };
    return () => {
      window.removeEventListener('pointermove', aoMoverArraste);
      window.removeEventListener('pointerup', aoSoltarArraste);
      window.removeEventListener('pointercancel', aoSoltarArraste);
      soltar();
    };
  }, [aoMoverArraste, aoSoltarArraste]);

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
      setToast(`+${CYCLE_XP} XP, ciclo completo! `, 'success');
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

  // Canto de baixo, à direita. A safe-area entra na conta para não
  // encostar na barra de gestos do iPhone. Se o aluno arrastou, vale a
  // posição dele (left/top); senão, a âncora padrão (right/bottom).
  const ancoraRef = useRef<HTMLDivElement>(null);
  /* No Mentor o canto de baixo é da caixa de texto: o botão parado ficava
     em cima do "enviar" no celular. Lá o Pomodoro já está no cabeçalho;
     só um ciclo em andamento continua visível, acima da caixa. */
  const noChat = activeTab === 'chat';
  if (noChat && phase === 'idle' && !open) return null;
  return (
    <div
      ref={ancoraRef}
      className={`fixed z-[80] w-[min(300px,calc(100vw-1.5rem))] pointer-events-none transition-opacity ${transparente ? 'opacity-40 hover:opacity-100 focus-within:opacity-100' : ''}`}
      style={pos
        ? { left: pos.x, top: pos.y }
        : { right: '0.75rem', bottom: noChat ? 'calc(10rem + env(safe-area-inset-bottom, 0px))' : 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto">
      {!open ? (
        /* Recolhido: um botão redondo de 48px. O cartão "Companhia de
           Foco 25:00" que ficava aqui ocupava 300px e cobria o canto de
           toda tela; parado, ele não tinha nada a dizer. Com um ciclo
           rodando, vira uma pílula com o tempo, que aí é informação. */
        <div className="ml-auto flex justify-end">
          <button
            onClick={() => setOpen(true)}
            onClickCapture={cliqueSeNaoArrastou}
            onPointerDown={(e) => aoIniciarArraste(e, ancoraRef.current)}
            className={`camada flex items-center gap-2 rounded-full h-12 cursor-grab active:cursor-grabbing touch-none select-none hover:border-gray-600 transition-colors ${
              phase === 'idle' ? 'w-12 justify-center' : 'pl-1.5 pr-4'
            }`}
            aria-label={phase === 'focus' ? `Ciclo de foco em andamento, faltam ${formatTime(seconds)}. Abrir` : 'Abrir o temporizador de foco (arraste para mover)'}
            title="Temporizador de foco"
          >
            {phase === 'idle' ? (
              <Timer size={20} className="text-gray-300" aria-hidden="true" />
            ) : (
              <>
                <img
                  src={phase === 'focus' ? resolvedSprite : SAGUI_REST}
                  alt=""
                  draggable={false}
                  onError={() => handleImgError(phase as 'focus' | 'rest')}
                  className="w-9 h-9 object-contain"
                />
                <span className={`font-mono text-sm font-medium tabular-nums ${phase === 'focus' ? 'text-white' : 'text-amber-400'}`}>
                  {phase === 'focus' ? formatTime(seconds) : 'Pausa'}
                </span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Painel expandido */
        <div className="camada rounded-2xl overflow-hidden animate-scale-in">
          {/* Header: arrasta para mover */}
          <div
            className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-linha cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={(e) => aoIniciarArraste(e, ancoraRef.current)}
          >
            <div className="flex items-center gap-2">
              <Timer size={15} className="text-gray-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">Temporizador de foco</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={alternarTransparente}
                onClickCapture={cliqueSeNaoArrastou}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-folha-2 transition-colors"
                aria-label={transparente ? 'Voltar ao normal' : 'Deixar transparente'}
                title={transparente ? 'Voltar ao normal' : 'Deixar transparente'}
              >
                {transparente ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={() => setMini(true)}
                onClickCapture={cliqueSeNaoArrastou}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-folha-2 transition-colors"
                aria-label="Diminuir painel"
                title="Diminuir"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={recolher}
                onClickCapture={cliqueSeNaoArrastou}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-folha-2 transition-colors"
                aria-label="Recolher"
                title="Recolher"
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {mini ? (
            /* Barrinha diminuída: só o tempo + play/pausa + aumentar */
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${phase === 'focus' ? 'bg-emerald-400' : 'bg-gray-500'}`} aria-hidden="true" />
              <span className="font-mono text-sm font-medium tabular-nums text-white">{formatTime(seconds)}</span>
              {phase === 'focus' ? (
                <button onClick={() => stopFocus(true)} onClickCapture={cliqueSeNaoArrastou} className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white" aria-label="Terminar o ciclo"><Pause size={15} /></button>
              ) : (
                <button onClick={startFocus} onClickCapture={cliqueSeNaoArrastou} className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white" aria-label="Iniciar ciclo de foco"><Play size={15} /></button>
              )}
              <button onClick={() => setMini(false)} onClickCapture={cliqueSeNaoArrastou} className="ml-auto w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white" aria-label="Aumentar painel" title="Aumentar"><Plus size={15} /></button>
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
                className={`w-28 h-28 object-contain transition-all duration-500 ${
                  phase === 'focus' ? 'mascot-anim-typing' : 'mascot-anim-idle'
                }`}
              />
              {equippedItem && (
                <span
                  key={equippedItem.id}
                  className="absolute -top-1 right-[18%] select-none"
                  title={`Acessório equipado: ${equippedItem.name}`}
                  aria-label={`Acessório equipado: ${equippedItem.name}`}
                >
                  <AppIcon name={equippedItem.icon} size={22} className="text-amber-300" />
                </span>
              )}
            </div>

            {/* Timer */}
            <div className="relative w-32 h-32 mx-auto mb-3">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#2c2a24" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={phase === 'focus' ? '#7cc78a' : phase === 'rest' ? '#e9a11c' : '#6a6458'}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(progresso / 100) * 326.7} 326.7`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-3xl font-medium tabular-nums text-white">{formatTime(seconds)}</span>
                <span className="text-xs text-gray-500 mt-0.5">
                  {phase === 'idle' && 'Pronto'}
                  {phase === 'focus' && 'Foco'}
                  {phase === 'rest' && 'Descanso'}
                </span>
              </div>
            </div>

            {/* Status e alerta amigável */}
            {phase === 'focus' ? (
              <p className="text-center text-sm text-gray-300 mb-3">O sagui estuda junto até o tempo acabar.</p>
            ) : showRestAlert ? (
              <p className="text-center text-sm text-amber-300 mb-3" role="status">Ciclo concluído. Agora, 5 minutos longe da tela.</p>
            ) : null}

            {/* Controles */}
            <div className="flex items-center justify-center gap-2.5">
              {phase === 'focus' ? (
                <button onClick={() => stopFocus(true)} className="btn-secondary flex-1">
                  <Pause size={15} aria-hidden="true" /> Terminar ciclo
                </button>
              ) : (
                <button onClick={startFocus} className="btn-primary flex-1">
                  <Play size={15} aria-hidden="true" /> Começar {FOCUS_MIN} minutos
                </button>
              )}
            </div>

            {phase === 'rest' && (
              <button
                onClick={() => { setShowRestAlert(false); startFocus(); }}
                className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Pular a pausa e começar outro ciclo
              </button>
            )}

            <p className="text-center text-xs text-gray-500 mt-3">
              +{CYCLE_XP} XP por ciclo completo.
            </p>
          </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}