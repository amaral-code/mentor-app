import { useState, useRef, useEffect } from 'react';
import { SendHorizontal, Sparkles, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { StudyLeague, StudyLeagueMessage } from '../../shared/lib/ligasEngine';
import { postLeagueMessage } from '../../shared/lib/ligasEngine';

interface LeagueDetailProps {
  league: StudyLeague;
  onBack: () => void;
  onUpdateLeague: (updated: StudyLeague) => void;
}

function gerarId() { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function getNextChallengeUpdate(): { label: string; timestamp: number } {
  const now = Date.now();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return {
    label: `${hours}h ${minutes}m`,
    timestamp: tomorrow.getTime(),
  };
}

function generateDailyPrompt(league: StudyLeague): string {
  const prompts: Record<string, string[]> = {
    Português: [
      'Analise a crase no trecho: "Fui à escola" vs "Fui a escola". Explique a diferença.',
      'Identifique e classifique as figuras de linguagem no poema fornecido pelo líder.',
      'Produza um parágrafo dissertativo-argumentativo sobre o tema "O papel da leitura crítica na sociedade".',
    ],
    Matemática: [
      'Resolva: Em uma PA, o primeiro termo é 3 e a razão é 4. Qual a soma dos 10 primeiros termos?',
      'Calcule a probabilidade de obter exatamente duas caras no lançamento de 3 moedas.',
      'Determine o volume de um cilindro de raio 3 cm e altura 10 cm.',
    ],
    Física: [
      'Um carro de 1000 kg acelera de 0 a 20 m/s em 10 s. Qual a força resultante média?',
      'Calcule a resistência equivalente de dois resistores de 6 Ω em paralelo.',
      'Explique o princípio de conservação de energia em uma queda livre.',
    ],
    Química: [
      'Balanceie a equação: Fe + O₂  Fe₂O₃ e identifique o tipo de reação.',
      'Calcule o pH de uma solução de HCl 0,001 mol/L.',
      'Diferencie ligações iônicas, covalentes e metálicas com exemplos.',
    ],
    Biologia: [
      'Explique as etapas da fotossíntese: fase clara e fase escura.',
      'Descreva o processo de seleção natural segundo Darwin.',
      'Qual a diferença entre mitose e meiose? Explique cada uma.',
    ],
    História: [
      'Compare o fim do Brasil Império com o início da República. Quais as mudanças estruturais?',
      'Analise as causas e consequências da Revolução Francesa para o mundo ocidental.',
      'Explique o contexto da Era Vargas e suas principais realizações.',
    ],
  };
  const list = prompts[league.discipline] || [
    'Pesquise e compartilhe 3 fatos relevantes sobre o tema da semana.',
    'Produza um resumo colaborativo com seu grupo sobre o conteúdo atual.',
  ];
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % list.length;
  return list[dayIndex];
}

export function LeagueDetail({ league, onBack, onUpdateLeague }: LeagueDetailProps) {
  const { session, addXP, addLog } = useAppStore();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /* Cooldown do XP por mensagem (anti-farm): 60s por liga. */
  const ultimoXpLigaRef = useRef(0);

  const profile = session ? { uid: session.uid, nome: session.nome } : null;

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [league.messages?.length]);

  if (!league) return null;

  const timer = getNextChallengeUpdate();
  const dailyPrompt = generateDailyPrompt(league);

  /* Guarda real contra duplo-envio + anti-farm de XP: a mensagem sempre
     vai, mas o +5 XP só credita 1x a cada 60s por liga (spam não gera XP). */
  async function sendMessage() {
    if (!profile?.uid || !message.trim() || sending) return;
    setSending(true);
    try {
      const updated = postLeagueMessage(league, {
        id: gerarId(),
        userId: profile.uid,
        userName: profile.nome || 'Anônimo',
        text: message.trim(),
      });
      onUpdateLeague(updated);
      setMessage('');
      const agora = Date.now();
      if (agora - ultimoXpLigaRef.current >= 60_000) {
        ultimoXpLigaRef.current = agora;
        addXP(5);
        addLog({ timestamp: agora, type: 'atividade', description: `Mensagem na liga "${league.title}"`, xp: 5 });
      }
    } finally {
      setSending(false);
    }
  }

  const messages = league.messages || [];
  const goals = league.goals || [];
  const joinedByNames = league.joinedByNames || [];
  const participanteCount = joinedByNames.length;
  const progress = goals.length > 0
    ? Math.round((goals.filter(g => (g?.completedBy || []).includes(profile?.uid || '')).length / goals.length) * 100)
    : 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] md:h-[calc(100dvh-8rem)] animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/[0.04] transition-all text-gray-400 hover:text-white shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-white truncate">{league?.title || 'Sala'}</h1>
            <p className="text-xs text-gray-500">
              <Users size={12} className="inline mr-1" />
              {participanteCount} participante{participanteCount !== 1 ? 's' : ''} • {league?.escola || ''}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium shrink-0">{league?.discipline || ''}</span>
      </div>

      {/* Content: Chat + Challenge */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden min-h-0">
        {/* Chat Panel - WhatsApp style */}
        <div className="flex-1 flex flex-col glass rounded-2xl overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.04]">
            <h2 className="text-sm font-semibold text-white">Chat da Liga</h2>
            <span className="text-xs text-gray-500">{messages.length} mensagens</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-3 scroll-smooth">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500"> Nenhuma mensagem ainda. Seja o primeiro a contribuir!
              </div>
            ) : (
              messages.map(msg => {
                if (!msg) return null;
                const isSelf = msg.userId === profile?.uid;
                const isSystem = msg.type === 'system';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="bg-gray-200/10 text-gray-400 text-xs rounded-full px-4 py-1 text-center max-w-[85%]">
                        {msg.text?.includes('Entrou na liga') ? (
                          <span>Entrou na liga e passou a fazer parte do grupo. <strong className="text-gray-300">{msg.userName}</strong></span>
                        ) : msg.text}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isSelf ? 'self-end items-end' : 'self-start items-start'} max-w-[85%] md:max-w-[75%]`}>
                    <div className={`px-3.5 py-2 text-sm leading-relaxed ${
                      isSelf
                        ? 'bg-green-100 text-gray-800 rounded-lg rounded-br-none'
                        : 'bg-white/10 text-gray-200 rounded-lg rounded-bl-none'
                    }`}>
                      {!isSelf && (
                        <p className="text-[11px] font-bold text-gray-400 mb-0.5">{msg.userName}</p>
                      )}
                      <p>{msg.text}</p>
                    </div>
                    <p className={`text-[10px] text-gray-600 mt-0.5 px-1 ${isSelf ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex items-end gap-2 px-3 pt-2 pb-3 border-t border-white/[0.04] shrink-0">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={1}
              placeholder="Digite sua mensagem..."
              className="flex-1 resize-none bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-400/40 max-h-32 placeholder:text-gray-600 min-h-[44px]"
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              className="h-11 w-11 flex items-center justify-center rounded-full bg-emerald-500 text-white disabled:opacity-30 hover:brightness-110 transition-all shrink-0 shadow-lg shadow-emerald-500/20"
            >
              <SendHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Challenge Panel (side) */}
        <div className="lg:w-72 flex flex-col gap-3">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Desafio da Liga</h2>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed mb-3">{dailyPrompt}</p>
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Atualiza em</span>
                <span className="text-amber-400 font-bold tabular-nums">{timer?.label || ''}</span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${(1 - (Date.now() % 86400000) / 86400000) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-white">Metas</h2>
              <span className="text-xs text-gray-500">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="space-y-1.5">
              {goals.map(goal => {
                if (!goal) return null;
                const completed = (goal.completedBy || []).includes(profile?.uid || '');
                return (
                  <div key={goal.id} className={`rounded-lg border px-3 py-2 ${completed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs ${completed ? 'text-emerald-400 line-through' : 'text-gray-300'}`}>{goal.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${completed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                        {goal.target} {goal.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-3">
            <div className="flex -space-x-1.5">
              {joinedByNames.slice(0, 6).map((name, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[#0b1120]">
                  {(name || '?').charAt(0).toUpperCase()}
                </div>
              ))}
              {joinedByNames.length > 6 && (
                <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] text-gray-400 ring-2 ring-[#0b1120]">
                  +{joinedByNames.length - 6}
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">{participanteCount} participante{participanteCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
