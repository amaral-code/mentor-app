import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, type TargetAndTransition, type Transition } from 'motion/react';
import { Check, Lock, LogOut, Trophy, Zap } from 'lucide-react';
import type { MicroTask } from '@mentor/core/types';
import {
  QUADRO_ARVORE,
  XP_DA_TAREFA,
  centroDaToca,
  duracaoDaFase,
  formasDaArvore,
  montarFloresta,
  passosDaToca,
  podeComprovar,
  proximaFase,
  rotuloDaArvore,
  type Arvore,
  type Evento,
  type Fase,
  type Forma,
} from '@mentor/core/florestaDoDia';

/*
 * Floresta do dia: no lugar das bolinhas do Duolingo, uma árvore por
 * tarefa. O sagui sobe até a toca da árvore em que está; "Entrar" faz ele
 * entrar, e a toca abre por dentro com os passos da tarefa. A ordem das
 * fases e o desenho vêm de @mentor/core/florestaDoDia (o app nativo usa o
 * mesmo). XP continua saindo só da comprovação.
 */

function DesenhoArvore({ arvore, largura }: { arvore: Arvore; largura: number }) {
  const formas = useMemo(() => formasDaArvore(arvore), [arvore]);
  return (
    <svg
      viewBox={`0 0 ${QUADRO_ARVORE.largura} ${QUADRO_ARVORE.altura}`}
      width={largura}
      height={(largura * QUADRO_ARVORE.altura) / QUADRO_ARVORE.largura}
      aria-hidden="true"
      className="block overflow-visible"
    >
      {formas.map((f, i) => (
        <FormaSvg key={i} f={f} />
      ))}
    </svg>
  );
}

function FormaSvg({ f }: { f: Forma }) {
  if (f.forma === 'circulo') return <circle cx={f.cx} cy={f.cy} r={f.r} fill={f.cor} />;
  if (f.forma === 'elipse') return <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill={f.cor} />;
  return <path d={f.d} fill={f.cor} />;
}

/* ------------------------------------------------------------------ */

interface SaguiProps {
  fase: Fase;
  larguraArvore: number;
  alturaToca: number;
  reduzir: boolean;
  todasFeitas: boolean;
}

/**
 * O sagui no tronco. As posições saem do mesmo quadro do desenho, então
 * ele para exatamente ao lado da toca em qualquer tamanho de árvore.
 */
function SaguiNoTronco({ fase, larguraArvore, alturaToca, reduzir, todasFeitas }: SaguiProps) {
  const escala = larguraArvore / QUADRO_ARVORE.largura;
  const alturaArvore = QUADRO_ARVORE.altura * escala;
  const tamanho = Math.round(larguraArvore * 0.46);
  const toca = centroDaToca(alturaToca);
  const tocaX = toca.x * escala;
  const tocaY = toca.y * escala;

  // Na porta: ao lado do buraco, pendurado no tronco.
  const naPorta = { x: tocaX + 6, y: tocaY - tamanho * 0.62, scale: 1, opacity: 1, rotate: 0 };
  // No chão: pé da árvore, de onde a subida começa.
  const noChao = { x: tocaX + 6, y: alturaArvore - tamanho * 0.95, scale: 1, opacity: 1, rotate: 0 };
  // Dentro: encolhe para o centro da toca e some.
  const dentro = { x: tocaX - tamanho / 2, y: tocaY - tamanho / 2, scale: 0.12, opacity: 0, rotate: 0 };

  const segundos = (f: Fase) => duracaoDaFase(f, reduzir) / 1000;
  let animar: TargetAndTransition = naPorta;
  let transicao: Transition = { duration: 0 };
  let inicial: TargetAndTransition | false = false;

  if (todasFeitas) {
    animar = { ...naPorta, y: [naPorta.y, naPorta.y - 10, naPorta.y] };
    transicao = reduzir ? { duration: 0 } : { duration: 1.2, repeat: Infinity };
  } else if (fase === 'subindo') {
    inicial = noChao;
    // Três "puxadas" no tronco, com o corpo balançando a cada uma.
    const passo = (noChao.y - naPorta.y) / 3;
    animar = {
      ...naPorta,
      y: [noChao.y, noChao.y - passo, noChao.y - 2 * passo, naPorta.y],
      rotate: [0, -8, 8, 0],
    };
    transicao = { duration: segundos('subindo'), ease: 'easeOut' };
  } else if (fase === 'entrando' || fase === 'dentro') {
    animar = dentro;
    transicao = { duration: segundos('entrando'), ease: 'easeIn' };
  } else if (fase === 'saindo') {
    inicial = dentro;
    animar = naPorta;
    transicao = { duration: segundos('saindo'), ease: 'backOut' };
  }

  const pose = todasFeitas ? 'pulando' : fase === 'subindo' ? 'pulando' : 'acenando';
  return (
    <m.img
      key={`${fase}-${todasFeitas}`}
      src={`/assets/sagui_${pose}_2.png`}
      alt=""
      width={tamanho}
      height={tamanho}
      initial={inicial}
      animate={animar}
      transition={transicao}
      style={{ width: tamanho, height: tamanho, transformOrigin: '50% 50%' }}
      className="absolute left-0 top-0 object-contain pointer-events-none select-none drop-shadow-sm"
    />
  );
}

/* ------------------------------------------------------------------ */

interface TocaProps {
  arvore: Arvore;
  total: number;
  origem: { x: number; y: number };
  reduzir: boolean;
  onComprovar: (t: MicroTask) => void;
  onSair: () => void;
}

/**
 * Dentro da toca: abre num círculo que cresce a partir do buraco do
 * tronco. É um diálogo de verdade (foco, Esc, aria-modal), porque cobre a
 * tela inteira.
 */
function DentroDaToca({ arvore, total, origem, reduzir, onComprovar, onSair }: TocaProps) {
  const idTitulo = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(arvore.tarefa.completed ? ['entender', 'fazer'] : []));
  const passos = passosDaToca(arvore.tarefa);
  const feita = arvore.tarefa.completed;

  useEffect(() => {
    titulo.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSair();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onSair]);

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // Raio em px nas duas pontas: misturar unidades (0px e vmax) não anima.
  const raioFinal = typeof window !== 'undefined' ? Math.hypot(window.innerWidth, window.innerHeight) : 2000;
  const circulo = (r: number) => `circle(${r}px at ${origem.x}px ${origem.y}px)`;
  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitulo}
      className="fixed inset-0 z-40 overflow-y-auto"
      style={{ background: 'radial-gradient(circle at 50% 22%, #8A5530 0%, #5A341A 48%, #2E1B0E 100%)' }}
      initial={reduzir ? { opacity: 0 } : { clipPath: circulo(0) }}
      animate={reduzir ? { opacity: 1 } : { clipPath: circulo(raioFinal) }}
      exit={reduzir ? { opacity: 0 } : { clipPath: circulo(0) }}
      transition={{ duration: reduzir ? 0.15 : 0.55, ease: 'easeInOut' }}
    >
      {/* Raízes penduradas no teto da toca: só cenário. */}
      <svg aria-hidden="true" className="absolute inset-x-0 top-0 w-full h-20 pointer-events-none" viewBox="0 0 400 80" preserveAspectRatio="none">
        <path d="M30 0 Q34 40 22 70 M90 0 Q80 30 96 54 M170 0 Q176 26 162 46 M250 0 Q240 44 258 74 M330 0 Q336 30 320 52 M380 0 Q372 22 386 40" stroke="#3B2412" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>

      <div className="relative max-w-md mx-auto px-4 pt-10 pb-16 min-h-full flex flex-col">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">
              Toca da árvore {arvore.indice + 1} de {total}
            </p>
            <h2 id={idTitulo} ref={titulo} tabIndex={-1} className="text-2xl font-black text-white leading-tight mt-1 outline-none">
              {arvore.tarefa.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSair}
            className="shrink-0 flex items-center gap-1.5 h-11 px-3 rounded-xl border-2 border-amber-200/40 text-amber-50 font-extrabold text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-amber-300"
          >
            <LogOut size={16} /> Sair da toca
          </button>
        </div>

        <m.img
          src="/assets/sagui_estudando_2.png"
          alt=""
          width={120}
          height={120}
          className="w-28 h-28 object-contain mx-auto my-4 drop-shadow-lg"
          initial={reduzir ? false : { scale: 0.2, opacity: 0, y: -30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: reduzir ? 0 : 0.35, type: 'spring', stiffness: 260, damping: 18 }}
        />

        <ol className="space-y-3">
          {passos.map((p, i) => {
            const marcado = marcados.has(p.id) || (p.daXp && feita);
            const liberado = !p.daXp || podeComprovar(marcados);
            return (
              <m.li
                key={p.id}
                initial={reduzir ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduzir ? 0 : 0.45 + i * 0.12 }}
                className={`rounded-[20px] border-2 p-4 ${
                  marcado ? 'bg-emerald-50 border-emerald-600' : liberado ? 'bg-amber-50 border-amber-200' : 'bg-amber-50/70 border-amber-200/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black ${
                      marcado ? 'bg-emerald-700 text-white' : 'bg-amber-700 text-white'
                    }`}
                    aria-hidden="true"
                  >
                    {marcado ? <Check size={20} strokeWidth={3.5} /> : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-tinta-900">{p.titulo}</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-relaxed">{p.texto}</p>
                  </div>
                </div>
                {!p.daXp ? (
                  <button
                    type="button"
                    aria-pressed={marcados.has(p.id)}
                    onClick={() => alternar(p.id)}
                    disabled={feita}
                    className={`mt-3 w-full h-11 rounded-xl border-2 font-extrabold text-sm ${
                      marcados.has(p.id) ? 'border-emerald-700 text-emerald-800 bg-white' : 'border-amber-700 text-amber-900 bg-white hover:bg-amber-100'
                    } disabled:opacity-70`}
                  >
                    {marcados.has(p.id) ? 'Feito' : p.id === 'entender' ? 'Entendi' : 'Terminei'}
                  </button>
                ) : feita ? (
                  <p className="mt-3 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-emerald-700 text-white font-extrabold" role="status">
                    <Check size={18} strokeWidth={3} /> Tarefa concluída · +{XP_DA_TAREFA} XP
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onComprovar(arvore.tarefa)}
                      disabled={!liberado}
                      className="btn-ambar mt-3 w-full h-12 uppercase flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {liberado ? <Zap size={16} fill="currentColor" /> : <Lock size={16} />}
                      Comprovar e concluir · +{XP_DA_TAREFA} XP
                    </button>
                    {!liberado && <p className="mt-2 text-xs font-bold text-amber-900">Marque os dois passos de cima para liberar.</p>}
                  </>
                )}
              </m.li>
            );
          })}
        </ol>

        {feita && (
          <button type="button" onClick={onSair} className="btn-primary mt-5 w-full h-12 uppercase">
            Sair e ir para a próxima árvore
          </button>
        )}
      </div>
    </m.div>
  );
}

/* ------------------------------------------------------------------ */

export function FlorestaDoDia({
  tarefas,
  reduzir,
  xpVoando,
  onComprovar,
}: {
  tarefas: MicroTask[];
  reduzir: boolean;
  xpVoando: string | null;
  onComprovar: (t: MicroTask) => void;
}) {
  const floresta = useMemo(() => montarFloresta(tarefas), [tarefas]);
  const total = floresta.arvores.length;
  /* Árvore escolhida pelo toque; sem escolha, o sagui fica na primeira aberta. */
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const indiceSagui = escolhida !== null && floresta.arvores[escolhida] ? escolhida : floresta.indiceAtual >= 0 ? floresta.indiceAtual : total - 1;
  const [fase, setFase] = useState<Fase>('subindo');
  const disparar = useCallback((ev: Evento) => setFase((f) => proximaFase(f, ev)), []);
  const tocaRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [origem, setOrigem] = useState({ x: 0, y: 0 });

  const [largura, setLargura] = useState(() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 200 : 150));
  useEffect(() => {
    const medir = () => setLargura(window.innerWidth >= 1024 ? 200 : 150);
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // Trocou de árvore (tarefa concluída ou toque em outra): sobe de novo.
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    disparar('mudouDeArvore');
  }, [indiceSagui, disparar]);

  // Fases animadas terminam sozinhas, no tempo que o core manda.
  useEffect(() => {
    if (fase !== 'subindo' && fase !== 'entrando' && fase !== 'saindo') return;
    const t = window.setTimeout(() => disparar('fimDaAnimacao'), duracaoDaFase(fase, reduzir));
    return () => window.clearTimeout(t);
  }, [fase, reduzir, disparar]);

  // Saiu da toca de uma tarefa já feita: o sagui segue para a próxima árvore.
  useEffect(() => {
    if (fase === 'pronto' && escolhida !== null && floresta.arvores[escolhida]?.tarefa.completed) setEscolhida(null);
  }, [fase, escolhida, floresta]);

  function entrar(indice: number) {
    const el = tocaRefs.current[indice];
    if (el) {
      const r = el.getBoundingClientRect();
      setOrigem({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    if (indice !== indiceSagui) {
      setEscolhida(indice);
      return;
    }
    // Prende o sagui nesta árvore enquanto a toca estiver aberta: ao
    // comprovar, a "primeira tarefa aberta" passa a ser a seguinte, e sem a
    // trava a toca trocava de árvore com o aluno lá dentro.
    setEscolhida(indice);
    disparar('tocar');
  }

  const sair = useCallback(() => disparar('fechar'), [disparar]);
  const arvoreDoSagui = floresta.arvores[indiceSagui];
  const alturaArvore = (largura * QUADRO_ARVORE.altura) / QUADRO_ARVORE.largura;

  return (
    <div className="relative py-2">
      <ol className="relative max-w-md mx-auto flex flex-col gap-1">
        {floresta.arvores.map((a) => {
          const comSagui = a.indice === indiceSagui;
          const esquerda = a.lado === 'esquerda';
          const toca = centroDaToca(a.alturaToca);
          const escala = largura / QUADRO_ARVORE.largura;
          return (
            <li key={a.tarefa.id} className={`relative flex items-center gap-3 ${esquerda ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className="relative shrink-0" style={{ width: largura, height: alturaArvore }}>
                <button
                  type="button"
                  onClick={() => entrar(a.indice)}
                  disabled={a.estado === 'feita'}
                  aria-label={rotuloDaArvore(a, total)}
                  className="group block rounded-3xl focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ceu-600 disabled:cursor-default"
                >
                  <span className="block transition-transform duration-200 group-hover:-translate-y-1 group-disabled:translate-y-0">
                    <DesenhoArvore arvore={a} largura={largura} />
                  </span>
                </button>
                {/* Marcador invisível sobre a toca: de onde o círculo da toca abre. */}
                <span
                  ref={(el) => {
                    tocaRefs.current[a.indice] = el;
                  }}
                  aria-hidden="true"
                  className="absolute pointer-events-none"
                  style={{ left: toca.x * escala - 10, top: toca.y * escala - 10, width: 20, height: 20 }}
                />
                {comSagui && (
                  <SaguiNoTronco
                    fase={fase}
                    larguraArvore={largura}
                    alturaToca={a.alturaToca}
                    reduzir={reduzir}
                    todasFeitas={floresta.todasFeitas}
                  />
                )}
                {a.estado === 'feita' && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-1 w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow" aria-hidden="true">
                    <Check size={18} strokeWidth={3.5} />
                  </span>
                )}
                {xpVoando === a.tarefa.id && (
                  <span className="pointer-events-none absolute right-0 top-4 text-base font-black text-amber-600 motion-safe:animate-fade-up-out">
                    +{XP_DA_TAREFA} XP
                  </span>
                )}
              </div>

              <div className={`flex-1 min-w-0 ${esquerda ? 'text-left' : 'text-right'}`}>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Árvore {a.indice + 1}</p>
                <p className={`font-extrabold leading-tight ${a.estado === 'feita' ? 'text-slate-400 line-through' : 'text-tinta-900'}`}>{a.tarefa.titulo}</p>
                {comSagui && a.estado !== 'feita' && (
                  <button
                    type="button"
                    onClick={() => entrar(a.indice)}
                    className="btn-ambar mt-2 h-11 px-4 uppercase text-sm motion-safe:animate-float-suave"
                    aria-label={`Entrar na toca: ${a.tarefa.titulo}`}
                  >
                    Entrar na toca
                  </button>
                )}
              </div>
            </li>
          );
        })}

        <li className="flex flex-col items-center mt-4" aria-label={floresta.todasFeitas ? 'Plano do dia completo' : 'Fim da floresta de hoje'}>
          <span
            className={`w-[96px] h-[88px] rounded-[26px] flex items-center justify-center ${
              floresta.todasFeitas ? 'bg-amber-500 shadow-lip-ambar text-white' : 'bg-slate-200 shadow-lip text-slate-400'
            }`}
          >
            <Trophy size={44} strokeWidth={2.5} />
          </span>
          <span className={`mt-2 text-sm font-extrabold ${floresta.todasFeitas ? 'text-amber-600' : 'text-slate-500'}`}>
            {floresta.todasFeitas ? 'Plano do dia completo!' : 'Termine as árvores para fechar o dia'}
          </span>
        </li>
      </ol>

      <AnimatePresence>
        {fase === 'dentro' && arvoreDoSagui && (
          <DentroDaToca
            key={arvoreDoSagui.tarefa.id}
            arvore={arvoreDoSagui}
            total={total}
            origem={origem}
            reduzir={reduzir}
            onComprovar={onComprovar}
            onSair={sair}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
