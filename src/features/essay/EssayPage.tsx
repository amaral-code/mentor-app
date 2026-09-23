import { useCallback, useEffect, useRef, useState } from 'react';
import { BookMarked, Lightbulb, PenLine, Trophy } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { RedacaoFoto } from './RedacaoFoto';
import { GlassCard } from '../../shared/ui/GlassCard';
import { EmptyState } from '../../shared/ui/EmptyState';
import { m, useReducedMotion } from 'motion/react';
import { atrasoDoItem } from '../../shared/lib/motionPresets';
import { Modal } from '../../shared/ui/Modal';
import { correctEssay, correctEssayAI } from '../../shared/lib/essayCorrector';
import { aiAvailable } from '../../shared/lib/aiService';
import { getRandomTheme, ChallengeTheme } from '../../shared/lib/challengeBank';
import { EssayCorrection, ChallengeResult } from '../../shared/types';
import { playCorrect, playError } from '../../shared/lib/sfx';

const CHALLENGE_SECONDS = 3 * 60 * 60; // 3 horas

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function competenciaDesc(key: string): string {
  switch (key) {
    case 'competencia1': return 'Domínio da modalidade escrita formal da língua portuguesa';
    case 'competencia2': return 'Compreensão da proposta de redação e desenvolvimento do tema dissertativo-argumentativo';
    case 'competencia3': return 'Seleção, relação, organização e interpretação de fatos e argumentos em defesa de um ponto de vista';
    case 'competencia4': return 'Uso de mecanismos linguísticos para construção da argumentação (coesão e coerência)';
    case 'competencia5': return 'Elaboração de proposta de intervenção com respeito aos direitos humanos';
    default: return '';
  }
}

function getNotaColor(nota: number): string {
  if (nota >= 700) return '#10b981';
  if (nota >= 400) return '#f59e0b';
  return '#ef4444';
}

function getNotaLabel(nota: number): string {
  if (nota >= 900) return 'Excelente, nota dos sonhos!';
  if (nota >= 700) return 'Excelente';
  if (nota >= 600) return 'Bom, próximo do ideal';
  if (nota >= 400) return 'Razoável, continue praticando';
  return 'Precisa de atenção: estude os critérios';
}

const competencias = [
  { key: 'competencia1' as const, label: 'C1: Norma Culta', short: 'C1' },
  { key: 'competencia2' as const, label: 'C2: Compreensão do Tema', short: 'C2' },
  { key: 'competencia3' as const, label: 'C3: Argumentação', short: 'C3' },
  { key: 'competencia4' as const, label: 'C4: Coesão', short: 'C4' },
  { key: 'competencia5' as const, label: 'C5: Proposta de Intervenção', short: 'C5' },
];

function ScoreRing({ nota, size = 150 }: { nota: number; size?: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (nota / 1000) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90 w-full h-full" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={getNotaColor(nota)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 10px ${getNotaColor(nota)}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold tabular-nums" style={{ color: getNotaColor(nota) }}>
          {nota}
        </span>
        <span className="text-xs text-gray-500">/ 1000</span>
      </div>
    </div>
  );
}

export function EssayPage() {
  const reduzir = useReducedMotion();
  const [text, setText] = useState('');
  const [tema, setTema] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const lastCorrection = useAppStore((s) => s.lastCorrection);
  const setLastCorrection = useAppStore((s) => s.setLastCorrection);
  const addXP = useAppStore((s) => s.addXP);
  const addLog = useAppStore((s) => s.addLog);
  const isMuted = useAppStore((s) => s.isMuted);
  const apiKey = useAppStore((s) => s.apiKey);
  const setToast = useAppStore((s) => s.setToast);
  const challengeResults = useAppStore((s) => s.challengeResults);
  const addChallengeResult = useAppStore((s) => s.addChallengeResult);
  const challengeSeenTutorial = useAppStore((s) => s.challengeSeenTutorial);
  const setChallengeSeenTutorial = useAppStore((s) => s.setChallengeSeenTutorial);

  // Challenge state
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [theme, setTheme] = useState<ChallengeTheme | null>(null);
  const [challengeText, setChallengeText] = useState('');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_SECONDS);
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);
  const [challengeCorrection, setChallengeCorrection] = useState<EssayCorrection | null>(null);
  const [challengeIsCorrecting, setChallengeIsCorrecting] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const timerRef = useRef<number | null>(null);

  async function handleCorrect() {
    if (text.trim().length < 50) return;
    setIsCorrecting(true);
    try {
      await runCorrection(text, tema, false);
    } catch (e) {
      setToast('Erro na correção: ' + (e instanceof Error ? e.message : 'erro desconhecido'), 'error');
    } finally {
      setIsCorrecting(false);
    }
  }

  async function runCorrection(body: string, themeText?: string, isChallenge = false): Promise<EssayCorrection> {
    let correction: EssayCorrection;
    if (aiAvailable(apiKey)) {
      correction = await correctEssayAI(body, apiKey, themeText || undefined);
    } else {
      await new Promise(r => setTimeout(r, 800));
      correction = correctEssay(body, themeText || undefined);
    }
    setLastCorrection(correction);
    const xpGain = correction.notaFinal >= 600 ? 100 : 50;
    addXP(xpGain);
    // No desafio o addLog (que persiste o XP no servidor) acontece uma única
    // vez dentro de addChallengeResult — sem isso o XP entrava em dobro.
    if (!isChallenge) {
      addLog({ timestamp: Date.now(), type: 'essay', description: `Redação corrigida: ${correction.notaFinal}/1000`, xp: xpGain });
    }
    if (!isMuted) {
      if (correction.notaFinal >= 600) playCorrect(); else playError();
    }
    if (isChallenge) {
      const result: ChallengeResult = {
        id: `ch_${Date.now()}`,
        tema: themeText || 'Tema livre',
        notaFinal: correction.notaFinal,
        competencia1: correction.competencia1,
        competencia2: correction.competencia2,
        competencia3: correction.competencia3,
        competencia4: correction.competencia4,
        competencia5: correction.competencia5,
        xpGanho: xpGain,
        tempoUsadoSegundos: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
        finalizado: !timeUp,
        timestamp: Date.now(),
      };
      addChallengeResult(result);
    }
    return correction;
  }

  const beginChallenge = useCallback(() => {
    setTheme(getRandomTheme());
    setChallengeText('');
    setDeadline(Date.now() + CHALLENGE_SECONDS * 1000);
    setStartedAt(Date.now());
    setTimeLeft(CHALLENGE_SECONDS);
    setChallengeSubmitted(false);
    setChallengeCorrection(null);
    setConfirmExit(false);
    setTimeUp(false);
    setChallengeOpen(true);
  }, []);

  const startChallenge = useCallback(() => {
    if (!challengeSeenTutorial) {
      setShowTutorial(true);
      return;
    }
    beginChallenge();
  }, [challengeSeenTutorial, beginChallenge]);

  function finishTutorial() {
    setChallengeSeenTutorial(true);
    setShowTutorial(false);
    beginChallenge();
  }

  const newRandomTheme = useCallback(() => {
    setTheme(getRandomTheme());
    setChallengeText('');
    setChallengeSubmitted(false);
    setChallengeCorrection(null);
    setDeadline(Date.now() + CHALLENGE_SECONDS * 1000);
    setStartedAt(Date.now());
    setTimeLeft(CHALLENGE_SECONDS);
  }, []);

  // Countdown
  useEffect(() => {
    if (!challengeOpen || !deadline || challengeSubmitted) return;
    timerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        setTimeUp(true);
        setChallengeSubmitted(true);
        setChallengeIsCorrecting(true);
        const body = challengeTextRef.current;
        if (body.trim().length >= 50) {
          runCorrection(body, theme?.tema, true)
            .then(c => setChallengeCorrection(c))
            .finally(() => setChallengeIsCorrecting(false));
        } else {
          setChallengeIsCorrecting(false);
        }
      }
    }, 1000);
    return () => {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeOpen, deadline, challengeSubmitted, theme]);

  const challengeTextRef = useRef('');
  useEffect(() => { challengeTextRef.current = challengeText; }, [challengeText]);

  async function handleChallengeSubmit() {
    if (challengeText.trim().length < 50) return;
    if (challengeSubmitted) return;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    setTimeUp(false);
    setChallengeSubmitted(true);
    setChallengeIsCorrecting(true);
    try {
      const correction = await runCorrection(challengeText, theme?.tema, true);
      setChallengeCorrection(correction);
    } catch (e) {
      setToast('Erro na correção: ' + (e instanceof Error ? e.message : 'erro desconhecido'), 'error');
    } finally {
      setChallengeIsCorrecting(false);
    }
  }

  function exitChallenge() {
    setChallengeOpen(false);
    setConfirmExit(false);
    setTheme(null);
    setChallengeText('');
    setDeadline(null);
    setStartedAt(null);
    setChallengeCorrection(null);
    setChallengeSubmitted(false);
    setTimeUp(false);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const challengeWordCount = challengeText.trim() ? challengeText.trim().split(/\s+/).length : 0;
  const extensionPct = Math.min(100, Math.round((challengeWordCount / 300) * 100));
  const timerColor = timeLeft <= 600 ? '#ef4444' : timeLeft <= 3600 ? '#f59e0b' : '#10b981';
  const minutesUsed = startedAt ? Math.floor((Date.now() - startedAt) / 60000) : 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Redação 1000</h1>
          <p className="text-sm text-gray-500 mt-0.5">Treine sua redação ENEM com correção automática pelas 5 competências.</p>
        </div>
        {challengeResults.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="badge badge-purple"><Trophy size={16} className="inline-block align-[-0.15em] text-amber-400" /> {challengeResults.length} desafios</span>
            <span className="badge badge-emerald">Nota média: {Math.round(challengeResults.reduce((a, r) => a + r.notaFinal, 0) / challengeResults.length)}</span>
          </div>
        )}
      </div>

      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Sua Redação</h2>
          <div className="flex items-center gap-2">
            {aiAvailable(apiKey) && <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Correção IA</span>}
            {wordCount > 0 && (
              <span className={`badge ${wordCount >= 150 ? 'badge-emerald' : 'badge-red'}`}>
                {wordCount} palavras
              </span>
            )}
          </div>
        </div>
        <input
          type="text"
          value={tema}
          onChange={e => setTema(e.target.value)}
          placeholder="Tema da redação (ex: 'Desafios da inclusão digital no Brasil')"
          className="w-full bg-white/[0.03] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 mb-4 transition-all"
        />
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Digite sua redação aqui..."
          rows={8}
          className="w-full bg-transparent resize-none text-sm text-white leading-relaxed placeholder-gray-600 focus:outline-none md:rows-12"
        />
        <div className="flex items-center justify-between mt-4 gap-3">
          <button
            onClick={startChallenge}
            className="btn-secondary shrink-0"
            title="Entre no Modo Desafio: tema aleatório, coletânea de apoio e 3 horas para escrever como no ENEM"
          > Modo Desafio
          </button>
          <button onClick={handleCorrect} disabled={text.trim().length < 50 || isCorrecting} className="btn-primary">
            {isCorrecting ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Corrigindo...</>
            ) : 'Corrigir Redação'}
          </button>
        </div>
      </GlassCard>

      {/* Redacao escrita a mao: entra logo abaixo do editor porque e a
          MESMA tarefa por outro caminho - quem escreveu no caderno nao
          deveria precisar digitar tudo de novo para receber nota. */}
      <RedacaoFoto
        tema={tema}
        onUsarTranscricao={(transcrito) => {
          setText(transcrito);
          setToast('Transcrição carregada no editor. Revise e corrija de novo se quiser.', 'info');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {lastCorrection && (
        <GlassCard>
          <h2 className="text-sm font-semibold text-gray-300 mb-5">Resultado da Correção</h2>

          <div className="flex flex-col items-center mb-8">
            <ScoreRing nota={lastCorrection.notaFinal} />
            <span className={`badge ${
              lastCorrection.notaFinal >= 700 ? 'badge-emerald' :
              lastCorrection.notaFinal >= 400 ? 'badge-amber' :
              'badge-red'
            }`}>
              {getNotaLabel(lastCorrection.notaFinal)}
            </span>
          </div>

          <div className="space-y-3 mb-6">
            {competencias.map(c => {
              const val = lastCorrection[c.key];
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-400">{c.label}</span>
                    <span className="text-white font-medium tabular-nums">{val}/200</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full xp-bar"
                      style={{
                        width: `${(val / 200) * 100}%`,
                        backgroundColor: getNotaColor(val * 5),
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">{competenciaDesc(c.key)}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lastCorrection.pontosFortes.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <h3 className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Pontos Fortes</h3>
                <ul className="space-y-1.5">
                  {lastCorrection.pontosFortes.map((p, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lastCorrection.pontosMelhorar.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <h3 className="text-xs font-semibold text-amber-400 mb-3 uppercase tracking-wider">A Melhorar</h3>
                <ul className="space-y-1.5">
                  {lastCorrection.pontosMelhorar.map((p, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ==== Histórico de desafios ==== */}
      {challengeResults.length === 0 && (
        <div className="glass rounded-2xl p-5">
          <EmptyState
            pose="estudando"
            compacto
            titulo="Você ainda não fez nenhum desafio"
            descricao="Escreva a primeira redação cronometrada e veja a nota por competência."
          />
        </div>
      )}

      {challengeResults.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300"><Trophy size={16} className="inline-block align-[-0.15em] text-amber-400" /> Histórico de Desafios</h2>
            <span className="badge badge-gray">{challengeResults.length} rodadas</span>
          </div>
          <div className="space-y-3">
            {challengeResults.map((r, i) => {
              const color = getNotaColor(r.notaFinal);
              return (
                <m.div
                  key={r.id}
                  initial={reduzir ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduzir ? { duration: 0 } : { delay: atrasoDoItem(i), duration: 0.25 }}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                >
                  <div className="relative w-12 h-12 shrink-0">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="52" fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(r.notaFinal / 1000) * 326.7} 326.7`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums" style={{ color }}>
                      {r.notaFinal}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{r.tema}</p>
                    <p className="text-[11px] text-gray-500">
                      {r.finalizado ? ' Finalizada no prazo' : '⏱ Tempo esgotado'} ·{' '}
                      {Math.floor(r.tempoUsadoSegundos / 60)}min · {new Date(r.timestamp).toLocaleDateString('pt-BR')} · +{r.xpGanho} XP
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap shrink-0">
                    {['competencia1','competencia2','competencia3','competencia4','competencia5'].map((c, i) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-gray-400"> C{i + 1}:{r[c as keyof ChallengeResult]}
                      </span>
                    ))}
                  </div>
                </m.div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ==== MODO DESAFIO - experiência de prova ENEM ==== */}
      <Modal open={challengeOpen} fullScreen title=" Modo Desafio">
        {theme && (
          <div className="flex flex-col min-h-full challenge-hero overflow-y-auto overflow-x-hidden scrollbar-none">
            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between gap-3 mb-4">
              <button
                onClick={() => setConfirmExit(true)}
                className="btn-ghost shrink-0 -ml-2"
                title="Voltar (caso tenha aberto sem querer)"
              > Voltar
              </button>
              <div className="flex items-center gap-2">
                <span className="badge badge-emerald">🇧🇷 Prova simulada ENEM</span>
                <span className="hidden sm:inline text-xs text-gray-500">Redação · Dissertativo-argumentativa</span>
              </div>
              <button
                onClick={newRandomTheme}
                className="btn-secondary shrink-0"
                title="Sortear outro tema (o cronômetro é reiniciado)"
              > Outro Tema
              </button>
            </div>

            {/* Hero: tema + timer */}
            <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 mb-5 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
                <div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2 inline-block"> Proposta de Redação
                  </span>
                  <h2 className="text-xl md:text-2xl font-extrabold text-white leading-snug challenge-q">
                    {theme.tema}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="badge badge-purple">5 competências avaliadas</span>
                    <span className="badge badge-emerald">Nota de 0 a 1000</span>
                    <span className="badge badge-amber">Mínimo: 150 palavras</span>
                  </div>
                </div>

                {/* Timer */}
                <div className="flex items-center gap-4 justify-start md:justify-end">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`challenge-timer relative ${timeLeft <= 600 ? 'challenge-timer--warn' : ''}`}>
                      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                        <circle
                          cx="60" cy="60" r="52" fill="none"
                          stroke={timerColor}
                          strokeWidth="7"
                          strokeLinecap="round"
                          strokeDasharray={`${(timeLeft / CHALLENGE_SECONDS) * 326.7} 326.7`}
                          className="transition-all duration-1000"
                          style={{ filter: `drop-shadow(0 0 8px ${timerColor}66)` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-extrabold tabular-nums font-mono text-white">{formatTime(timeLeft)}</span>
                        <span className="text-[9px] uppercase tracking-widest text-white/50">tempo restante</span>
                      </div>
                    </div>
                    {startedAt && !challengeSubmitted && (
                      <span className="text-[10px] text-white/40">iniciou há {minutesUsed} min</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="challenge-stat px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Extensão ideal</div>
                  <div className="text-base font-bold text-white">300+ palavras</div>
                </div>
                <div className="challenge-stat px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Nota máxima</div>
                  <div className="text-base font-bold text-white">1000 pontos</div>
                </div>
                <div className="challenge-stat px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Competências</div>
                  <div className="text-base font-bold text-white">5 de 5</div>
                </div>
              </div>
            </div>

            {/* Coletânea */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2"> Textos de Apoio (coletânea): repertório sociocultural
                <span className="badge badge-gray text-[9px] uppercase">use como base para seus argumentos</span>
              </h3>
              <div className="space-y-2.5">
                {theme.coletanea.map((t, i) => (
                  <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 pl-5 relative overflow-hidden">
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400/60 to-amber-400/40" />
                    <p className="text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-bold"> T{i + 1}
                      </span>
                      {t.titulo}
                    </p>
                    <p className="text-sm text-gray-400 leading-relaxed">{t.texto}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 challenge-note rounded-2xl bg-amber-500/[0.06] border border-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                <span className="mr-1"><Lightbulb size={16} className="inline-block align-[-0.15em] text-amber-400" /></span>
                <span className="font-semibold text-amber-300">Dica:</span> {theme.dica}
              </div>
            </div>

            {/* Editor - folha de redação */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider"> Sua Redação</span>
                  <span className="badge badge-gray">folha oficial</span>
                </div>
                <span className={`badge ${challengeWordCount >= 150 ? 'badge-emerald' : 'badge-red'}`}>
                  {challengeWordCount} palavras
                </span>
              </div>
              <textarea
                value={challengeText}
                onChange={e => setChallengeText(e.target.value)}
                disabled={challengeSubmitted}
                className="challenge-sheet flex-1 min-h-[220px] w-full rounded-2xl border border-white/5 bg-white/[0.02] p-4 pl-6 pr-6 resize-none text-[15px] leading-8 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/30 disabled:opacity-80"
                placeholder="Comece sua dissertação-argumentativa aqui. Use a coletânea e a dica como repertório..."
              />
              {/* Progresso de extensão */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-white/50 mb-1">
                  <span>Extensão atual: {challengeWordCount} / 300 palavras</span>
                  <span>{extensionPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all challenge-fill"
                    style={{
                      width: `${extensionPct}%`,
                      background: challengeWordCount >= 150
                        ? 'linear-gradient(90deg,#10b981,#34d399)'
                        : 'linear-gradient(90deg,#f59e0b,#fbbf24)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/40 mt-1">
                  {challengeWordCount < 150
                    ? `Faltam ${150 - challengeWordCount} palavras para o mínimo exigido pelo ENEM.`
                    : ' Mínimo do ENEM atingido! Continue para alcançar uma boa nota.'}
                </p>
              </div>
            </div>

            {/* Footer / resultado */}
            {challengeSubmitted ? (
              challengeIsCorrecting ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm text-gray-400">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Corrigindo redação como no ENEM...
                </div>
              ) : challengeCorrection ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex flex-col items-center mb-5">
                    <ScoreRing nota={challengeCorrection.notaFinal} />
                    <span className={`badge ${
                      challengeCorrection.notaFinal >= 700 ? 'badge-emerald' :
                      challengeCorrection.notaFinal >= 400 ? 'badge-amber' : 'badge-red'
                    }`}>
                      {getNotaLabel(challengeCorrection.notaFinal)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                    {competencias.map(c => {
                      const val = challengeCorrection[c.key];
                      return (
                        <div key={c.key} className="text-center rounded-lg bg-white/[0.03] border border-white/5 py-2 px-1">
                          <div className="text-[10px] text-gray-500 mb-1">{c.short}</div>
                          <div className="text-sm font-bold tabular-nums" style={{ color: getNotaColor(val * 5) }}>{val}</div>
                          <div className="text-[9px] text-gray-600">/200</div>
                        </div>
                      );
                    })}
                  </div>
                  {challengeCorrection.pontosMelhorar.length > 0 && (
                    <ul className="space-y-1 mb-4">
                      {challengeCorrection.pontosMelhorar.slice(0, 3).map((p, i) => (
                        <li key={i} className="text-xs text-amber-400/90 flex items-start gap-1.5">
                          <span>•</span>{p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => { exitChallenge(); startChallenge(); }} className="btn-primary w-full"> Novo Desafio
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <p className="text-sm text-gray-300 mb-4">
                    ⏱ <span className="text-white font-semibold">Tempo esgotado.</span>{' '}
                    {challengeWordCount >= 50 ? 'Sua redação foi corrigida.' : 'Você não escreveu uma redação com pelo menos 50 palavras a tempo.'}
                  </p>
                  <button onClick={() => { exitChallenge(); startChallenge(); }} className="btn-primary w-full"> Novo Desafio
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-between gap-3 py-4 mt-2 border-t border-white/5">
                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full status-dot-active" /> Enviado automaticamente ao fim do tempo.
                </span>
                <button
                  onClick={handleChallengeSubmit}
                  disabled={challengeText.trim().length < 50}
                  className="btn-primary shrink-0"
                > Enviar e Corrigir
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm exit (for accidental press) */}
      <Modal open={confirmExit} title="Sair do desafio?">
        <p className="text-sm text-gray-300 mb-5"> Se você sair agora, a redação em andamento será <span className="text-white font-semibold">perdida</span> e o cronômetro reiniciado.
          Tem certeza de que deseja voltar?
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmExit(false)} className="btn-secondary"> Continuar escrevendo
          </button>
          <button onClick={exitChallenge} className="btn-danger"> Sair do desafio
          </button>
        </div>
      </Modal>

      {/* ==== Tutorial / onboarding ==== */}
      <Modal open={showTutorial} title=" Como funciona o Modo Desafio">
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-sm text-gray-300"> Simule o dia da prova do ENEM. Você recebe um <span className="text-white font-semibold">tema aleatório</span>,
              um <span className="text-white font-semibold">repertório de apoio</span> e tem{' '}
              <span className="text-white font-semibold">3 horas</span> para escrever sua dissertação-argumentativa.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-xl mb-1"></div>
              <h3 className="text-xs font-semibold text-gray-300 mb-1">Tema surpresa</h3>
              <p className="text-xs text-gray-500">Sorteado sempre de forma aleatória, como na prova real.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-xl mb-1">⏱</div>
              <h3 className="text-xs font-semibold text-gray-300 mb-1">3 horas</h3>
              <p className="text-xs text-gray-500">Cronômetro regressivo. Envio automático ao fim do tempo.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-xl mb-1"><BookMarked size={16} className="inline-block align-[-0.15em] text-amber-400" /></div>
              <h3 className="text-xs font-semibold text-gray-300 mb-1">Repertório de apoio</h3>
              <p className="text-xs text-gray-500">Use a coletânea para embasar os seus argumentos: sua nota valoriza isso.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="text-xl mb-1"><PenLine size={16} className="inline-block align-[-0.15em] text-amber-400" /></div>
              <h3 className="text-xs font-semibold text-gray-300 mb-1">5 competências</h3>
              <p className="text-xs text-gray-500">Correção avalia norma culta, tema, argumentação, coesão e intervenção.</p>
            </div>
          </div>
          <div className="challenge-note rounded-xl bg-amber-500/[0.06] border border-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
            <span className="font-semibold text-amber-300">Importante:</span> se você sair no meio, a redação é perdida. Seu progresso é salvo no histórico ao finalizar.
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={() => { setShowTutorial(false); }} className="btn-ghost"> Talvez depois
          </button>
          <button onClick={finishTutorial} className="btn-primary"> Entendi, começar 
          </button>
        </div>
      </Modal>
    </div>
  );
}
