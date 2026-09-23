import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanelRightOpen } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useAppStore } from '../../stores/appStore';
import { searchKB, matchSubject, extractKeywords, SPECIAL_RESPONSES, buildKBFromQuiz } from '../../shared/lib/kbSearch';
import { getEmpathicPrefix } from '../../shared/lib/emotionEngine';
import { QUIZ_BANK } from '../../shared/lib/quizBank';
import { ENEM_KB } from '../../shared/lib/kbEnem';
import { sendMessageToGemini, aiAvailable } from '../../shared/lib/aiService';
import { isCancelamentoUsuario } from '../../shared/lib/aiProvider';
import { safeGet, safeSet } from '../../shared/lib/safeStorage';
import {
  MODO_PADRAO,
  conversarComMentor,
} from '../../shared/lib/chatGrounding';
import { ChatMessage, ChatPersona } from '../../shared/types';
import { playClick, speak, stopSpeech } from '../../shared/lib/sfx';
import { buildContextGreeting, ultimaMateria } from '../../shared/lib/contextMemory';
import { PersonaManager } from '../../shared/ui/PersonaManager';
import { FocusAnchorOverlay } from './components/FocusAnchorOverlay';
import { TeamProgressBanner } from './components/TeamProgressBanner';
import { ConsciousPauseModal } from './components/ConsciousPauseModal';
import { extrairFrustracao, heuristicaFrustracao } from '../../shared/lib/frustration';
import { OcrUploader } from './components/OcrUploader';
import { ChatHeader, type AbaMentor } from './components/ChatHeader';
import { HeroWelcome } from './components/HeroWelcome';
import { ChatMessages } from './components/ChatMessages';
import { PremiumInput, type ModoRespostaUI } from './components/PremiumInput';
import { HistoryPanel } from './components/HistoryPanel';

const QUIZ_KB = buildKBFromQuiz(QUIZ_BANK);
const ALL_KB = [...ENEM_KB, ...QUIZ_KB];

function generateId() { return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

function getBotReply(userMessage: string, mood: string, persona: ChatPersona | null): string {
  const lower = userMessage.trim().toLowerCase();
  const isMentor = !persona || persona.id === 'mentor_enem';
  for (const [key, response] of Object.entries(SPECIAL_RESPONSES)) {
    if (lower === key || lower.startsWith(key)) {
      const prefix = getEmpathicPrefix(mood as any);
      return prefix ? `${prefix}\n\n${response}` : response;
    }
  }
  const match = searchKB(userMessage, ALL_KB);
  if (match) {
    const prefix = getEmpathicPrefix(mood as any);
    return prefix ? `${prefix}\n\n${match.entry.content}` : match.entry.content;
  }
  const subject = matchSubject(userMessage);
  if (isMentor && subject) {
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
    const prefix = getEmpathicPrefix(mood as any);
    return prefix ? `${prefix}\n\n${dicas[subject] || `Sobre ${subject}: revise os fundamentos e pratique questões.`}` : (dicas[subject] || `Sobre ${subject}: revise os fundamentos e pratique questões.`);
  }
  const keywords = extractKeywords(userMessage);
  const prefix = getEmpathicPrefix(mood as any);
  if (persona && !isMentor) {
    const especialidade = persona.escopo ?? persona.name;
    const fallback = `Não encontrei informações específicas sobre "${keywords.join(', ') || 'isso'}" na minha base local. Minha especialidade é ${especialidade}. Que tal reformular dentro dessa área?`;
    return prefix ? `${prefix}\n\n${fallback}` : fallback;
  }
  const fallback = `Hmm, não encontrei informações sobre "${keywords.join(', ') || 'isso'}" na minha base local.  Tente reformular sua pergunta ou explore as seções Quiz, Redação e Caderno de Estudos!`;
  return prefix ? `${prefix}\n\n${fallback}` : fallback;
}

/**
 * Modo temático -> professor embutido (modo manda, persona acompanha).
 * Persona criada pelo usuário continua no comando dela mesma.
 */
const PERSONA_DO_MODO: Record<string, string> = {
  enem_geral: 'mentor_enem',
  exatas: 'prof_matematica',
  natureza: 'prof_ciencias',
  humanas: 'prof_humanas',
  vestibulares: 'mentor_enem',
};

/* Abas da barra segmentada (protótipo: Geral, Exatas, Linguagens,
   Natureza). Cada aba fixa MODO + PROFESSOR juntos. Linguagens usa o
   backend de Humanas; a voz é a do Prof. Português. */
const ABAS_MENTOR = [
  { id: 'geral', label: 'Geral', modo: 'enem_geral', persona: 'mentor_enem', desc: 'Especialista TRI, redação e estratégia global' },
  { id: 'exatas', label: 'Exatas', modo: 'exatas', persona: 'prof_matematica', desc: 'Mestre em Funções, Geometria e Macetes Rápidos' },
  { id: 'linguagens', label: 'Linguagens', modo: 'humanas', persona: 'prof_portugues', desc: 'Especialista em Redação Nota 1000 e Interpretação' },
  { id: 'natureza', label: 'Natureza', modo: 'natureza', persona: 'prof_ciencias', desc: 'Física, Química e Biologia interdisciplinar' },
] as const;

const PERSONAS_EMBUTIDAS = [...Object.values(PERSONA_DO_MODO), 'prof_portugues'];
/* Linguagens fala com a voz do Prof. Português (backend de Humanas cobre a
   área): ele é persona embutida, NÃO customizada — sem isso a abaAtiva caía
   de volta para Geral ao clicar em Linguagens. */
const CHAVE_MODO = 'mm_modo_chat';
const CHAVE_MODO_RESPOSTA = 'mm_modo_resposta';
const CHAVE_HISTORICO_ABERTO = 'mm_historico_aberto';
/** EPICO 2: pausa no maximo 1x a cada 10min (anti-nagging, sem vigilancia). */
const CHAVE_PAUSA_ULTIMA = 'mm_pausa_ultima';
const PAUSA_INTERVALO_MS = 10 * 60 * 1000;
/** Modo Sala de Aula: persiste entre sessoes neste aparelho. */
const CHAVE_MODO_AULA = 'mm_modo_aula';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 128) + 'px';
}

export function ChatPage() {
  // Seletores atomicos: assinar o store inteiro aqui (como era antes)
  // re-renderizava a pagina TODA a cada mensagem, toast, XP ou humor —
  // incluindo re-parse de todas as mensagens e remediacao dos gliders.
  // Cada linha abaixo so re-renderiza quando o proprio fatia muda.
  const chatMessages = useAppStore((s) => s.chatMessages);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const detectAndSetMood = useAppStore((s) => s.detectAndSetMood);
  const isMuted = useAppStore((s) => s.isMuted);
  const setIsMuted = useAppStore((s) => s.setIsMuted);
  const addNota = useAppStore((s) => s.addNota);
  const setToast = useAppStore((s) => s.setToast);
  const personas = useAppStore((s) => s.personas);
  const activePersonaId = useAppStore((s) => s.activePersonaId);
  const setActivePersonaId = useAppStore((s) => s.setActivePersonaId);
  const setShowPersonaManager = useAppStore((s) => s.setShowPersonaManager);
  const apiKey = useAppStore((s) => s.apiKey);
  const quizResults = useAppStore((s) => s.quizResults);
  const logs = useAppStore((s) => s.logs);
  const session = useAppStore((s) => s.session);
  const [input, setInput] = useState('');
  // Espelho mutavel do input: handlers memorizados (Enter, enviar) leem o
  // valor atual sem depender do estado — sem isso, cada tecla criaria
  // novos callbacks e anularia o memo do PremiumInput.
  const inputValorRef = useRef('');
  const definirInput = useCallback((v: string) => {
    inputValorRef.current = v;
    setInput(v);
  }, []);
  const [modo, setModo] = useState<string>(() => {
    const salvo = safeGet(CHAVE_MODO) || MODO_PADRAO;
    return ABAS_MENTOR.some((t) => t.modo === salvo) ? salvo : MODO_PADRAO;
  });
  const [modoResposta, setModoResposta] = useState<ModoRespostaUI>(() =>
    safeGet(CHAVE_MODO_RESPOSTA) === 'comunicativo' ? 'comunicativo' : 'explicativo',
  );
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<boolean>(() =>
    safeGet(CHAVE_HISTORICO_ABERTO) !== '0',
  );
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [criandoConversa, setCriandoConversa] = useState(false);
  const [trocandoConversaId, setTrocandoConversaId] = useState<string | null>(null);
  const [apagandoConversaId, setApagandoConversaId] = useState<string | null>(null);
  const [confirmarApagarId, setConfirmarApagarId] = useState<string | null>(null);
  /* Streaming da resposta: texto parcial renderizado no balão do Mentor. */
  const [streamingText, setStreamingText] = useState<string | null>(null);
  /* EPICO 2: modal de pausa consciente (flag frustration_detected). */
  const [pausaAberta, setPausaAberta] = useState(false);
  /* Modo Sala de Aula (todos os turnos) + Ancora de Foco (pomodoro). */
  const [modoAula, setModoAula] = useState(() => safeGet(CHAVE_MODO_AULA) === '1');
  const [focoAberto, setFocoAberto] = useState(false);

  const alternarModoAula = useCallback(() => {
    playClick();
    setModoAula((v) => {
      safeSet(CHAVE_MODO_AULA, v ? '0' : '1');
      return !v;
    });
  }, []);

  const pedirPausa = useCallback(() => {
    const ultima = Number(safeGet(CHAVE_PAUSA_ULTIMA) || 0);
    if (Date.now() - ultima < PAUSA_INTERVALO_MS) return;
    safeSet(CHAVE_PAUSA_ULTIMA, String(Date.now()));
    setPausaAberta(true);
  }, []);
  /* Flash neon da borda ao preencher via card (input-flash do protótipo). */
  const [flashKey, setFlashKey] = useState(0);
  const conversaAtivaId = useAppStore((s) => s.conversaAtivaId);
  const conversas = useAppStore((s) => s.conversas);

  const trocarModoResposta = useCallback((m: ModoRespostaUI) => {
    playClick();
    setModoResposta(m);
    safeSet(CHAVE_MODO_RESPOSTA, m);
  }, []);

  const alternarHistorico = useCallback(() => {
    playClick();
    setHistoricoAberto((v) => {
      safeSet(CHAVE_HISTORICO_ABERTO, v ? '0' : '1');
      return !v;
    });
  }, []);

  // Estavel na pratica: so troca de identidade durante a criacao em si,
  // quando o botao ja esta desabilitado pelo proprio `criando`.
  const criarConversa = useCallback(async () => {
    if (criandoConversa) return;
    playClick();
    setCriandoConversa(true);
    try {
      await useAppStore.getState().novaConversa();
    } finally {
      setCriandoConversa(false);
    }
  }, [criandoConversa]);

  // Guarda de troca em curso (ref, nao estado): evita dois toques rapidos
  // dispararem selecionarConversa em paralelo sem re-renderizar por isso.
  const trocandoRef = useRef<string | null>(null);
  const trocarConversa = useCallback(async (id: string) => {
    if (trocandoRef.current || useAppStore.getState().conversaAtivaId === id) return;
    playClick();
    trocandoRef.current = id;
    setTrocandoConversaId(id);
    try {
      await useAppStore.getState().selecionarConversa(id);
    } finally {
      trocandoRef.current = null;
      setTrocandoConversaId(null);
    }
  }, []);

  const apagarConversa = useCallback(async (id: string) => {
    if (confirmarApagarId !== id) {
      setConfirmarApagarId(id);
      window.setTimeout(() => {
        setConfirmarApagarId((atual) => (atual === id ? null : atual));
      }, 4000);
      return;
    }
    setConfirmarApagarId(null);
    if (apagandoConversaId) return;
    setApagandoConversaId(id);
    try {
      await useAppStore.getState().apagarConversa(id);
    } finally {
      setApagandoConversaId(null);
    }
  }, [confirmarApagarId, apagandoConversaId]);

  const chatAreaRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<number | null>(null);
  /* Id da requisição em voo: troca de conversa ou novo envio invalida a
     anterior, para a resposta nunca cair na thread errada nem travar. */
  const requisicaoIdRef = useRef(0);
  const isGeneratingRef = useRef(false);

  const activePersona = useMemo(() => personas.find(p => p.id === activePersonaId) || null, [personas, activePersonaId]);
  const personaCustomizada = useMemo(
    () => (activePersona && !PERSONAS_EMBUTIDAS.includes(activePersona.id) ? activePersona : null),
    [activePersona],
  );
  const trocarModo = useCallback((id: string) => {
    setModo(id);
    safeSet(CHAVE_MODO, id);
    setActivePersonaId(PERSONA_DO_MODO[id] ?? 'mentor_enem');
  }, [setActivePersonaId]);

  const trocarAbaMentor = useCallback((aba: AbaMentor) => {
    playClick();
    const original = ABAS_MENTOR.find((t) => t.id === aba.id);
    if (!original) return;
    trocarModo(original.modo);
    setActivePersonaId(original.persona);
  }, [trocarModo, setActivePersonaId]);

  const abaAtiva = ABAS_MENTOR.find((t) => t.modo === modo && !personaCustomizada) ?? ABAS_MENTOR[0];

  /* Glider das abas (protótipo: updateGliderPosition via getBoundingClientRect). */
  const topicTabsRef = useRef<HTMLDivElement>(null);
  const topicBtnRefs = useRef(new Map<string, HTMLButtonElement>());
  const [topicPill, setTopicPill] = useState({ left: 0, width: 0 });

  const registrarBotaoAba = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) topicBtnRefs.current.set(id, el);
    else topicBtnRefs.current.delete(id);
  }, []);

  const atualizarTopicPill = useCallback(() => {
    const cont = topicTabsRef.current;
    const el = topicBtnRefs.current.get(abaAtiva.id);
    if (!cont || !el) return;
    const c = cont.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTopicPill({ left: r.left - c.left, width: r.width });
  }, [abaAtiva.id]);

  /* Pílula do modo Explicativo/Comunicativo (mesma técnica do glider). */
  const modeContainerRef = useRef<HTMLDivElement>(null);
  const modeBtnRefs = useRef(new Map<string, HTMLButtonElement>());
  const [modePill, setModePill] = useState({ left: 0, width: 0 });

  const registrarBotaoModo = useCallback((id: ModoRespostaUI, el: HTMLButtonElement | null) => {
    if (el) modeBtnRefs.current.set(id, el);
    else modeBtnRefs.current.delete(id);
  }, []);

  const atualizarModePill = useCallback(() => {
    const cont = modeContainerRef.current;
    const el = modeBtnRefs.current.get(modoResposta);
    if (!cont || !el) return;
    const c = cont.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setModePill({ left: r.left - c.left, width: r.width });
  }, [modoResposta]);

  useLayoutEffect(() => {
    const medir = () => { atualizarTopicPill(); atualizarModePill(); };
    const t = window.setTimeout(medir, 150);
    /* A webfont (Plus Jakarta Sans) troca a largura dos rótulos depois da
       primeira pintura: remede após o load da fonte e em 2 frames para o
       glider e a pílula nascerem já no lugar certo. */
    const raf = window.requestAnimationFrame(() => window.requestAnimationFrame(medir));
    if (document.fonts) {
      document.fonts.ready.then(medir).catch(() => {});
    }
    window.addEventListener('resize', atualizarTopicPill);
    window.addEventListener('resize', atualizarModePill);
    /* No mobile as abas rolam na horizontal: o glider é absoluto e não
       acompanha o scroll sozinho, então remede a cada rolagem. */
    const tabsEl = topicTabsRef.current;
    tabsEl?.addEventListener('scroll', atualizarTopicPill, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', atualizarTopicPill);
      window.removeEventListener('resize', atualizarModePill);
      tabsEl?.removeEventListener('scroll', atualizarTopicPill);
    };
  }, [atualizarTopicPill, atualizarModePill]);

  const tituloMentor = personaCustomizada
    ? (activePersona?.name ?? 'Mentor')
    : abaAtiva.id === 'geral' ? 'Mentor ENEM' : `Mentor ${abaAtiva.label}`;
  const descMentor = personaCustomizada
    ? (activePersona?.instruction ?? '')
    : abaAtiva.desc;
  const tituloBoasVindas = 'Fale com Mentor ENEM';
  const subtituloBoasVindas = `${abaAtiva.desc}. Peça macetes, resolução de questões ou cronogramas focados.`;

  const materiaRetomada = useMemo(
    () => ultimaMateria({ quizResults, logs, persona: activePersona }),
    [quizResults, logs, activePersona],
  );

  function rolarParaFim(suave = false) {
    const area = chatAreaRef.current;
    if (!area) return;
    if (suave) area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
    else area.scrollTop = area.scrollHeight;
  }

  useEffect(() => { rolarParaFim(true); }, [chatMessages]);

  const saudacaoEnviada = useRef(false);

  useEffect(() => {
    if (chatMessages.length === 0 && !saudacaoEnviada.current) {
      saudacaoEnviada.current = true;
      const greeting: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        text: buildContextGreeting(materiaRetomada),
        timestamp: Date.now(),
      };
      addChatMessage(greeting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inputRef.current) autoResize(inputRef.current);
  }, [input]);

  useEffect(() => () => {
    // Desmonte invalida a requisição: o intervalo é limpo e a resposta em
    // voo é salva sem animação (ver handleSend), nunca perdida em silêncio.
    requisicaoIdRef.current += 1;
    if (streamTimerRef.current !== null) window.clearInterval(streamTimerRef.current);
    if (typingRef.current !== null) window.clearInterval(typingRef.current);
    abortRef.current?.abort();
  }, []);

  /* Troca de conversa no meio do streaming: cancela a animação da thread
     antiga sem travar o envio (isGenerating volta a false). A resposta em
     voo é salva na thread de origem pelo addChatMessage com conversaId. */
  useEffect(() => {
    requisicaoIdRef.current += 1;
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setStreamingText(null);
    isGeneratingRef.current = false;
    setIsGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversaAtivaId]);

  /**
   * Streaming da resposta no balão do Mentor: revela a resposta pronta em
   * palavras (o backend devolve o texto fechado) e só commita no store ao
   * final — mesma estrutura HTML do protótipo durante todo o efeito.
   * O `requisicaoId` invalida a animação se outra requisição ou troca de
   * conversa acontecer no meio: sem isso o commit ia para a thread errada
   * e o isGenerating ficava preso em true (causa principal do "não
   * aparece resposta" nos envios seguintes).
   */
  function revelarStreaming(textoCheio: string, requisicaoId: number, aoConcluir: () => void) {
    if (streamTimerRef.current !== null) window.clearInterval(streamTimerRef.current);
    const palavras = textoCheio.split(/(\s+)/);
    let i = 0;
    setStreamingText('');
    streamTimerRef.current = window.setInterval(() => {
      if (requisicaoId !== requisicaoIdRef.current) {
        if (streamTimerRef.current !== null) window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        return;
      }
      i += 4;
      const parcial = palavras.slice(0, i).join('');
      setStreamingText(parcial);
      rolarParaFim();
      if (i >= palavras.length) {
        if (streamTimerRef.current !== null) window.clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setStreamingText(null);
        aoConcluir();
      }
    }, 24);
  }

  const handleSend = useCallback(async (text: string, image?: string) => {
    if (!text.trim() && !image) return;
    // Antes: return silencioso — o aluno clicava e nada acontecia, sem
    // "digitando", sem toast, parecendo bug de resposta sumida.
    if (isGeneratingRef.current) {
      setToast('Aguarde a resposta atual terminar…', 'info');
      return;
    }
    playClick();
    isGeneratingRef.current = true;
    const requisicaoId = ++requisicaoIdRef.current;
    const conversaIdNoEnvio = useAppStore.getState().conversaAtivaId;
    const userMsg: ChatMessage = { id: generateId(), role: 'user', text: text.trim(), timestamp: Date.now(), image };
    addChatMessage(userMsg, conversaIdNoEnvio);
    definirInput('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }
    window.setTimeout(() => rolarParaFim(), 30);
    // Histórico lido do store na hora (sem closure stale do useCallback).
    const montarHistorico = () =>
      useAppStore.getState().chatMessages.map(m => ({
        role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text || (m.image ? '[Anexo de imagem]' : ''),
      }));
    // EPICO 2: ligado pela flag do modelo OU pela heuristica local; o modal
    // abre apos a resposta commitar (nunca cobre o streaming).
    let abrirPausaApos = false;
    const finalizar = (msg: ChatMessage, falar = true) => {
      // Resposta que chegou após troca de conversa/novo envio: salva na
      // thread de origem (banco) sem poluir a tela atual e sem animação.
      if (requisicaoId !== requisicaoIdRef.current) {
        useAppStore.getState().addChatMessage(msg, conversaIdNoEnvio);
        return;
      }
      revelarStreaming(msg.text, requisicaoId, () => {
        if (requisicaoId !== requisicaoIdRef.current) return;
        useAppStore.getState().addChatMessage(msg, conversaIdNoEnvio);
        rolarParaFim(true);
        if (falar && !useAppStore.getState().isMuted) { stopSpeech(); speak(msg.text); }
        isGeneratingRef.current = false;
        setIsGenerating(false);
        if (abrirPausaApos) {
          abrirPausaApos = false;
          pedirPausa();
        }
      });
    };
    const falharComFallback = (motivo: string, textoOriginal: string, moodAtual: string) => {
      if (requisicaoId !== requisicaoIdRef.current) return;
      setStreamingText(null);
      setToast(motivo, 'error');
      const fallback = getBotReply(textoOriginal, moodAtual, useAppStore.getState().personas.find(p => p.id === useAppStore.getState().activePersonaId) || null);
      finalizar({
        id: generateId(), role: 'assistant', text: fallback, timestamp: Date.now(),
        mood: moodAtual as ChatMessage['mood'], modoResposta,
      }, false);
    };
    const mood = await detectAndSetMood(text);

    if (aiAvailable(apiKey)) {
      setIsGenerating(true);
      try {
        abortRef.current = new AbortController();
        const history = montarHistorico();

        let reply: string;
        let extras: Partial<ChatMessage> = {};
        if (personaCustomizada || image) {
          const bruto = await sendMessageToGemini(
            text || (image ? 'Analise esta imagem de estudo' : 'Olá!'),
            { apiKey, persona: activePersona, history, imageBase64: image, signal: abortRef.current.signal, modoResposta },
          );
          // EPICO 2: remove o bloco `frustracao` antes de exibir; sobra a flag.
          const sinal = extrairFrustracao(bruto);
          reply = sinal.textoLimpo || bruto;
          abrirPausaApos = sinal.frustrationDetected;
        } else {
          const resposta = await conversarComMentor({
            modo,
            mensagens: [...history, { role: 'user', text: text || 'Olá!' }],
            apiKey,
            materiaRecente: materiaRetomada || undefined,
            modoResposta,
            signal: abortRef.current.signal,
          });
          reply = resposta.texto;
          abrirPausaApos = resposta.frustrationDetected;
          extras = {
            fontes: resposta.fontes,
            groundingUsado: resposta.groundingUsado,
            citouProva: resposta.citouProva,
            modoChat: resposta.modo,
          };
        }
        // EPICO 2 (fallback sem IA): curtas repetitivas/desistencia no
        // historico recente tambem pedem a pausa, mesmo sem a flag.
        if (!abrirPausaApos) {
          const falasAluno = history.filter((h) => h.role === 'user').map((h) => h.text);
          abrirPausaApos = heuristicaFrustracao([...falasAluno, text]);
        }
        if (!reply?.trim()) throw new Error('A IA devolveu uma resposta vazia. Tente de novo com outras palavras.');

        const botMsg: ChatMessage = {
          id: generateId(), role: 'assistant', text: reply.trim(), timestamp: Date.now(), mood,
          modoResposta, ...extras,
        };
        finalizar(botMsg);
      } catch (err: any) {
        // Cancelamento explícito do usuário: sem toast de erro e sem
        // fallback (o usuário interrompeu de propósito). Timeout/erro de
        // rede: toast + fallback local para a resposta SEMPRE aparecer.
        if (isCancelamentoUsuario(err, abortRef.current?.signal)) {
          if (requisicaoId === requisicaoIdRef.current) {
            setStreamingText(null);
            isGeneratingRef.current = false;
            setIsGenerating(false);
          }
          return;
        }
        falharComFallback(err?.message || 'Erro ao conectar com a IA. Usando modo local.', text, mood);
      }
    } else {
      setIsGenerating(true);
      window.setTimeout(() => {
        if (requisicaoId !== requisicaoIdRef.current) return;
        const reply = getBotReply(text, mood, activePersona);
        finalizar({ id: generateId(), role: 'assistant', text: reply, timestamp: Date.now(), mood, modoResposta }, false);
      }, 400 + Math.random() * 600);
    }
  }, [addChatMessage, detectAndSetMood, activePersona, apiKey, modo, modoResposta, personaCustomizada, materiaRetomada, setToast, pedirPausa, definirInput]);

  /* Ctrl/Cmd+Enter envia; Enter sozinho quebra linha (spec da barra). */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend(inputValorRef.current);
    }
  }, [handleSend]);

  // Estaveis entre renders: durante o streaming o pai atualiza 40x/s e o
  // PremiumInput memorizado pula todos esses renders.
  const aoMudarInput = useCallback((v: string) => {
    definirInput(v);
    if (inputRef.current) autoResize(inputRef.current);
  }, [definirInput]);

  const enviarAtual = useCallback(() => {
    void handleSend(inputValorRef.current);
  }, [handleSend]);

  /* Digitação do prompt no input (protótipo: fillPrompt + flash neon). */
  const typingRef = useRef<number | null>(null);

  const insertPrompt = useCallback((prompt: string) => {
    playClick();
    if (typingRef.current !== null) window.clearInterval(typingRef.current);
    definirInput('');
    setFlashKey((k) => k + 1);
    inputRef.current?.focus();
    let i = 0;
    typingRef.current = window.setInterval(() => {
      if (i < prompt.length) {
        i++;
        definirInput(prompt.slice(0, i));
        if (inputRef.current) inputRef.current.scrollTop = inputRef.current.scrollHeight;
      } else if (typingRef.current !== null) {
        window.clearInterval(typingRef.current);
        typingRef.current = null;
      }
    }, 12);
  }, [definirInput]);

  const handleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setToast('Reconhecimento de voz não disponível', 'error');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      definirInput(transcript);
      setIsListening(false);
      void handleSend(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }, [isListening, setToast, definirInput, handleSend]);

  const handleFileCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Mesmo allowlist da redação: SVG vetado, só foto real.
    const MIMES_CHAT = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!MIMES_CHAT.includes(file.type)) {
      setToast('Formato não aceito. Use JPG ou PNG.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast('Imagem muito grande. Máximo 5MB.', 'error');
      return;
    }
    try {
      // Comprime no cliente (Web Worker, sem travar a UI) ANTES do base64:
      // foto de 5MB virava string de ~6,7MB no store, pesando render,
      // memoria e upload. Fallback: original.
      let foto = file;
      try {
        foto = await imageCompression(file, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });
      } catch {
        foto = file;
      }
      const base64 = await readFileAsBase64(foto);
      void handleSend(inputValorRef.current, base64);
    } catch {
      setToast('Erro ao carregar imagem', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setToast, handleSend]);

  const saveToNotebook = useCallback((msg: ChatMessage) => {
    const text = msg.image ? `[Imagem] ${msg.text || 'Foto de lição'}` : msg.text;
    addNota({ id: `tmp_${Date.now()}`, text, data: new Date().toISOString(), tag: 'chat' });
    setToast('Salva no Caderno!', 'success');
  }, [addNota, setToast]);

  // Callbacks estaveis do header: sem eles, o ChatHeader memorizado
  // re-renderizaria a cada tecla/tick por causa de closures novas.
  const abrirFoco = useCallback(() => { playClick(); setFocoAberto(true); }, []);
  const alternarMute = useCallback(() => {
    const mutado = !useAppStore.getState().isMuted;
    setIsMuted(mutado);
    if (mutado) stopSpeech();
  }, [setIsMuted]);
  const abrirPersonas = useCallback(() => setShowPersonaManager(true), [setShowPersonaManager]);
  const abrirCamera = useCallback(() => fileInputRef.current?.click(), []);
  const aoTranscritoModoAula = useCallback((t: string) => {
    definirInput(t);
    setFlashKey((k) => k + 1);
    setToast('Caderno digitalizado! Toque em Modo Aula para voltar ao chat e enviar.', 'success');
  }, [definirInput, setToast]);
  const aoTranscritoChat = useCallback((t: string) => {
    insertPrompt(t);
    setToast('Caderno digitalizado! Revise e envie.', 'success');
  }, [insertPrompt, setToast]);
  const aoErroOcr = useCallback((m: string) => setToast(m, 'error'), [setToast]);

  const userInicial = (session?.nome?.charAt(0)?.toUpperCase()) || 'M';
  const vazio = chatMessages.length === 0;

  /*
   * A altura desconta EXATAMENTE o respiro que o <main> do AppShell reserva
   * no mobile: 5rem para o header fixo + 0.5rem embaixo, mais as duas
   * safe-areas. O valor antigo era um 6rem fixo, que ignorava os insets —
   * num iPhone com notch o workspace do Mentor passava da viewport e a barra
   * de digitar ficava abaixo da dobra.
   */
  return (
    <div className="flex gap-2 md:gap-3 h-[calc(100dvh-5.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] md:h-[calc(100dvh-2rem)] animate-fade-up relative">
      {historicoAberto && (
        <button
          aria-hidden="true"
          tabIndex={-1}
          onClick={alternarHistorico}
          className="md:hidden absolute inset-0 z-20 bg-black/50 backdrop-blur-[1px]"
        />
      )}

      {/* Workspace do Mentor (protótipo: <main data-purpose="mentor-chat-workspace">).
          A sidebar global do AppShell cobre a #sidebarNav do protótipo
          (mesmos links, card Sagui e XP — com dados reais). */}
      <div
        className="flex-1 flex flex-col min-w-0 relative overflow-hidden rounded-2xl bg-[#060913] border border-white/10"
        data-purpose="mentor-chat-workspace"
      >
        {/* Atmosfera cósmica */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-20 left-[22%] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-amber-500/22 via-amber-600/12 to-transparent blur-[100px] animate-orb-1" />
          <div className="absolute top-[26%] right-[8%] w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-indigo-600/22 via-purple-600/15 to-transparent blur-[115px] animate-orb-2" />
          <div className="absolute bottom-[-10%] left-[16%] w-[580px] h-[580px] rounded-full bg-gradient-to-tr from-emerald-500/18 via-teal-500/12 to-cyan-500/12 blur-[105px] animate-orb-3" />
          <div className="absolute top-[42%] left-[42%] w-[420px] h-[420px] rounded-full bg-cyan-500/12 blur-[95px] animate-orb-2" style={{ animationDelay: '2.5s' }} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,#060913_88%)] opacity-85" />
          <div className="absolute top-16 left-[28%] w-2 h-2 bg-amber-300 rounded-full twinkle-star-fast shadow-[0_0_8px_#fde047]" />
          <div className="absolute top-40 right-[32%] w-2.5 h-2.5 bg-cyan-200 rounded-full twinkle-star-slow shadow-[0_0_10px_#67e8f9]" style={{ animationDelay: '1.2s' }} />
          <div className="absolute bottom-44 left-[35%] w-1.5 h-1.5 bg-amber-200 rounded-full twinkle-star-fast" style={{ animationDelay: '2.1s' }} />
          <div className="absolute top-32 left-[58%] w-2 h-2 bg-emerald-300 rounded-full twinkle-star-slow shadow-[0_0_8px_#6ee7b7]" style={{ animationDelay: '0.7s' }} />
          <div className="absolute bottom-28 right-[24%] w-2 h-2 bg-purple-300 rounded-full twinkle-star-fast" style={{ animationDelay: '1.8s' }} />
          <div className="absolute top-[68%] left-[22%] w-1.5 h-1.5 bg-amber-100 rounded-full twinkle-star-slow" style={{ animationDelay: '3s' }} />
        </div>

        <ChatHeader
          titulo={tituloMentor}
          descricao={descMentor}
          abas={ABAS_MENTOR}
          abaAtivaId={abaAtiva.id}
          onTrocarAba={trocarAbaMentor}
          topicTabsRef={topicTabsRef}
          registrarBotaoAba={registrarBotaoAba}
          glider={topicPill}
          gliderEmerald={abaAtiva.id === 'natureza'}
          historicoAberto={historicoAberto}
          onToggleHistorico={alternarHistorico}
          modoAula={modoAula}
          onToggleModoAula={alternarModoAula}
          onAbrirFoco={abrirFoco}
          isMuted={isMuted}
          onToggleMute={alternarMute}
          onOpenPersonas={abrirPersonas}
        />

        {/* Efeito Cardume (edital): faixa coletiva fixa no topo do chat. */}
        <TeamProgressBanner />

        {personaCustomizada && (
          <p className="relative z-10 text-[11px] text-gray-500 px-4 pt-1.5 shrink-0">
            Falando com o seu professor <strong className="text-gray-300">{personaCustomizada.name}</strong>. Volte às categorias acima para o modo temático.
          </p>
        )}

        <section
          ref={chatAreaRef as any}
          className="relative z-10 flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center"
          data-purpose="chat-scroll-container"
          id="chatArea"
        >
          {vazio && !isGenerating && streamingText === null ? (
            <HeroWelcome
              titulo={tituloBoasVindas}
              subtitulo={subtituloBoasVindas}
              onPrompt={insertPrompt}
            />
          ) : (
            <ChatMessages
              messages={chatMessages}
              streamingText={streamingText}
              streamingModo={modoResposta}
              isGenerating={isGenerating}
              userInicial={userInicial}
              messagesEndRef={messagesEndRef}
              onSaveNota={saveToNotebook}
              hoveredId={hoveredMsg}
              onHover={setHoveredMsg}
            />
          )}
        </section>

        {modoAula ? (
          /* Modo Sala de Aula: sem input de texto, so o scanner + aviso. */
          <div className="relative z-10 flex shrink-0 flex-col items-center gap-2 px-4 pb-3">
            <p role="status" className="w-full max-w-4xl rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-center text-xs font-semibold text-cyan-200">
              Chat silenciado. Use apenas a câmera para escanear a matéria.
            </p>
            <OcrUploader
              apiKey={apiKey}
              onTranscrito={aoTranscritoModoAula}
              onErro={aoErroOcr}
            />
          </div>
        ) : (
        <>
        {/* EPICO 1: scanner rapido -> transcricao cai no input (com flash). */}
        <div className="relative z-10 flex shrink-0 items-center gap-2 px-4 pb-1">
          <OcrUploader
            apiKey={apiKey}
            onTranscrito={aoTranscritoChat}
            onErro={aoErroOcr}
          />
          <span className="text-[10px] text-slate-500">Foto do caderno vira texto aqui, sem digitar.</span>
        </div>

        <PremiumInput
          input={input}
          onChange={aoMudarInput}
          onSend={enviarAtual}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          onCamera={abrirCamera}
          onFileChange={handleFileCapture}
          onVoice={handleVoice}
          isListening={isListening}
          modoResposta={modoResposta}
          onTrocarModo={trocarModoResposta}
          modeContainerRef={modeContainerRef}
          registrarBotaoModo={registrarBotaoModo}
          modePill={modePill}
          flashKey={flashKey}
        />
        </>
        )}
      </div>

      <HistoryPanel
        aberto={historicoAberto}
        onFechar={alternarHistorico}
        conversas={conversas}
        conversaAtivaId={conversaAtivaId}
        onNova={criarConversa}
        onTrocar={trocarConversa}
        onApagar={apagarConversa}
        busca={buscaHistorico}
        onBusca={setBuscaHistorico}
        criando={criandoConversa}
        trocandoId={trocandoConversaId}
        apagandoId={apagandoConversaId}
        confirmarApagarId={confirmarApagarId}
      />

      {/* Trilho para reabrir o histórico no desktop quando recolhido. */}
      {!historicoAberto && (
        <div className="hidden md:flex flex-col items-center pt-1 shrink-0">
          <button
            onClick={alternarHistorico}
            title="Expandir histórico"
            aria-label="Mostrar histórico"
            aria-expanded={false}
            className="p-2 rounded-xl bg-white/5 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/40 text-slate-400 hover:text-amber-300 transition-all active:scale-95"
          >
            <PanelRightOpen size={16} />
          </button>
          <span className="mt-2 text-[9px] font-bold uppercase tracking-widest text-slate-600 [writing-mode:vertical-lr]">
            Histórico
          </span>
        </div>
      )}

      <PersonaManager />
      <ConsciousPauseModal open={pausaAberta} onClose={() => setPausaAberta(false)} />
      <FocusAnchorOverlay open={focoAberto} onClose={() => setFocoAberto(false)} />
    </div>
  );
}
