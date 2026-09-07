import { useEffect, useMemo, useRef, useState } from 'react';
import { SendHorizontal, X } from 'lucide-react';
import { searchKB, matchSubject, extractKeywords, SPECIAL_RESPONSES, buildKBFromQuiz } from '../lib/kbSearch';
import { getEmpathicPrefix } from '../lib/emotionEngine';
import { QUIZ_BANK } from '../lib/quizBank';
import { ENEM_KB } from '../lib/kbEnem';
import { ultimaMateria } from '../lib/contextMemory';
import { useAppStore } from '../../stores/appStore';

const CHAT_KB = [...ENEM_KB, ...buildKBFromQuiz(QUIZ_BANK)];

const BOT_AVATAR = '/assets/sagui_acenando_2.png';
const TUTOR_AVATAR = '/assets/sagui_estudando_2.png';

function generateId() {
  return `_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getReply(raw: string): string {
  const lower = raw.trim().toLowerCase();
  for (const [key, response] of Object.entries(SPECIAL_RESPONSES)) {
    if (lower === key || lower.startsWith(key)) {
      const prefix = getEmpathicPrefix('neutral');
      return prefix ? `${prefix}\n\n${response}` : response;
    }
  }
  const match = searchKB(raw, CHAT_KB);
  if (match) {
    const prefix = getEmpathicPrefix('neutral');
    return prefix ? `${prefix}\n\n${match.entry.content}` : match.entry.content;
  }
  const subject = matchSubject(raw);
  if (subject) {
    const dicas: Record<string, string> = {
      Matemática: ' Pratique exercícios de lógica e revisão de fórmulas. Foco em razão, proporção e funções.',
      Português: ' Revise concordância verbal e nominal, regência e crase. Leia os enunciados com atenção.',
      História: ' Contextualize eventos em ordem cronológica. Destaque para Brasil Colônia, Império e Era Vargas.',
      Geografia: ' Questões de geografia política, ambiental e urbana são frequentes. Atente-se a mapas.',
      Biologia: ' Fisiologia humana, ecologia e genética são os temas mais cobrados.',
      Física: ' Mecânica, termologia e ondas são tópicos principais. Foco em interpretação de gráficos.',
      Química: ' Estequiometria, soluções e oxirredução são recorrentes. Pratique cálculos.',
      Filosofia: ' Conheça os principais filósofos e suas ideias centrais (Sócrates, Descartes, Nietzsche).',
      Inglês: '🇬🇧 Foco em interpretação de texto e vocabulário. Palavras cognatas ajudam muito.',
      Sociologia: ' Trabalho, cultura, cidadania e movimentos sociais são temas frequentes.',
    };
    const prefix = getEmpathicPrefix('neutral');
    return prefix ? `${prefix}\n\n${dicas[subject] || `Sobre ${subject}: revise os fundamentos e pratique questões.`}` : (dicas[subject] || `Sobre ${subject}: revise os fundamentos e pratique questões.`);
  }
  const kw = extractKeywords(raw);
  const prefix = getEmpathicPrefix('neutral');
  const fallback = `Hmm, não encontrei informações sobre "${kw.join(', ') || 'isso'}" na minha base local.  Tente reformular sua pergunta!`;
  return prefix ? `${prefix}\n\n${fallback}` : fallback;
}

const SUGGESTIONS = ['Como estudar para o ENEM?', 'O que é a TRI?', 'Dicas de redação', 'Estou cansado'];

type ChatMessage = { id: string; from: 'user' | 'bot'; text: string };

export function AssistantWidget() {
  /* Mesma regra do chat: a materia sai do historico real, e quando nao ha
     historico o texto convida em vez de inventar um assunto. */
  const quizResults = useAppStore(st => st.quizResults);
  const logs = useAppStore(st => st.logs);
  const materiaRetomada = useMemo(
    () => ultimaMateria({ quizResults, logs }),
    [quizResults, logs],
  );
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const msgCount = messages.length;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, open, msgCount]);

  useEffect(() => {
    if (open && window.matchMedia('(max-width: 767px)').matches) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  function send(text: string) {
    const t = (text || '').trim();
    if (!t) return;
    setMessages((prev) => [...prev, { id: generateId(), from: 'user', text: t }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: generateId(), from: 'bot', text: getReply(t) }]);
      setTyping(false);
    }, 700);
  }

  return (
    <div className="relative w-full">
      {/* Botão do Sagui (avatar padrão: sagui meditando) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`assistant-bot flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-200 border ${
          open ? 'bg-amber-500/10 border-amber-500/30' : 'hover:bg-white/[0.03] border-transparent'
        }`}
        aria-expanded={open}
        aria-label="Abrir assistente do Sagui"
      >
        <div className="relative w-11 h-11 shrink-0">
          <img
            src={BOT_AVATAR}
            alt="Sagui assistente"
            draggable={false}
            className="w-full h-full object-contain mascot-assist-idle"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0b1120]" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-white">Sagui Assistente</p>
          <p className="text-[10px] text-gray-500 truncate">Pergunte sobre o ENEM</p>
        </div>
        <span className="text-xs text-gray-500">{open ? '▾' : '▸'}</span>
      </button>

      {/* Chat: desktop = balão ancorado · mobile = overlay quase tela inteira */}
      {open && (
        <>
          {/* Backdrop só no mobile */}
          <div className="md:hidden fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="assistant-chat flex flex-col overflow-hidden fixed inset-0 z-[999] md:absolute md:inset-auto md:left-0 md:right-0 md:top-[calc(100%+10px)] md:z-30 md:w-[400px] md:h-[600px] md:max-h-[80vh] md:rounded-2xl md:border md:border-white/10 md:glass md:shadow-2xl bg-[#0d1424]/98">
            {/* Cabeçalho com avatar de tutoria */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06] bg-white/[0.03] shrink-0">
              <img src={TUTOR_AVATAR} alt="Sagui tutor" className="w-9 h-9 rounded-xl object-cover border border-white/10" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Sagui Assistente</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online · tutor ENEM
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all text-lg"
                aria-label="Fechar chat"
                title="Fechar chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <img src={TUTOR_AVATAR} alt="" className="w-16 h-16 object-cover rounded-2xl mx-auto mb-3" />
                  <p className="text-sm text-gray-300">Olá! Sou o Sagui do Midnight Mentor </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {materiaRetomada ? (
                      <>
                        Retomamos seu estudo em{' '}
                        <span className="text-emerald-400 font-medium">{materiaRetomada}</span>. Pergunte sobre dúvidas, matérias ou o ENEM.
                      </>
                    ) : (
                      <>Pergunte sobre dúvidas, matérias ou o ENEM. Eu começo de onde você quiser.</>
                    )}
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex items-end gap-2.5 ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.from === 'bot' && (
                    <img src={TUTOR_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                  )}
                  <span
                    className={`max-w-[80%] md:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line ${
                      m.from === 'user'
                        ? 'bg-amber-500/15 text-amber-100 rounded-br-sm'
                        : 'bg-white/[0.07] text-gray-100 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
              {typing && (
                <div className="flex items-end gap-2.5 justify-start">
                  <img src={TUTOR_AVATAR} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0" />
                  <span className="bg-white/[0.07] px-4 py-2.5 rounded-2xl text-xs text-gray-400">sagui digitando…</span>
                </div>
              )}
            </div>

            {/* Sugestões */}
            <div className="shrink-0 px-4 pb-2 pt-1 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full bg-white/[0.06] text-gray-300 hover:bg-amber-500/10 hover:text-amber-300 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Campo de digitação */}
            <form
              className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06] bg-white/[0.02] pb-[max(0.625rem,env(safe-area-inset-bottom))]"
              onSubmit={(e) => { e.preventDefault(); send(input); }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escreva sua dúvida…"
                enterKeyHint="send"
                className="flex-1 min-w-0 bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-400/50"
              />
              <button
                type="submit"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-gray-900 font-bold text-base hover:brightness-110 transition-all shrink-0"
                aria-label="Enviar"
              >
                <SendHorizontal size={17} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}