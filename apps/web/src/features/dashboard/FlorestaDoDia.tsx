import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m, type TargetAndTransition, type Transition } from 'motion/react';
import { BadgeCheck, Check, ListChecks, LogOut, Play, Split, Star, Trophy, Zap } from 'lucide-react';
import type { MicroTask } from '@mentor/core/types';
import { acertoPorMateria } from '@mentor/core/painelAluno';
import { useAppStore } from '@mentor/state/appStore';
import {
  QUADRO_ARVORE,
  XP_DA_TAREFA,
  caminhoEntreArvores,
  centroDaToca,
  duracaoDaFase,
  formasDaArvore,
  montarFloresta,
  proximaFase,
  rotuloDaArvore,
  type Arvore,
  type Evento,
  type Fase,
  type Forma,
} from '@mentor/core/florestaDoDia';
import {
  DURACAO_DA_ENTRADA,
  INICIO_DO_ZOOM,
  MOVIMENTOS,
  ZOOM_FINAL,
  trajetoDaEntrada,
  trajetoDaEscalada,
  type Ponto,
} from '@mentor/core/animacaoSagui';
import {
  SOBRE_O_TIPO,
  TIPO_DA_ESPECIE,
  acertos,
  falaDeAbertura,
  falaDoFim,
  avancar,
  materiaDaArvore,
  montarMissao,
  novaRodada,
  passou,
  precisaAcertar,
  responder,
  type Rodada,
} from '@mentor/core/missaoDaArvore';

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
  if (f.forma === 'linha') return <path d={f.d} fill="none" stroke={f.cor} strokeWidth={f.espessura} strokeLinecap="round" strokeLinejoin="round" />;
  return <path d={f.d} fill={f.cor} stroke={f.contorno} strokeWidth={f.contorno ? f.espessura ?? 2 : undefined} strokeLinejoin="round" />;
}

/* ------------------------------------------------------------------ */

interface SaguiProps {
  fase: Fase;
  larguraArvore: number;
  alturaToca: number;
  reduzir: boolean;
  todasFeitas: boolean;
}

/* Trajeto do core (pixels) para os quadros do motion. */
function quadrosDoMotion(pontos: Ponto[]): { alvo: TargetAndTransition; tempos: number[] } {
  return {
    alvo: {
      x: pontos.map((p) => p.x),
      y: pontos.map((p) => p.y),
      scaleX: pontos.map((p) => p.escalaX),
      scaleY: pontos.map((p) => p.escalaY),
      rotate: pontos.map((p) => p.giro),
      opacity: pontos.map((p) => p.opacidade),
    },
    tempos: pontos.map((p) => p.t),
  };
}

const POSE = (nome: string) => `/mascot/512/${nome}.png`;

/**
 * O sagui no tronco. As posições saem do mesmo quadro do desenho, então
 * ele para exatamente ao lado da toca em qualquer tamanho de árvore.
 *
 * Subida: a pose "pulando" (um braço no alto) alternando com o espelho,
 * braço esquerdo, braço direito. Na porta: a pose que acena. Entrada:
 * agacha, pula sobre o buraco e mergulha girando. Tudo vem de
 * @mentor/core/animacaoSagui; o app nativo toca os mesmos números.
 */
function SaguiNoTronco({ fase, larguraArvore, alturaToca, reduzir, todasFeitas }: SaguiProps) {
  const escala = larguraArvore / QUADRO_ARVORE.largura;
  const alturaArvore = QUADRO_ARVORE.altura * escala;
  const tamanho = Math.round(larguraArvore * 0.46);
  const toca = centroDaToca(alturaToca);
  const tocaPx = { x: toca.x * escala, y: toca.y * escala };

  // Na porta: ao lado do buraco, pendurado no tronco.
  // Centrado no tronco (não ao lado): o corpo fica por cima do buraco, abraçando o tronco enquanto sobe.
  const porta = { x: tocaPx.x - tamanho / 2, y: tocaPx.y - tamanho * 0.62 };
  const chao = alturaArvore - tamanho * 0.95;
  const parado: TargetAndTransition = { x: porta.x, y: porta.y, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 };

  let pose = 'pose_15';
  let inicial: TargetAndTransition | false = false;
  let animar: TargetAndTransition = parado;
  let transicao: Transition = { duration: 0 };
  let origem = '50% 100%';

  if (reduzir) {
    animar = fase === 'entrando' || fase === 'dentro' ? { ...parado, opacity: 0 } : parado;
  } else if (todasFeitas) {
    // Plano fechado: comemora com a bandeira, pulando no lugar.
    pose = 'pose_17';
    const m = MOVIMENTOS.pular;
    animar = {
      x: porta.x,
      y: m.quadros.map((qd) => porta.y + qd.y * tamanho),
      scaleX: m.quadros.map((qd) => qd.escalaX),
      scaleY: m.quadros.map((qd) => qd.escalaY),
    };
    transicao = { duration: m.duracaoMs / 1000, times: m.quadros.map((qd) => qd.t), repeat: Infinity, repeatDelay: 0.6 };
  } else if (fase === 'subindo') {
    pose = 'pulando';
    const { pontos, duracaoMs } = trajetoDaEscalada(chao, porta.y, porta.x);
    const { alvo, tempos } = quadrosDoMotion(pontos);
    inicial = { x: porta.x, y: chao, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 };
    animar = alvo;
    transicao = { duration: duracaoMs / 1000, times: tempos, ease: 'easeOut' };
  } else if (fase === 'pronto') {
    // Acena da porta, com uma pausa entre um aceno e outro.
    const m = MOVIMENTOS.acenar;
    animar = { ...parado, rotate: m.quadros.map((qd) => qd.giro) };
    transicao = { duration: m.duracaoMs / 1000, times: m.quadros.map((qd) => qd.t), repeat: Infinity, repeatDelay: 1.4 };
  } else if (fase === 'dentro') {
    // Já está lá dentro: invisível no buraco. Repetir a entrada aqui, com
    // a câmera em zoom, fazia um sagui gigante cruzar a tela.
    pose = 'pulando';
    animar = { x: tocaPx.x - tamanho / 2, y: tocaPx.y - tamanho / 2, scaleX: 0.05, scaleY: 0.05, rotate: 0, opacity: 0 };
  } else if (fase === 'entrando') {
    pose = 'pulando';
    origem = '50% 50%';
    const { alvo, tempos } = quadrosDoMotion(trajetoDaEntrada(porta, tocaPx, tamanho));
    animar = alvo;
    transicao = { duration: DURACAO_DA_ENTRADA / 1000, times: tempos, ease: 'easeInOut' };
  } else if (fase === 'saindo') {
    // Sai da toca de um salto e volta para a porta.
    inicial = { x: tocaPx.x - tamanho / 2, y: tocaPx.y - tamanho / 2, scaleX: 0.1, scaleY: 0.1, rotate: 0, opacity: 0 };
    animar = parado;
    transicao = { duration: duracaoDaFase('saindo', false) / 1000, ease: 'backOut' };
    origem = '50% 50%';
  }

  return (
    <m.img
      key={`${fase}-${todasFeitas}-${reduzir}`}
      src={POSE(pose)}
      alt=""
      width={tamanho}
      height={tamanho}
      initial={inicial}
      animate={animar}
      transition={transicao}
      style={{ width: tamanho, height: tamanho, transformOrigin: origem }}
      className="absolute left-0 top-0 z-10 object-contain pointer-events-none select-none drop-shadow-sm"
    />
  );
}

/** Estrelas que saem do centro quando a missão é cumprida. */
function Estrelas() {
  const n = 10;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: n }, (_, i) => {
        const ang = (i / n) * Math.PI * 2;
        return (
          <m.span
            key={i}
            className="absolute left-1/2 top-1/3 text-amber-400"
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
            animate={{ x: Math.cos(ang) * 130, y: Math.sin(ang) * 90, scale: 1, opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.05 * (i % 3) }}
          >
            <Star size={18} fill="currentColor" />
          </m.span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */

const ICONE_DO_TIPO = { escolha: ListChecks, verdadeiroFalso: BadgeCheck, umaOuOutra: Split } as const;
const CLASSE_DO_TOM = {
  ceu: 'bg-ceu-100 text-ceu-700 border-ceu-200',
  violeta: 'bg-violet-100 text-violet-800 border-violet-200',
  laranja: 'bg-orange-100 text-orange-800 border-orange-200',
} as const;

/** Selo do tipo de missão: cor e ícone por formato de árvore, e a matéria. */
function SeloDoTipo({ especie, materia, alinharDireita }: { especie: Arvore['especie']; materia: string; alinharDireita?: boolean }) {
  const tipo = TIPO_DA_ESPECIE[especie];
  const sobre = SOBRE_O_TIPO[tipo];
  const Icone = ICONE_DO_TIPO[tipo];
  return (
    <p className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${alinharDireita ? 'justify-end' : ''}`}>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${CLASSE_DO_TOM[sobre.tom]}`}>
        <Icone size={12} strokeWidth={3} aria-hidden="true" /> {sobre.nome}
      </span>
      <span className="text-[11px] font-bold text-slate-600">{materia}</span>
    </p>
  );
}

/** Céu atrás da floresta: sol e nuvens, só cenário. */
function CenarioDoCeu() {
  return (
    <svg aria-hidden="true" className="absolute inset-x-0 top-0 w-full h-40 pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="xMidYMin slice">
      <circle cx="350" cy="38" r="22" fill="#FDE68A" />
      <circle cx="350" cy="38" r="32" fill="#FDE68A" opacity="0.35" />
      <g fill="#FFFFFF" opacity="0.95">
        <ellipse cx="70" cy="40" rx="34" ry="12" />
        <ellipse cx="92" cy="32" rx="22" ry="14" />
        <ellipse cx="56" cy="34" rx="16" ry="10" />
        <ellipse cx="230" cy="70" rx="28" ry="9" />
        <ellipse cx="246" cy="63" rx="16" ry="10" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A missão de quiz dentro da árvore. O tipo vem do formato da árvore
 * (@mentor/core/missaoDaArvore); a resposta vale no primeiro toque e a
 * explicação aparece logo depois. Passou dos 60%, a tarefa conclui e dá o
 * XP; não passou, tenta de novo com outras questões.
 */
function MissaoQuiz({
  arvore,
  materia,
  reduzir,
  feita,
  onConcluir,
  onSair,
}: {
  arvore: Arvore;
  materia: string;
  reduzir: boolean;
  feita: boolean;
  onConcluir: (t: MicroTask, resultado: { acertos: number; total: number }) => void;
  onSair: () => void;
}) {
  const tipo = TIPO_DA_ESPECIE[arvore.especie];
  const sobre = SOBRE_O_TIPO[tipo];
  const [rodada, setRodada] = useState<Rodada>(() => novaRodada(montarMissao(tipo, materia)));
  const [comecou, setComecou] = useState(false);
  const concluiu = useRef(false);
  const item = rodada.itens[rodada.indice];
  const total = rodada.itens.length;
  const certas = acertos(rodada);

  // Passou: conclui a tarefa uma vez só (o XP sai daqui, e só daqui).
  useEffect(() => {
    if (rodada.terminou && passou(rodada) && !concluiu.current && !feita) {
      concluiu.current = true;
      onConcluir(arvore.tarefa, { acertos: certas, total });
    }
  }, [rodada, feita, onConcluir, arvore.tarefa, certas, total]);

  const cabecalho = (
    <p className="flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide text-amber-100">
      <span className="px-2.5 py-1 rounded-full bg-amber-500/25 border border-amber-300/40">{sobre.nome}</span>
      <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20">{materia}</span>
    </p>
  );

  if (feita && !rodada.terminou) {
    return (
      <div className="space-y-4 text-center">
        {cabecalho}
        <p className="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-emerald-700 text-white font-extrabold" role="status">
          <Check size={18} strokeWidth={3} /> Missão já cumprida hoje
        </p>
        <button type="button" onClick={onSair} className="btn-primary w-full h-12 uppercase">
          Sair e ir para a próxima árvore
        </button>
      </div>
    );
  }

  if (!comecou && !rodada.terminou) {
    return (
      <div className="space-y-4">
        {cabecalho}
        {/* O sagui fala: o que vem e quanto precisa acertar. */}
        <m.div
          initial={reduzir ? false : { opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduzir ? 0 : 0.95 }}
          className="relative rounded-[20px] border-2 border-amber-200 bg-white p-4 text-center shadow-lip"
        >
          <span aria-hidden="true" className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white border-l-2 border-t-2 border-amber-200" />
          <p className="font-extrabold text-tinta-900 leading-relaxed">{falaDeAbertura(tipo, materia, total)}</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{sobre.explicacao}</p>
        </m.div>
        <m.button
          type="button"
          onClick={() => setComecou(true)}
          initial={reduzir ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduzir ? 0 : 1.1 }}
          className="btn-ambar w-full h-14 uppercase text-base inline-flex items-center justify-center gap-2"
        >
          <Play size={18} fill="currentColor" /> Começar
        </m.button>
      </div>
    );
  }

  if (rodada.terminou) {
    const ok = passou(rodada);
    return (
      <m.div className="space-y-4 text-center" initial={reduzir ? false : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        {cabecalho}
        <div className={`relative rounded-[20px] border-2 p-5 ${ok ? 'bg-emerald-50 border-emerald-600' : 'bg-amber-50 border-amber-300'}`} role="status">
          {ok && !reduzir && <Estrelas />}
          <img src={`/mascot/512/${ok ? 'pose_17' : 'meditando'}.png`} alt="" width={96} height={96} className="relative w-24 h-24 mx-auto object-contain" />
          <p className="relative text-4xl font-black text-tinta-900 tabular-nums">
            {certas} de {total}
          </p>
          <p className={`relative mt-1 font-extrabold ${ok ? 'text-emerald-800' : 'text-amber-900'}`}>{falaDoFim(certas, total)}</p>
          {ok ? (
            <p className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 font-black text-amber-950">
              <Zap size={16} fill="currentColor" /> +{XP_DA_TAREFA} XP
            </p>
          ) : (
            <p className="relative mt-2 text-sm font-bold text-amber-900">Precisa de {precisaAcertar(total)} acertos.</p>
          )}
        </div>
        {ok ? (
          <button type="button" onClick={onSair} className="btn-primary w-full h-12 uppercase">
            Sair e ir para a próxima árvore
          </button>
        ) : (
          <button type="button" onClick={() => setRodada(novaRodada(montarMissao(tipo, materia)))} className="btn-ambar w-full h-12 uppercase">
            Tentar de novo com outras questões
          </button>
        )}
      </m.div>
    );
  }

  const respondida = rodada.escolhida !== null;
  const acertou = respondida && rodada.escolhida === item.correta;
  const binario = item.opcoes.length === 2;
  return (
    <div className="space-y-3">
      {cabecalho}
      <div className="flex items-center gap-2" aria-hidden="true">
        {rodada.itens.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < rodada.indice || (i === rodada.indice && respondida)
                ? rodada.respostas[i] === rodada.itens[i].correta
                  ? 'bg-emerald-400'
                  : 'bg-red-400'
                : i === rodada.indice
                  ? 'bg-amber-300'
                  : 'bg-white/20'
            }`}
          />
        ))}
      </div>
      <m.div
        key={item.id}
        initial={reduzir ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-[20px] border-2 border-amber-200 bg-amber-50 p-4"
      >
        <p className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
          Questão {rodada.indice + 1} de {total}
        </p>
        <p className="mt-1 text-lg font-extrabold text-tinta-900 leading-snug">{item.enunciado}</p>
        {item.respostaProposta && (
          <p className="mt-3 rounded-xl bg-white border-2 border-dashed border-amber-300 px-3 py-2 font-extrabold text-tinta-900">
            Resposta proposta: {item.respostaProposta}
          </p>
        )}
        <div className={`mt-3 grid gap-2 ${binario ? 'grid-cols-2' : 'grid-cols-1'}`} role="group" aria-label="Alternativas">
          {item.opcoes.map((op, i) => {
            const certa = respondida && i === item.correta;
            const errada = respondida && i === rodada.escolhida && !certa;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setRodada((r) => responder(r, i))}
                disabled={respondida}
                aria-label={`${op}${certa ? ', correta' : errada ? ', sua resposta, errada' : ''}`}
                className={`min-h-12 px-3 py-2.5 rounded-xl border-2 font-extrabold text-left transition-transform active:translate-y-0.5 ${
                  binario ? 'text-center' : ''
                } ${
                  certa
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : errada
                      ? 'bg-red-600 border-red-700 text-white'
                      : respondida
                        ? 'bg-white border-slate-200 text-slate-400'
                        : 'bg-white border-slate-300 text-tinta-900 hover:border-ceu-500 hover:bg-ceu-50'
                }`}
              >
                {op}
              </button>
            );
          })}
        </div>
        {respondida && (
          <m.div initial={reduzir ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-3" role="status">
            <p className={`font-black ${acertou ? 'text-emerald-800' : 'text-red-700'}`}>{acertou ? 'Mandou bem!' : 'Quase lá!'}</p>
            <p className="text-sm font-semibold text-slate-700 leading-relaxed">{item.explicacao}</p>
            <button type="button" onClick={() => setRodada((r) => avancar(r))} className="btn-primary w-full h-12 uppercase">
              {rodada.indice >= total - 1 ? 'Ver resultado' : 'Próxima'}
            </button>
          </m.div>
        )}
      </m.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface TocaProps {
  arvore: Arvore;
  total: number;
  origem: { x: number; y: number };
  reduzir: boolean;
  materia: string;
  onConcluir: (t: MicroTask, resultado: { acertos: number; total: number }) => void;
  onSair: () => void;
}

/**
 * Dentro da toca: abre num círculo que cresce a partir do buraco do
 * tronco. É um diálogo de verdade (foco, Esc, aria-modal), porque cobre a
 * tela inteira.
 */
/* Vaga-lumes do fundo da toca: posições fixas, tempos variados. */
const VAGALUMES = [
  { x: 16, y: 58, r: 5, d: 3.2, atraso: 0 },
  { x: 82, y: 50, r: 4, d: 3.8, atraso: 0.6 },
  { x: 30, y: 78, r: 6, d: 4.2, atraso: 0.3 },
  { x: 70, y: 82, r: 4, d: 3.5, atraso: 1.1 },
  { x: 52, y: 66, r: 5, d: 4.6, atraso: 0.9 },
  { x: 90, y: 72, r: 3, d: 3.3, atraso: 0.4 },
] as const;

function DentroDaToca({ arvore, total, origem, reduzir, materia, onConcluir, onSair }: TocaProps) {
  const idTitulo = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const feita = arvore.tarefa.completed;

  useEffect(() => {
    titulo.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSair();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onSair]);


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

      {/* A boca da toca lá em cima: a árvore bonita vista de dentro, com a
          luz do dia descendo em feixe e vaga-lumes no escuro. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-72 h-80" style={{ background: 'radial-gradient(60% 70% at 50% 0%, rgba(253,230,138,0.38), rgba(253,230,138,0) 70%)' }} />
        <div className="absolute left-1/2 -translate-x-1/2 -top-12 w-32 h-32 rounded-full overflow-hidden border-[6px] border-[#3B2412] shadow-[inset_0_-8px_16px_rgba(0,0,0,0.35)]" style={{ background: 'linear-gradient(#E0F2FE,#F7FEE7)' }}>
          <div className="absolute left-1/2 -translate-x-1/2 top-2" style={{ width: 118 }}>
            <DesenhoArvore arvore={arvore} largura={118} />
          </div>
        </div>
        {VAGALUMES.map((v, i) => (
          <m.span
            key={i}
            className="absolute rounded-full"
            style={{ left: `${v.x}%`, top: `${v.y}%`, width: v.r, height: v.r, background: '#FDE68A', boxShadow: '0 0 8px 2px rgba(253,230,138,0.8)' }}
            initial={reduzir ? false : { opacity: 0.2 }}
            animate={reduzir ? { opacity: 0.5 } : { opacity: [0.2, 1, 0.3, 0.9, 0.2], y: [0, -14, 6, -8, 0], x: [0, 8, -6, 4, 0] }}
            transition={reduzir ? { duration: 0 } : { duration: v.d, repeat: Infinity, ease: 'easeInOut', delay: v.atraso }}
          />
        ))}
      </div>

      <div className="relative max-w-md mx-auto px-4 pt-24 pb-16 min-h-full flex flex-col">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-amber-300">
              Missão · árvore {arvore.indice + 1} de {total}
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
          /* Cai pelo buraco lá de cima e aterrissa de pé: achata no
             impacto, estica de volta e assenta para estudar. */
          initial={reduzir ? false : { y: -260, scaleX: 0.9, scaleY: 1.1, opacity: 0 }}
          animate={
            reduzir
              ? { y: 0, opacity: 1 }
              : { y: [-260, 0, 0, 0], scaleX: [0.9, 1.18, 0.96, 1], scaleY: [1.1, 0.78, 1.06, 1], opacity: [0, 1, 1, 1] }
          }
          transition={reduzir ? { duration: 0 } : { delay: 0.3, duration: 0.75, times: [0, 0.45, 0.72, 1], ease: 'easeIn' }}
          style={{ transformOrigin: '50% 100%' }}
        />

        <MissaoQuiz arvore={arvore} materia={materia} reduzir={reduzir} feita={feita} onConcluir={onConcluir} onSair={onSair} />
      </div>
    </m.div>
  );
}

/* ------------------------------------------------------------------ */

export function FlorestaDoDia({
  tarefas,
  reduzir,
  xpVoando,
  onConcluir,
}: {
  tarefas: MicroTask[];
  reduzir: boolean;
  xpVoando: string | null;
  onConcluir: (t: MicroTask, resultado: { acertos: number; total: number }) => void;
}) {
  const floresta = useMemo(() => montarFloresta(tarefas), [tarefas]);
  /* Matéria de cada árvore: as que o aluno mais erra vêm primeiro. */
  const quizResults = useAppStore((st) => st.quizResults);
  const historico = useMemo(() => acertoPorMateria(quizResults), [quizResults]);
  const materiaDe = (indice: number) => materiaDaArvore(indice, historico);
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

  /* Tocar na árvore só leva o sagui até ela. Entrar na missão é sempre
     pelo botão "Iniciar missão": entrar ao tocar na árvore pegava quem só
     estava rolando a tela. */
  function levarSaguiAte(indice: number) {
    if (indice !== indiceSagui) setEscolhida(indice);
  }

  function iniciarMissao(indice: number) {
    const el = tocaRefs.current[indice];
    if (el) {
      const r = el.getBoundingClientRect();
      setOrigem({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    // Prende o sagui nesta árvore enquanto a missão estiver aberta: ao
    // comprovar, a "primeira tarefa aberta" passa a ser a seguinte, e sem
    // a trava a toca trocava de árvore com o aluno lá dentro.
    setEscolhida(indice);
    disparar('tocar');
  }

  const sair = useCallback(() => disparar('fechar'), [disparar]);

  /* Pés das árvores medidos na tela, para o caminho de terra passar por
     eles. Mede de novo quando a lista muda de tamanho (fonte maior, giro
     do tablet, tarefa nova). */
  const listaRef = useRef<HTMLOListElement>(null);
  const arvoreRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [caminho, setCaminho] = useState('');
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;
    const medir = () => {
      const base = lista.getBoundingClientRect();
      const pontos = arvoreRefs.current
        .slice(0, floresta.arvores.length)
        .filter((el): el is HTMLDivElement => !!el)
        .map((el) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight - 10 }));
      if (base.width > 0) setCaminho(caminhoEntreArvores(pontos));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(medir);
    obs.observe(lista);
    return () => obs.disconnect();
  }, [floresta.arvores.length, largura]);
  const arvoreDoSagui = floresta.arvores[indiceSagui];
  const alturaArvore = (largura * QUADRO_ARVORE.altura) / QUADRO_ARVORE.largura;

  return (
    <div
      className="relative rounded-[28px] border-2 border-sky-100 px-3 pt-6 pb-4"
      style={{ background: 'linear-gradient(180deg, #E0F2FE 0%, #F0F9FF 30%, #F7FEE7 72%, #DCFCE7 100%)' }}
    >
      <CenarioDoCeu />
      <ol ref={listaRef} className="relative max-w-md mx-auto flex flex-col gap-1">
        {/* Caminho de terra entre os pés das árvores, atrás de tudo. */}
        {caminho && (
          <svg aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
            <path d={caminho} fill="none" stroke="#E9D5B5" strokeWidth={22} strokeLinecap="round" />
            <path d={caminho} fill="none" stroke="#D6B98F" strokeWidth={22} strokeLinecap="round" strokeDasharray="1 0" opacity={0.35} />
            <path d={caminho} fill="none" stroke="#FFF7E8" strokeWidth={4} strokeLinecap="round" strokeDasharray="2 16" />
          </svg>
        )}
        {floresta.arvores.map((a) => {
          const comSagui = a.indice === indiceSagui;
          const esquerda = a.lado === 'esquerda';
          const toca = centroDaToca(a.alturaToca);
          const escala = largura / QUADRO_ARVORE.largura;
          return (
            <li key={a.tarefa.id} className={`flex items-center gap-3 ${esquerda ? 'flex-row' : 'flex-row-reverse'}`}>
              <m.div
                ref={(el: HTMLDivElement | null) => {
                  arvoreRefs.current[a.indice] = el;
                }}
                className={`relative shrink-0 ${comSagui && (fase === 'entrando' || fase === 'dentro' || fase === 'saindo') ? 'z-30' : 'z-[1]'}`}
                style={{ width: largura, height: alturaArvore, transformOrigin: `${toca.x * escala}px ${toca.y * escala}px` }}
                /* Câmera: depois do mergulho, a árvore cresce em volta do
                   buraco até o escuro da toca encher a tela; na saída,
                   o caminho inverso. */
                animate={
                  !comSagui || reduzir
                    ? { scale: 1 }
                    : fase === 'entrando'
                      ? { scale: [1, 1, ZOOM_FINAL] }
                      : fase === 'dentro'
                        ? { scale: ZOOM_FINAL }
                        : { scale: 1 }
                }
                transition={
                  comSagui && fase === 'entrando' && !reduzir
                    ? { duration: DURACAO_DA_ENTRADA / 1000, times: [0, INICIO_DO_ZOOM, 1], ease: 'easeIn' }
                    : { duration: comSagui && fase === 'saindo' && !reduzir ? 0.45 : 0, ease: 'easeOut' }
                }
              >
                <button
                  type="button"
                  onClick={() => levarSaguiAte(a.indice)}
                  disabled={a.estado === 'feita'}
                  aria-label={rotuloDaArvore(a, total, comSagui)}
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
              </m.div>

              <div
                className={`relative z-[2] flex-1 min-w-0 rounded-2xl border-2 bg-white/95 px-3 py-2.5 ${
                  comSagui && a.estado !== 'feita' ? 'border-amber-300 shadow-lip-ambar' : 'border-slate-200 shadow-lip'
                } ${esquerda ? 'text-left' : 'text-right'}`}
              >
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Árvore {a.indice + 1}</p>
                <p className={`font-extrabold leading-tight ${a.estado === 'feita' ? 'text-slate-400 line-through' : 'text-tinta-900'}`}>{a.tarefa.titulo}</p>
                <SeloDoTipo especie={a.especie} materia={materiaDe(a.indice)} alinharDireita={!esquerda} />
                {comSagui && a.estado !== 'feita' && (
                  <button
                    type="button"
                    onClick={() => iniciarMissao(a.indice)}
                    disabled={fase === 'entrando' || fase === 'dentro'}
                    className="btn-ambar mt-2.5 w-full h-12 px-4 uppercase text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                    aria-label={`Iniciar missão: ${a.tarefa.titulo}`}
                  >
                    <Play size={16} fill="currentColor" /> Iniciar missão
                  </button>
                )}
                {a.estado === 'feita' && <p className="mt-1 text-xs font-extrabold text-emerald-700">Missão cumprida</p>}
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
            materia={materiaDe(arvoreDoSagui.indice)}
            onConcluir={onConcluir}
            onSair={sair}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
