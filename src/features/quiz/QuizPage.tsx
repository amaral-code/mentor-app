import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { atrasoDoItem, avancar, springTap } from '../../shared/lib/motionPresets';
import { BarraProgresso } from '../../shared/ui/AnimatedNumber';
import { BarChart3, BookOpen, Check, Lightbulb, Target, TriangleAlert, Volume2, X, Zap } from 'lucide-react';
import { useAppStore, persistir } from '../../stores/appStore';
import { Dificuldade, QuizQuestion, QuizResult } from '../../shared/types';
import { generateQuizStructured, aiAvailable, NivelQuiz, explicarErroComTutor } from '../../shared/lib/aiService';
import { QUIZ_LOTES_SIMULTANEOS, emParalelo } from '../../shared/lib/quizLotes';
import {
  filtrarIneditas,
  salvarRascunhoSimulado,
  carregarRascunhoSimulado,
  limparRascunhoSimulado,
  formatarTempoSimulado,
  MINUTOS_POR_QUESTAO_SIMULADO,
  RascunhoSimulado,
} from '../../shared/lib/quizHistory';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { playCorrect, playError, playLevelUp } from '../../shared/lib/sfx';
import { mascotStore } from '../../stores/mascotStore';
import { XpMilestone } from '../../shared/ui/XpMilestone';
import { useBemEstarStore } from '../../stores/bemEstarStore';
import { CabecalhoPagina, BOTAO_NA_FAIXA } from '../../shared/ui/CabecalhoPagina';

type Stage = 'select' | 'topics' | 'playing' | 'result';

const MAT_ICONS: Record<string, string> = {
  Matemática: '', Português: '', Biologia: '', Física: '', Química: '',
  História: '', Geografia: '', Filosofia: '', Inglês: '🇬🇧', Redação: '',
};

const MATERIAS = ['Matemática', 'Português', 'Biologia', 'Física', 'Química', 'História', 'Geografia', 'Filosofia', 'Inglês', 'Redação'];

const TOPIC_MAP: Record<string, string[]> = {
  'Matemática': ['Trigonometria', 'Funções', 'Geometria Plana', 'Geometria Espacial', 'Probabilidade', 'Estatística', 'Análise Combinatória', 'Matrizes', 'Logaritmos', 'Progressões'],
  'Português': ['Crase', 'Concordância', 'Regência', 'Figuras de Linguagem', 'Interpretação Textual', 'Literatura Brasileira', 'Funções da Linguagem', 'Ortografia', 'Morfologia', 'Colocação Pronominal'],
  'Biologia': ['Citologia', 'Genética', 'Ecologia', 'Fisiologia Humana', 'Botânica', 'Zoologia', 'Evolução', 'Microbiologia', 'Bioquímica', 'Imunologia'],
  'Física': ['Mecânica', 'Termodinâmica', 'Óptica', 'Eletromagnetismo', 'Ondulatória', 'Hidrostática', 'Física Moderna', 'Cinemática', 'Dinâmica', 'Eletrodinâmica'],
  'Química': ['Química Orgânica', 'Estequiometria', 'Soluções', 'Termoquímica', 'Eletroquímica', 'Cinética Química', 'Equilíbrio Químico', 'Atomística', 'Ligações Químicas', 'Funções Inorgânicas'],
  'História': ['Brasil Colônia', 'Brasil Império', 'Era Vargas', 'Ditadura Militar', 'Revolução Francesa', 'Guerras Mundiais', 'Grécia Antiga', 'Roma Antiga', 'Independência do Brasil', 'República Velha'],
  'Geografia': ['Geopolítica', 'Climatologia', 'Geomorfologia', 'Urbanização', 'População', 'Cartografia', 'Meio Ambiente', 'Hidrografia', 'Agricultura', 'Globalização'],
  'Filosofia': ['Filosofia Antiga', 'Filosofia Medieval', 'Racionalismo', 'Empirismo', 'Ética', 'Política', 'Filosofia Contemporânea', 'Lógica', 'Estética', 'Existencialismo'],
  'Inglês': ['Interpretação Textual', 'Verbos Irregulares', 'Tempos Verbais', 'Conjunções', 'Preposições', 'Voz Passiva', 'Condicionais', 'Pronomes', 'Cognatos', 'Vocabulário ENEM'],
  'Redação': ['Estrutura Dissertativa', 'Repertório Sociocultural', 'Argumentação', 'Coesão Textual', 'Proposta de Intervenção', 'Introdução', 'Desenvolvimento', 'Conclusão', 'Temas ENEM', 'Citação'],
};

/** Materias do bloco misto do simulado oficial (nucleo ENEM). */
const MATERIAS_SIMULADO = ['Matemática', 'Português', 'Biologia', 'Física', 'Química', 'História', 'Geografia'];

/**
 * Cronometro do simulado: vermelho nos ultimos 10 minutos.
 * Sem intervalo proprio: o tick do QuizPage ja re-renderiza a cada
 * segundo, entao Date.now() aqui esta sempre fresco.
 */
function CronometroSimulado({ fimEm, texto }: { fimEm: number; texto: string }) {
  const urgente = fimEm - Date.now() < 10 * 60_000;
  return (
    <span className={`ml-2 font-bold tabular-nums ${urgente ? 'text-red-600' : 'text-amber-600'}`}>
      {texto || '--:--'}
    </span>
  );
}

function parseQuestions(text: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const blocks = text.split(/(?=^\d+[.)]|\*\*\d+[.)])/m).filter(b => b.trim().length > 50);
  for (const block of blocks) {
    try {
      const lines = block.split('\n').filter(l => l.trim());
      const enunciado = lines[0].replace(/^\d+[.)]\s*\*{0,2}/, '').trim();
      const alternativas: string[] = [];
      let correta = -1;
      let explicacao = '';
      let dificuldade: Dificuldade = 'media';
      for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (/^[a-eA-E][.)]/.test(trimmed)) {
          const text = trimmed.replace(/^[a-eA-E][.)]\s*/, '').replace(/\*{1,2}/g, '').trim();
          alternativas.push(text);
          if (trimmed.includes('*') && !trimmed.includes('**')) {
            correta = alternativas.length - 1;
          }
        } else if (trimmed.toLowerCase().startsWith('resposta') || trimmed.toLowerCase().startsWith('correta') || trimmed.toLowerCase().startsWith('gabarito')) {
          // A letra vale SO depois do rotulo: em "Resposta: B" o primeiro
          // [a-e] do texto seria o 'e' de "Resposta", marcando gabarito
          // errado. Por isso o match exige o separador antes da letra.
          const match = trimmed.match(/resposta|correta|gabarito/i) && trimmed.match(/[:\-–]\s*([a-eA-E])|\(([a-eA-E])\)|\*\*([a-eA-E])\*\*/);
          const letra = match && (match[1] || match[2] || match[3]);
          if (letra) correta = letra.toUpperCase().charCodeAt(0) - 65;
        } else if (trimmed.toLowerCase().startsWith('dificuldade')) {
          // Alimenta a telemetria de fadiga: "tempo demais numa questao
          // facil" so faz sentido se soubermos que ela era facil.
          const valor = trimmed.toLowerCase();
          dificuldade = valor.includes('facil') || valor.includes('fácil')
            ? 'facil'
            : valor.includes('dific') ? 'dificil' : 'media';
        } else if (trimmed.toLowerCase().startsWith('explica') || trimmed.toLowerCase().startsWith('justificativa')) {
          explicacao = trimmed.replace(/^(explica|justificativa)[^:]*:/i, '').trim();
        }
      }
      // Contrato da tela de jogo: EXATAMENTE 4 alternativas e indice
      // valido. O que nao cumpre e descartado em vez de renderizar quebrado.
      if (enunciado && alternativas.length >= 4 && correta >= 0 && correta < 4) {
        questions.push({
          id: `ai_q_${Date.now()}_${questions.length}`,
          materia: '',
          enunciado,
          alternativas: alternativas.slice(0, 4),
          correta,
          explicacao: explicacao || 'Questão gerada por IA.',
          dificuldade,
        });
      }
    } catch { /* skip malformed */ }
  }
  return questions;
}

export function QuizPage() {
  const reduzir = useReducedMotion();
  const addXP = useAppStore((s) => s.addXP);
  const addLog = useAppStore((s) => s.addLog);
  const isMuted = useAppStore((s) => s.isMuted);
  const quizResults = useAppStore((s) => s.quizResults);
  const addQuizResult = useAppStore((s) => s.addQuizResult);
  const apiKey = useAppStore((s) => s.apiKey);
  const setToast = useAppStore((s) => s.setToast);
  const [stage, setStage] = useState<Stage>('select');
  const [materia, setMateria] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  /** Configuracao do quiz: quantidade 1-30 e nivel pedido a banca. */
  const [quantidade, setQuantidade] = useState(10);
  const [dificuldade, setDificuldade] = useState<NivelQuiz>('media');
  /** Respostas do aluno por indice da questao (para o gabarito final). */
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [showGabarito, setShowGabarito] = useState(false);
  /** Explicacao do tutor por id da questao (cache: nao chama a IA duas vezes). */
  const [tutorTexto, setTutorTexto] = useState<Record<string, string>>({});
  const [tutorLoading, setTutorLoading] = useState<string | null>(null);
  /**
   * Modo de jogo: quiz avulso ou simulado oficial cronometrado.
   * O simulado mistura materias, tem deadline absoluto e rascunho com
   * salvamento automatico (sobrevive a fechar a pagina).
   */
  const [modoQuiz, setModoQuiz] = useState<'quiz' | 'simulado'>('quiz');
  const [simuladoQtd, setSimuladoQtd] = useState<45 | 90>(45);
  /** Deadline absoluto do simulado (ms). Base do cronometro regressivo. */
  const [simuladoFimEm, setSimuladoFimEm] = useState<number | null>(null);
  const [tempoRestante, setTempoRestante] = useState('');
  /** Rascunho valido encontrado ao abrir a aba (oferece continuar). */
  const [rascunhoDisponivel, setRascunhoDisponivel] = useState<RascunhoSimulado | null>(null);
  /** Minutos totais do simulado em curso (ritmo de 3 min/questao). */
  const [simuladoTotalMin, setSimuladoTotalMin] = useState(0);
  /** Progresso da geracao em lote do simulado ("Bloco 2 de 7"). */
  const [progressoGeracao, setProgressoGeracao] = useState('');
  /** Evita duplo finish quando o cronometro estoura (tick + clique). */
  const finalizadoRef = useRef(false);
  /** Espelho fresco de finishQuiz para o intervalo do cronometro. */
  const finishRef = useRef(() => {});
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null);
  /** Dica da questao atual visivel (recolhe a cada troca de questao). */
  const [showDica, setShowDica] = useState(false);
  /** Acertos seguidos: alimenta a comemoracao do sagui. */
  const [sequencia, setSequencia] = useState(0);
  const [comemorando, setComemorando] = useState(false);
  /** Dispara o shake da alternativa errada. */
  const [errou, setErrou] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);

  const registrarResposta = useBemEstarStore((s) => s.registrarResposta);
  const descarregarTelemetria = useBemEstarStore((s) => s.descarregarTelemetria);
  const agendarRevisao = useBemEstarStore((s) => s.agendarRevisao);
  const conteudoDensoBloqueado = useBemEstarStore((s) => s.conteudoDensoBloqueado);
  /** Instante em que a questao atual apareceu: base do tempo por questao. */
  const inicioQuestao = useRef(Date.now());
  /** Topico aberto pelo calendario adaptativo, se veio de la. */
  const revisaoAtiva = useRef<{ topicoId: string; topicoNome: string; materia: string } | null>(null);
  /** Espelho do rascunho para o beforeunload (sem stale closure). */
  const rascunhoRef = useRef<RascunhoSimulado | null>(null);
  /** Guarda de desmonte para a geração longa do simulado. */
  const montadoRef = useRef(true);
  useEffect(() => () => { montadoRef.current = false; }, []);

  /* Flashcards vindos do Caderno: consumo em efeito (nunca no render — em
     StrictMode o render duplo consumia o global no 1º passo e o 2º perdia). */
  useEffect(() => {
    if (stage !== 'select') return;
    const fq = (window as any).__flashcardQuiz as QuizQuestion[] | undefined;
    if (!fq) return;
    (window as any).__flashcardQuiz = undefined;
    setMateria('Flashcards'); setQuestions(fq); setModoQuiz('quiz');
    setRespostas({}); setShowGabarito(false); setTutorTexto({});
    finalizadoRef.current = false; setStage('playing');
  }, [stage]);

  /**
   * Gera e inicia o quiz.
   *
   * Aceita parametros porque duas entradas nao passam pela tela de
   * selecao: a intervencao de doomscrolling (3 questoes da materia
   * sugerida) e o calendario de revisoes (o topico que vence hoje).
   * Sem isso, ambas teriam de escrever no estado e esperar o proximo
   * render para chamar esta funcao.
   */
  const startQuiz = useCallback(async (opcoes?: { materia?: string; topicos?: string[]; quantidade?: number; dificuldade?: NivelQuiz }) => {
    const mat = opcoes?.materia ?? materia;
    const topicos = opcoes?.topicos ?? selectedTopics;
    if (!mat || topicos.length === 0) return;

    // Quantidade escolhida na tela (1-30). Entradas externas (doomscroll,
    // revisao) trazem a propria; o resto usa a configuracao.
    let qtd = Math.max(1, Math.min(30, Math.round(opcoes?.quantidade ?? quantidade)));
    /*
     * Bloqueio de conteudo denso: com o modelo apontando fadiga, um
     * bloco longo vira mais uma tarefa impossivel. O quiz nao
     * desaparece - ele encolhe para 3.
     */
    if (conteudoDensoBloqueado && qtd > 3) {
      qtd = 3;
      setToast('Hoje o bloco vem menor: 3 questões em vez do configurado. Seu índice de fadiga esta alto.', 'info');
    }
    const nivel = opcoes?.dificuldade ?? dificuldade;

    setMateria(mat);
    setGenerating(true);
    /* Zera aqui: sem isso, a contagem da geracao ANTERIOR aparecia no
       botao antes do primeiro lote novo chegar. */
    setProgressoGeracao('');
    mascotStore.getState().setState('loading', 'Gerando suas questões com a IA');
    try {
      if (!aiAvailable(apiKey)) {
        setToast('IA indisponível no momento. Confira a configuração no Perfil.', 'error');
        setGenerating(false);
        mascotStore.getState().setState('error', 'Preciso da IA configurada no Perfil para criar as questões!');
        return;
      }
      const topicPrompt = topicos.includes('Geral') ? 'Geral' : topicos.join(', ');
      /*
       * Antirrepeticao, camada 1 (prompt): o historico recente da materia
       * entra no pedido para a banca nao repetir nem reformular. Falha
       * de leitura nao trava a geracao - so perde essa camada.
       */
      let historico: { hash: string; preview: string }[] = [];
      try {
        historico = await supabaseRepository.loadHistoricoQuiz(mat, 30);
      } catch { /* offline: segue sem historico */ }
      /*
       * Geracao em JSON com schema fixo (tema, 4 alternativas, indice,
       * explicacao, dica, fonte, dificuldade): e o que garante que as
       * questoes RENDERIZEM. Se o modelo devolver texto fora do schema,
       * o parser legado tenta aproveitar a mesma resposta (sem nova
       * chamada).
       */
      const { questions: geradas, raw } = await generateQuizStructured(
        mat, topicPrompt, apiKey, qtd, {
          dificuldade: nivel,
          historico: historico.map(h => h.preview),
          /* Espera longa com spinner so diz "aguarde". Com a contagem, o
             aluno ve que ha avanco e quanto falta. */
          onProgresso: (prontas, total) => {
            if (montadoRef.current) setProgressoGeracao(`${prontas} de ${total} questões prontas`);
          },
        },
      );
      let parsed = geradas.slice(0, qtd);
      if (parsed.length === 0) {
        const legado = parseQuestions(raw).map(q => ({ ...q, materia: mat })).slice(0, qtd);
        if (legado.length > 0) {
          parsed = legado;
          setToast('Questões geradas em formato alternativo.', 'info');
        }
      }
      /*
       * Antirrepeticao, camada 2 (filtro): descarta pelo mesmo hash do
       * banco o que voltou repetido. Camada 3 (unique no banco) cobre
       * corrida entre abas na gravacao abaixo.
       */
      if (parsed.length > 0 && historico.length > 0) {
        const vistos = new Set(historico.map(h => h.hash));
        const ineditas = filtrarIneditas(parsed, vistos);
        if (ineditas.length > 0 && ineditas.length < parsed.length) {
          setToast('Algumas questões repetidas foram trocadas por inéditas.', 'info');
        }
        parsed = ineditas;
      }
      if (parsed.length > 0) {
        setQuestions(parsed.map(q => ({ ...q, materia: mat })));
        setCurrentIndex(0); setSelectedAlt(null); setShowExplanation(false); setShowDica(false); setAcertos(0); setResult(null);
        setRespostas({}); setShowGabarito(false); setTutorTexto({}); setTutorLoading(null);
        setModoQuiz('quiz'); setSimuladoFimEm(null); setRascunhoDisponivel(null);
        finalizadoRef.current = false;
        setStage('playing');
        /*
         * Antirrepeticao, camada 3 (registro): grava com upsert pelo
         * conflito (usuario, hash). Falha aqui nao tira o quiz da tela -
         * o que se perde e o registro, avisado sem travar.
         */
        persistir(
          supabaseRepository.saveQuestoesExibidas(mat, parsed.map(q => ({
            topico: q.topico, enunciado: q.enunciado, dificuldade: q.dificuldade,
          }))),
          { mensagem: 'O histórico antirrepetição não foi salvo.' },
        );
        mascotStore.getState().setState('idle', 'Respira fundo e leia a questão com calma. ');
      } else {
        setToast(
          historico.length > 0
            ? 'Todas as questões geradas já haviam sido cobradas. Tente outro tópico.'
            : 'Não foi possível gerar questões. Tente outros tópicos.',
          'error',
        );
        setStage('topics');
        mascotStore.getState().setState('error', 'Não consegui gerar as questões. Tenta outros tópicos!');
      }
    } catch (e: any) {
      setToast(e?.message || 'Erro ao gerar questões', 'error');
      setStage('topics');
      mascotStore.getState().setState('error', 'Ops! Algo deu errado ao gerar as questões.');
    }
    setGenerating(false);
    /* A contagem some junto com o estado de geracao: deixa-la para tras
       mostraria "18 de 30 prontas" num botao que ja voltou ao normal. */
    setProgressoGeracao('');
  }, [materia, selectedTopics, quantidade, dificuldade, apiKey, setToast, conteudoDensoBloqueado]);

  /*
   * Entradas que nao passam pela tela de selecao.
   *
   * __intervencaoQuiz: veio do card de doomscrolling ("3 questoes e
   * parar por hoje"). __revisaoAtiva: veio do calendario adaptativo, e
   * neste caso o resultado reagenda o topico no fim.
   */
  useEffect(() => {
    const janela = window as any;

    const intervencao = janela.__intervencaoQuiz as { materia: string; quantidade: number } | undefined;
    if (intervencao && stage === 'select') {
      janela.__intervencaoQuiz = undefined;
      void startQuiz({ materia: intervencao.materia, topicos: ['Geral'], quantidade: intervencao.quantidade });
      return;
    }

    const revisao = janela.__revisaoAtiva as
      | { topicoId: string; topicoNome: string; materia: string }
      | undefined;
    if (revisao && stage === 'select') {
      janela.__revisaoAtiva = undefined;
      revisaoAtiva.current = revisao;
      void startQuiz({
        materia: revisao.materia || 'Biologia',
        topicos: [revisao.topicoNome],
        quantidade: 5,
      });
    }
  }, [stage, startQuiz]);

  // Cronometro por questao: reinicia a cada nova questao exibida.
  useEffect(() => {
    inicioQuestao.current = Date.now();
  }, [currentIndex, stage]);

  /*
   * SIMULADO OFICIAL CRONOMETRADO.
   *
   * Bloco misto (45 ou 90) gerado em lotes por materia - uma chamada por
   * materia mantem cada lote dentro do teto de tokens e aplica o
   * antirrepeticao de cada uma. O embaralhamento final imita prova real
   * (assuntos misturados). Ritmo: 3 min/questao, deadline absoluto.
   */
  async function startSimulado() {
    if (generating) return;
    if (!aiAvailable(apiKey)) {
      setToast('IA indisponível no momento. Confira a configuração no Perfil.', 'error');
      mascotStore.getState().setState('error', 'Preciso da IA configurada no Perfil para montar o simulado!');
      return;
    }
    const total = simuladoQtd;
    // Sem trava de fadiga aqui de proposito: simulado e prova marcada,
    // nao bloco adaptativo do dia.
    const base = Math.floor(total / MATERIAS_SIMULADO.length);
    const resto = total % MATERIAS_SIMULADO.length;

    setGenerating(true);
    setProgressoGeracao('');
    mascotStore.getState().setState('loading', 'Montando seu simulado oficial');
    try {
      /*
       * Os blocos por materia correm EM PARALELO.
       *
       * Antes era um `for` sequencial: sete chamadas de IA em fila, uma
       * esperando a outra, e o aluno olhando a tela de carregamento pela
       * soma de todas. Os blocos sao independentes (cada um pede sua
       * materia, com seu proprio historico), entao nada justificava a
       * fila - o tempo total passa a ser o do bloco mais lento.
       *
       * A concorrencia e limitada por `emParalelo`: disparar as sete de
       * uma vez convida o 429 do provedor, e o retry devolveria a
       * lentidao pela porta dos fundos.
       */
      let prontos = 0;
      const resultados = await emParalelo(
        MATERIAS_SIMULADO.map((mat, i) => ({ mat, n: base + (i < resto ? 1 : 0) })),
        QUIZ_LOTES_SIMULTANEOS,
        async ({ mat, n }) => {
          let hist: { hash: string; preview: string }[] = [];
          try {
            hist = await supabaseRepository.loadHistoricoQuiz(mat, 30);
          } catch { /* offline: segue sem historico */ }
          const { questions: geradas, raw } = await generateQuizStructured(
            mat, 'Geral', apiKey, n, { dificuldade, historico: hist.map((h) => h.preview) },
          );
          let lote = geradas.slice(0, n);
          if (lote.length === 0) {
            lote = parseQuestions(raw).map((q) => ({ ...q, materia: mat })).slice(0, n);
          }
          if (lote.length > 0 && hist.length > 0) {
            lote = filtrarIneditas(lote, new Set(hist.map((h) => h.hash)));
          }
          /* Em paralelo o progresso conta o que TERMINOU, nao "o bloco
             i de N" - em ordem eles nao chegam. */
          prontos++;
          if (montadoRef.current) {
            setProgressoGeracao(`${prontos} de ${MATERIAS_SIMULADO.length} blocos prontos`);
          }
          return lote.map((q) => ({ ...q, materia: mat }));
        },
      );

      /* Bloco que falhou nao derruba o simulado: o de baixo confere se o
         total ficou curto demais e avisa. Melhor um simulado menor que
         nenhum. */
      const todas = resultados.flatMap((r) => r.valor ?? []);
      // Saiu da tela no meio da geração (7+ chamadas IA): não commita nada
      // — antes dava setState pós-unmount e `generating` preso.
      if (!montadoRef.current) return;
      for (let i = todas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [todas[i], todas[j]] = [todas[j], todas[i]];
      }
      if (todas.length < 10) {
        setToast('O simulado saiu curto demais. Tente de novo.', 'error');
        mascotStore.getState().setState('error', 'Não consegui montar o simulado. Tenta de novo!');
        setGenerating(false);
        setProgressoGeracao('');
        return;
      }
      const totalMin = todas.length * MINUTOS_POR_QUESTAO_SIMULADO;
      const fimEm = Date.now() + totalMin * 60_000;
      setQuestions(todas);
      setMateria('Simulado');
      setModoQuiz('simulado');
      setCurrentIndex(0); setSelectedAlt(null); setShowExplanation(false); setShowDica(false);
      setAcertos(0); setResult(null); setRespostas({}); setShowGabarito(false);
      setTutorTexto({}); setTutorLoading(null);
      setSimuladoFimEm(fimEm); setSimuladoTotalMin(totalMin);
      setTempoRestante(formatarTempoSimulado(totalMin * 60));
      setRascunhoDisponivel(null);
      finalizadoRef.current = false;
      // Antirrepeticao por materia de cada questao (bloco misto).
      const porMateria = new Map<string, QuizQuestion[]>();
      for (const q of todas) {
        const lista = porMateria.get(q.materia) ?? [];
        lista.push(q);
        porMateria.set(q.materia, lista);
      }
      persistir(
        Promise.all(
          [...porMateria.entries()].map(([mat, qs]) =>
            supabaseRepository.saveQuestoesExibidas(
              mat,
              qs.map((q) => ({ topico: q.topico, enunciado: q.enunciado, dificuldade: q.dificuldade })),
            ),
          ),
        ).then(() => undefined),
        { mensagem: 'O histórico antirrepetição não foi salvo.' },
      );
      setStage('playing');
      mascotStore.getState().setState('idle', 'Simulado valendo! Administre o tempo.');
    } catch (e: any) {
      if (!montadoRef.current) return;
      setToast(e?.message || 'Erro ao montar o simulado', 'error');
      mascotStore.getState().setState('error', 'Ops! Algo deu errado ao montar o simulado.');
    } finally {
      if (montadoRef.current) {
        setGenerating(false);
        setProgressoGeracao('');
      }
    }
  }

  function continuarSimulado() {
    const r = rascunhoDisponivel ?? carregarRascunhoSimulado();
    if (!r) {
      setRascunhoDisponivel(null);
      return;
    }
    setQuestions(
      r.questions.map((q) => ({
        ...q,
        dificuldade: q.dificuldade === 'facil' || q.dificuldade === 'dificil' ? q.dificuldade : ('media' as const),
      })),
    );
    setMateria('Simulado');
    setModoQuiz('simulado');
    setRespostas(r.respostas);
    setCurrentIndex(r.currentIndex);
    const respAtual = r.respostas[r.currentIndex];
    setSelectedAlt(respAtual ?? null);
    setShowExplanation(respAtual !== undefined);
    setShowDica(false);
    setAcertos(r.acertos);
    setResult(null);
    setShowGabarito(false);
    setTutorTexto({});
    setTutorLoading(null);
    setSimuladoFimEm(r.fimEm);
    setSimuladoTotalMin(r.totalMin);
    setDificuldade(r.dificuldade === 'facil' || r.dificuldade === 'dificil' ? r.dificuldade : 'media');
    setTempoRestante(formatarTempoSimulado(Math.max(0, Math.round((r.fimEm - Date.now()) / 1000))));
    setRascunhoDisponivel(null);
    finalizadoRef.current = false;
    setStage('playing');
    mascotStore.getState().setState('idle', 'Simulado retomado de onde parou.');
  }

  function descartarRascunho() {
    limparRascunhoSimulado();
    setRascunhoDisponivel(null);
  }

  // Espelho fresco de finishQuiz para o intervalo (evita stale closure).
  useEffect(() => { finishRef.current = finishQuiz; });

  // Cronometro regressivo: deadline absoluto, entao fechar a aba nao
  // pausa. Ao estourar, finaliza sozinho uma unica vez.
  useEffect(() => {
    if (modoQuiz !== 'simulado' || stage !== 'playing' || simuladoFimEm === null) return;
    const tick = () => {
      const resto = Math.max(0, Math.round((simuladoFimEm - Date.now()) / 1000));
      setTempoRestante(formatarTempoSimulado(resto));
      if (resto <= 0 && !finalizadoRef.current) finishRef.current();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [modoQuiz, stage, simuladoFimEm]);

  // Autosave a cada resposta/indice + espelho para o beforeunload.
  useEffect(() => {
    if (modoQuiz !== 'simulado' || stage !== 'playing' || questions.length === 0 || simuladoFimEm === null) {
      return;
    }
    const rascunho: RascunhoSimulado = {
      versao: 1,
      questions: questions.map((q) => ({
        id: q.id,
        materia: q.materia,
        topico: q.topico,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        correta: q.correta,
        explicacao: q.explicacao,
        dica: q.dica,
        fonte: q.fonte,
        dificuldade: q.dificuldade,
      })),
      respostas,
      currentIndex,
      acertos,
      fimEm: simuladoFimEm,
      totalMin: simuladoTotalMin,
      dificuldade,
      materia: 'Simulado',
    };
    rascunhoRef.current = rascunho;
    salvarRascunhoSimulado(rascunho);
  }, [modoQuiz, stage, questions, respostas, currentIndex, acertos, simuladoFimEm, simuladoTotalMin, dificuldade]);

  // Queda de pagina no meio do simulado: o rascunho ja esta salvo pelo
  // efeito acima; aqui e o reforco final antes de descarregar.
  useEffect(() => {
    const aoSair = () => {
      if (rascunhoRef.current) salvarRascunhoSimulado(rascunhoRef.current);
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, []);

  // Ao abrir a aba, oferece continuar simulado inacabado e nao expirado.
  useEffect(() => {
    if (stage !== 'select') return;
    setRascunhoDisponivel(carregarRascunhoSimulado());
  }, [stage]);

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  }

  /**
   * Explicacao do tutor para um erro: o DeepSeek compara a alternativa
   * marcada vs. a gabaritada e diagnostica o erro conceitual com
   * empatia. Resultado em cache por questao (nao paga duas vezes).
   */
  async function pedirExplicacaoTutor(qIndex: number) {
    const q = questions[qIndex];
    if (!q) return;
    const escolhida = respostas[qIndex];
    if (escolhida === undefined || escolhida === q.correta) return;
    if (tutorTexto[q.id] || tutorLoading !== null) return;
    setTutorLoading(q.id);
    try {
      const texto = await explicarErroComTutor(
        {
          materia: q.materia || materia,
          topico: q.topico,
          enunciado: q.enunciado,
          alternativas: q.alternativas,
          escolhida,
          correta: q.correta,
          explicacao: q.explicacao,
        },
        apiKey,
      );
      setTutorTexto((prev) => ({ ...prev, [q.id]: texto }));
    } catch (e: any) {
      setToast(e?.message || 'Não foi possível chamar o tutor agora.', 'error');
    }
    setTutorLoading(null);
  }

  function handleAnswer(idx: number) {
    if (selectedAlt !== null) return;
    setSelectedAlt(idx);
    setShowExplanation(true);
    const questao = questions[currentIndex];
    const acertou = idx === questao.correta;
    // Guarda a escolha para o gabarito detalhado no final.
    setRespostas(prev => ({ ...prev, [currentIndex]: idx }));

    /*
     * Telemetria silenciosa (StudyTelemetry).
     *
     * Fica em memoria e vai ao banco em lotes de 10 - 90 inserts num
     * simulado deixariam a tela travada em 4G. O modelo de fadiga le
     * este buffer na hora, entao o indice reage dentro da propria
     * sessao.
     */
    registrarResposta({
      questionId: questao.id,
      materia: questao.materia || materia,
      dificuldade: questao.dificuldade ?? 'media',
      tempoGastoSegundos: Math.min(900, Math.round((Date.now() - inicioQuestao.current) / 1000)),
      acertou,
    });

    if (acertou) {
      setAcertos(p => p + 1);
      const nova = sequencia + 1;
      setSequencia(nova);
      // A partir de 3 seguidos o sagui entra pulando no canto: a
      // recompensa cresce junto com o desempenho, em vez de ser sempre
      // igual.
      if (nova >= 3) {
        setComemorando(true);
        window.setTimeout(() => setComemorando(false), 1000);
      }
      if (!isMuted) playCorrect();
      mascotStore.getState().setState('success', 'Mandou bem! Resposta certa.');
    } else {
      setSequencia(0);
      setErrou(true);
      window.setTimeout(() => setErrou(false), 450);
      if (!isMuted) playError();
      mascotStore.getState().setState('error', 'Quase. Olha a explicação e tenta a próxima.');
    }
  }

  function nextQuestion() {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(p => p + 1); setSelectedAlt(null); setShowExplanation(false); setShowDica(false);
    } else { finishQuiz(); }
  }

  function finishQuiz() {
    // Guarda contra duplo finish (cronometro estourando + clique final).
    if (finalizadoRef.current) return;
    finalizadoRef.current = true;

    const xpGanho = acertos * 30;
    const res: QuizResult = { materia, acertos, total: questions.length, xpGanho, timestamp: Date.now() };
    setResult(res); addQuizResult(res); addXP(xpGanho);
    addLog({ timestamp: Date.now(), type: 'quiz', description: `Quiz de ${materia}: ${acertos}/${questions.length}`, xp: xpGanho });
    if (!isMuted && xpGanho > 0) playLevelUp();
    mascotStore.getState().setState('success', ` Quiz concluído! +${xpGanho} XP de bônus, meta cumprida!`);
    setStage('result');
    if (xpGanho > 0) setShowMilestone(true);

    /*
     * Placar por topico (tela de Estatisticas, migration 015): uma chamada
     * RPC por questao, com a materia DE CADA questao (no simulado misto,
     * questions carrega varias materias). Agrupadas num unico aviso.
     */
    const placar = questions.map((q, i) => {
      const r = respostas[i];
      return supabaseRepository.registrarDesempenhoTopico(
        q.materia || materia,
        q.topico ?? '',
        r === q.correta,
      );
    });
    persistir(Promise.all(placar).then(() => undefined), {
      mensagem: 'O placar por tópico não foi salvo.',
    });

    // Simulado encerrado: rascunho e deadline saem de cena.
    limparRascunhoSimulado();
    setSimuladoFimEm(null);
    setRascunhoDisponivel(null);

    /*
     * Calendario adaptativo: a nota deste quiz define quando o topico
     * volta (1, 3, 7, 21... dias). O aluno nao monta cronograma - ele
     * responde, e a data e calculada. No simulado misto nao ha topico
     * unico para reagendar: o acompanhamento segue pelo placar acima.
     */
    const nota = questions.length ? Math.round((acertos / questions.length) * 100) : 0;
    if (modoQuiz !== 'simulado') {
      const emRevisao = revisaoAtiva.current;
      if (emRevisao) {
        revisaoAtiva.current = null;
        void agendarRevisao(emRevisao.topicoId, emRevisao.topicoNome, emRevisao.materia || materia, nota);
      } else {
        const topicos = selectedTopics.filter((t) => t !== 'Geral');
        const alvos = topicos.length > 0 ? topicos : [materia];
        for (const topico of alvos) {
          void agendarRevisao(`${materia}:${topico}`.toLowerCase(), topico, materia, nota);
        }
      }
    } else {
      revisaoAtiva.current = null;
    }

    // Fecha o lote de telemetria e recalcula o indice de fadiga.
    void descarregarTelemetria();
  }

  if (stage === 'select') {
    return (
      <div className="space-y-5 animate-fade-up">
        <CabecalhoPagina titulo="Quiz Adaptativo IA" subtitulo="Escolha uma matéria para praticar" cor="ceu" pose="estudando" />

        {rascunhoDisponivel && (
          <div className="glass rounded-2xl p-5 border border-cyan-500/20 bg-cyan-500/5 animate-slide-up">
            <p className="text-sm font-semibold text-tinta-900">Simulado em andamento</p>
            <p className="text-xs text-slate-600 mt-1">
              {rascunhoDisponivel.questions.length - rascunhoDisponivel.currentIndex} questões restantes • termina em{' '}
              {formatarTempoSimulado(Math.max(0, Math.round((rascunhoDisponivel.fimEm - Date.now()) / 1000)))}
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={continuarSimulado} className="btn-primary flex-1 text-sm">Continuar simulado</button>
              <button onClick={descartarRascunho} className="btn-ghost text-sm text-red-600 hover:text-red-600">Descartar</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {MATERIAS.map(m => (
            <button
              key={m}
              onClick={() => { setMateria(m); setSelectedTopics([]); setStage('topics'); }}
              className="glass rounded-2xl p-5 text-center hover:border-amber-500/20 hover:shadow-[0_8px_32px_rgba(245,158,11,0.08)] transition-all group border border-slate-200"
            >
              <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform">{MAT_ICONS[m] || ''}</span>
              <p className="text-sm font-semibold text-tinta-900">{m}</p>
              <p className="text-xs text-slate-500 mt-1">até 30 questões</p>
            </button>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 border border-violet-500/15">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 flex items-center justify-center">
              <BookOpen size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-tinta-900">Simulado oficial</h2>
              <p className="text-xs text-slate-500">Bloco misto cronometrado (3 min/questão) com salvamento automático</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {([45, 90] as const).map(n => (
              <button
                key={n}
                onClick={() => setSimuladoQtd(n)}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border min-h-[44px] ${
                  simuladoQtd === n
                    ? 'bg-violet-500/15 border-violet-500/30 text-violet-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200 hover:text-tinta-700'
                }`}
              >
                {n} questões • {n * MINUTOS_POR_QUESTAO_SIMULADO} min
              </button>
            ))}
          </div>
          <button onClick={startSimulado} disabled={generating} className="btn-primary w-full mt-3">
            {generating ? (
              <><span className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin mr-2" /> {progressoGeracao || 'Montando simulado...'}</>
            ) : `Iniciar simulado (${simuladoQtd} questões)`}
          </button>
        </div>

        {!aiAvailable(apiKey) && (
          <div className="glass rounded-2xl p-4 border border-amber-500/10 bg-amber-500/5">
            <p className="text-sm text-amber-600 flex items-center gap-2">
              <span><TriangleAlert size={16} className="inline-block align-[-0.15em] text-amber-600" /></span>
              <span>Configure a IA no <button onClick={() => useAppStore.getState().setActiveTab('profile')} className="underline font-medium">Perfil</button> para gerar quizzes personalizados.</span>
            </p>
          </div>
        )}

        {quizResults.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3"><BarChart3 size={16} className="inline-block align-[-0.15em] text-cyan-700" /> Histórico recente</h2>
            <div className="space-y-1">
              {quizResults.slice(-5).reverse().map((r, i) => {
                const pct = Math.round((r.acertos / r.total) * 100);
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-2">
                      <span>{MAT_ICONS[r.materia] || ''}</span>
                      <span className="text-slate-600">{r.materia}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${pct >= 60 ? 'text-emerald-600' : pct >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                        {r.acertos}/{r.total}
                      </span>
                      <span className="text-amber-600 font-medium tabular-nums text-xs bg-amber-500/10 px-2 py-0.5 rounded-full">
                        +{r.xpGanho} XP
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === 'topics') {
    const topics = TOPIC_MAP[materia] || [];
    return (
      <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
        <CabecalhoPagina
          titulo={<>{MAT_ICONS[materia] ? <span className="mr-2" aria-hidden="true">{MAT_ICONS[materia]}</span> : null}{materia}</>}
          subtitulo="Conteúdos cobrados no ENEM, FUVEST, UNICAMP e UNESP"
          cor="ceu"
          pose="estudando_caderno"
          acao={<button onClick={() => setStage('select')} className={BOTAO_NA_FAIXA}>Voltar</button>}
        />

        <div className="glass rounded-2xl p-6 space-y-4">
          <p className="text-sm text-slate-600">Escolha um ou mais tópicos para a IA gerar questões personalizadas.</p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleTopic('Geral')}
              className={`px-4 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all border min-h-[44px] ${
                selectedTopics.includes('Geral')
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-600'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200 hover:text-tinta-700'
              }`}
            > Geral (todos os tópicos)
            </button>
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`px-4 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all border min-h-[44px] ${
                  selectedTopics.includes(topic)
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-600'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200 hover:text-tinta-700'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>

          {selectedTopics.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{selectedTopics.length} tópico{selectedTopics.length !== 1 ? 's' : ''} selecionado{selectedTopics.length !== 1 ? 's' : ''}</span>
              <button onClick={() => setSelectedTopics([])} className="text-red-600 hover:text-red-600 underline">Limpar</button>
            </div>
          )}

          <div className="pt-1">
            <p className="text-xs text-slate-500 font-medium tracking-wide mb-2">Nível de dificuldade</p>
            <div className="flex gap-2">
              {(['facil', 'media', 'dificil'] as NivelQuiz[]).map(n => (
                <button
                  key={n}
                  onClick={() => setDificuldade(n)}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border min-h-[44px] ${
                    dificuldade === n
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-600'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-200 hover:text-tinta-700'
                  }`}
                >
                  {n === 'facil' ? 'Fácil' : n === 'media' ? 'Médio' : 'Difícil'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500 font-medium tracking-wide">Quantidade de questões</p>
              <span className="text-sm font-bold text-amber-600 tabular-nums">{quantidade}</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={quantidade}
              onChange={e => setQuantidade(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-full accent-amber-500"
              aria-label="Quantidade de questões (1 a 30)"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>1</span><span>30</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => startQuiz()} disabled={selectedTopics.length === 0 || generating} className="btn-primary flex-1">
              {generating ? (
                <><span className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin mr-2" /> {progressoGeracao || 'Gerando questões...'}</>
              ) : `Gerar Quiz (${quantidade} ${quantidade === 1 ? 'questão' : 'questões'})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'result' && result) {
    const pct = Math.round((result.acertos / result.total) * 100);
    const grade = pct >= 80 ? 'Excelente!' : pct >= 60 ? 'Mandou bem!' : pct >= 30 ? 'Bom, mas pode melhorar!' : 'Continue praticando!';
    return (
      <>
      <div className={`space-y-5 animate-scale-in mx-auto ${showGabarito ? 'max-w-2xl' : 'max-w-md'}`}>
        {/* Fim de lição no estilo Duolingo: sagui comemorando, nota em
            destaque e três cartões com os números da sessão. */}
        <div className="text-center pt-2">
          <img
            src={pct >= 60 ? '/assets/sagui_pulando_2.png' : '/assets/sagui_acenando_2.png'}
            alt=""
            width={176}
            height={176}
            className="w-40 h-40 md:w-44 md:h-44 mx-auto object-contain motion-safe:animate-float-suave"
          />
          <h1 className={`mt-3 text-3xl font-black ${pct >= 60 ? 'text-amber-500' : pct >= 30 ? 'text-ceu-500' : 'text-slate-600'}`}>{grade}</h1>
          <p className="text-base font-semibold text-slate-500 mt-1">{materia}</p>

          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { titulo: 'XP ganhos', valor: `+${result.xpGanho}`, cor: 'bg-amber-500 border-amber-500 text-amber-600', Icone: Zap },
              { titulo: 'Acertos', valor: `${result.acertos}/${result.total}`, cor: 'bg-emerald-500 border-emerald-500 text-emerald-600', Icone: Check },
              { titulo: 'Precisão', valor: `${pct}%`, cor: 'bg-ceu-500 border-ceu-500 text-ceu-600', Icone: Target },
            ].map(({ titulo, valor, cor, Icone }) => (
              <div key={titulo} className={`rounded-2xl border-2 overflow-hidden ${cor.split(' ').slice(0, 2).join(' ')}`}>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-white py-1.5">{titulo}</p>
                <div className={`bg-white rounded-[13px] py-3 flex items-center justify-center gap-1.5 ${cor.split(' ')[2]}`}>
                  <Icone size={20} strokeWidth={3} aria-hidden="true" />
                  <span className="text-xl font-black tabular-nums">{valor}</span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setShowGabarito(v => !v)} className="mt-6 text-sm font-extrabold uppercase tracking-wide text-ceu-600 hover:text-ceu-700">
            {showGabarito ? 'Ocultar gabarito detalhado' : 'Ver gabarito detalhado'}
          </button>
          <div className="flex flex-col gap-3 mt-5">
            <button onClick={() => { setStage('topics'); setSelectedTopics([]); }} className="btn-primary h-12 w-full uppercase">Tentar novamente</button>
            <button onClick={() => setStage('select')} className="btn-secondary h-12 w-full uppercase">Outra matéria</button>
          </div>
        </div>

        {showGabarito && (
          <div className="space-y-3 text-left">
            {questions.map((q, i) => {
              const escolha = respostas[i];
              const acertou = escolha === q.correta;
              return (
                <div key={q.id} className="cartao p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                      acertou ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      Q{i + 1} · {acertou ? 'Acertou' : 'Errou'}
                    </span>
                    {q.topico && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">{q.topico}</span>
                    )}
                    {q.fonte && (
                      <span className="text-xs font-bold text-ceu-700 bg-ceu-100 rounded-full px-2.5 py-1">{q.fonte}</span>
                    )}
                  </div>
                  <p className="text-base text-tinta-900 font-bold leading-relaxed mb-3">{q.enunciado}</p>
                  <div className="space-y-2 mb-3">
                    {q.alternativas.map((alt, idx) => (
                      <div key={idx} className={`text-sm font-semibold px-3 py-2.5 rounded-xl border-2 ${
                        idx === q.correta
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : idx === escolha
                            ? 'bg-red-50 border-red-500 text-red-700'
                            : 'border-slate-200 text-slate-600'
                      }`}>
                        <span className="font-extrabold mr-2">{String.fromCharCode(65 + idx)}</span>{alt}
                        {idx === q.correta && <span className="ml-2 text-xs font-extrabold">correta</span>}
                        {idx === escolha && idx !== q.correta && <span className="ml-2 text-xs font-extrabold">sua resposta</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-bold text-slate-500 mb-1">Dificuldade: {q.dificuldade ?? 'media'}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{q.explicacao}</p>
                  {respostas[i] !== undefined && respostas[i] !== q.correta && (
                    <div className="mt-3">
                      {tutorTexto[q.id] ? (
                        <div className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-200">
                          <p className="text-xs text-emerald-700 font-extrabold mb-1">Explicação do tutor</p>
                          <p className="text-sm text-tinta-700 leading-relaxed whitespace-pre-wrap">{tutorTexto[q.id]}</p>
                        </div>
                      ) : (
                        <button
                          onClick={() => pedirExplicacaoTutor(i)}
                          disabled={tutorLoading !== null}
                          className="btn-secondary w-full text-xs uppercase"
                        >
                          {tutorLoading === q.id ? 'Chamando o tutor...' : 'Pedir explicação do tutor'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Marco da lição: XP salta no centro + sagui cai com joinha */}
      <XpMilestone
        open={showMilestone}
        xp={result.xpGanho}
        acertos={result.acertos}
        total={result.total}
        onClose={() => setShowMilestone(false)}
      />
      </>
    );
  }

  const question = questions[currentIndex];
  const respondeu = selectedAlt !== null;
  const acertouAgora = respondeu && selectedAlt === question.correta;
  /* Alternativas curtas cabem em duas colunas no computador; texto longo
     em duas colunas vira tijolo de leitura, então fica em uma. */
  const alternativasCurtas = question.alternativas.every((a) => a.length <= 40);

  return (
    <div className="space-y-5 animate-fade-up max-w-2xl md:max-w-3xl mx-auto">
      {/* Topo da lição: barra grossa de progresso, como no Duolingo. Saber
          quanto falta é o que sustenta o aluno até o fim do bloco. */}
      <div className="flex items-center gap-3">
        <span className="text-2xl shrink-0" aria-hidden="true">{MAT_ICONS[materia] || ''}</span>
        <BarraProgresso
          altura="h-4"
          corClassName="bg-emerald-500"
          className="flex-1"
          valor={((currentIndex + (respondeu ? 1 : 0)) / questions.length) * 100}
        />
        <span className="text-sm font-extrabold text-slate-500 tabular-nums shrink-0">{currentIndex + 1}/{questions.length}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-ceu-700 bg-ceu-100 rounded-full px-3 py-1.5">
          <BookOpen size={14} /> {materia} · Questão {currentIndex + 1} de {questions.length}
        </span>
        {modoQuiz === 'simulado' && (
          <span className="text-xs font-extrabold text-violet-700 bg-violet-100 rounded-full px-3 py-1.5">
            SIMULADO
          </span>
        )}
        {modoQuiz === 'simulado' && simuladoFimEm !== null && (
          <span className="text-xs font-extrabold text-slate-600 bg-slate-100 rounded-full px-3 py-1.5">
            <CronometroSimulado fimEm={simuladoFimEm} texto={tempoRestante} />
          </span>
        )}
        {question.topico && (
          <span className="text-xs font-extrabold text-amber-700 bg-amber-100 rounded-full px-3 py-1.5">
            Tema: {question.topico}
          </span>
        )}
        {question.fonte && (
          <span className="text-xs font-extrabold text-slate-600 bg-slate-100 rounded-full px-3 py-1.5">
            {question.fonte}
          </span>
        )}
      </div>

      {comemorando && (
        <img loading="lazy"
          src="/assets/sagui_pulando_2.png"
          alt=""
          width={96}
          height={96}
          className="fixed bottom-28 right-4 md:bottom-8 md:right-8 w-24 h-24 object-contain z-40 pointer-events-none motion-safe:animate-scale-in"
        />
      )}

      {/* popLayout: a questao que sai nao empurra a que entra, entao o
          bloco nao "pula" durante a troca. */}
      <AnimatePresence mode="popLayout" initial={false}>
      <m.div
        key={currentIndex}
        variants={reduzir ? undefined : avancar}
        initial={reduzir ? false : 'inicial'}
        animate={reduzir ? undefined : 'animar'}
        exit={reduzir ? undefined : 'sair'}
      >
        {/* No computador o sagui "fala" a pergunta, como o personagem das
            lições do Duolingo. No celular o enunciado vem direto, sem balão,
            para não roubar altura da tela. */}
        <div className="mb-6 md:flex md:items-end md:gap-4">
          <img
            src="/assets/sagui_estudando_2.png"
            alt=""
            width={128}
            height={128}
            className="hidden md:block w-32 h-32 shrink-0 object-contain motion-safe:animate-float-suave"
          />
          <div className="md:relative md:flex-1 md:rounded-[22px] md:border-2 md:border-slate-200 md:bg-white md:px-6 md:py-5 md:shadow-lip">
            <span className="hidden md:block absolute -left-[9px] bottom-8 w-4 h-4 rotate-45 bg-white border-l-2 border-b-2 border-slate-200" aria-hidden="true" />
            <p className="text-xl md:text-2xl text-tinta-900 font-extrabold leading-snug">{question.enunciado}</p>
          </div>
        </div>

        {question.dica && !respondeu && (
          <div className="mb-4">
            {!showDica ? (
              <button
                onClick={() => setShowDica(true)}
                className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-amber-600 hover:text-amber-700"
              >
                <Lightbulb size={18} strokeWidth={2.5} /> Ver dica
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 animate-slide-up">
                <p className="text-xs text-amber-700 font-extrabold uppercase tracking-wide mb-1">Dica</p>
                <p className="text-sm text-slate-700 leading-relaxed">{question.dica}</p>
              </div>
            )}
          </div>
        )}

        {/* Alternativas "adesivo": borda grossa e lábio. Depois de responder,
            a certa fica verde, a escolhida errada fica vermelha. */}
        <div className={`grid gap-3 ${alternativasCurtas ? 'md:grid-cols-2' : ''}`}>
          {question.alternativas.map((alt, idx) => {
            const certa = respondeu && idx === question.correta;
            const errada = respondeu && idx === selectedAlt && idx !== question.correta;
            const caixa = certa
              ? 'bg-emerald-50 border-emerald-500 shadow-lip-esmeralda text-emerald-800'
              : errada
                ? 'bg-red-50 border-red-500 shadow-lip-vermelho text-red-800'
                : respondeu
                  ? 'bg-white border-slate-200 shadow-lip text-slate-400'
                  : 'bg-white border-slate-200 shadow-lip text-tinta-900 hover:bg-ceu-50 hover:border-ceu-200';
            const letra = certa
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : errada
                ? 'bg-red-500 border-red-500 text-white'
                : 'bg-white border-slate-200 text-slate-500';
            return (
              <m.button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={respondeu}
                initial={reduzir ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduzir ? { duration: 0 } : { delay: atrasoDoItem(idx), duration: 0.22 }}
                className={`w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-2xl border-2 ${caixa} transition-[background-color,border-color,transform] duration-150 text-base font-semibold min-h-[60px] enabled:active:translate-y-1 enabled:active:shadow-none ${
                  errou && idx === selectedAlt ? 'motion-safe:animate-shake' : ''
                } ${certa ? 'motion-safe:animate-scale-in' : ''}`}
              >
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] border-2 text-sm font-black shrink-0 ${letra}`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{alt}</span>
              </m.button>
            );
          })}
        </div>

        {/* Faixa de resultado: verde no acerto, vermelha no erro, com a
            explicação, o tutor e o botão de seguir. */}
        {respondeu && (
          <div
            className={`mt-6 rounded-[20px] p-5 md:p-6 space-y-3 md:space-y-0 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-6 md:items-end md:sticky md:bottom-4 md:z-20 md:border-2 animate-slide-up ${
              acertouAgora ? 'bg-emerald-100 md:border-emerald-300' : 'bg-red-100 md:border-red-300'
            }`}
            role="status"
          >
            {/* No computador vira a barra do Duolingo: texto à esquerda,
                botão à direita, grudada no fim da tela. */}
            <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 ${acertouAgora ? 'text-emerald-500' : 'text-red-500'}`}>
                {acertouAgora ? <Check size={24} strokeWidth={3.5} /> : <X size={24} strokeWidth={3.5} />}
              </span>
              <p className={`text-2xl font-black ${acertouAgora ? 'text-emerald-700' : 'text-red-700'}`}>
                {acertouAgora ? 'Mandou bem!' : 'Quase lá!'}
              </p>
            </div>
            {!acertouAgora && (
              <p className="text-base font-extrabold text-red-700">
                Resposta correta: {String.fromCharCode(65 + question.correta)}) {question.alternativas[question.correta]}
              </p>
            )}
            {showExplanation && (
              <div className="rounded-2xl bg-white/70 p-3.5">
                <p className={`text-xs font-extrabold uppercase tracking-wide mb-1 ${acertouAgora ? 'text-emerald-700' : 'text-red-700'}`}>
                  <BookOpen size={14} className="inline-block align-[-0.15em] mr-1" />Explicação
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{question.explicacao}</p>
              </div>
            )}
            {!acertouAgora && (
              tutorTexto[question.id] ? (
                <div className="rounded-2xl bg-white/70 p-3.5 animate-slide-up">
                  <p className="text-xs text-emerald-700 font-extrabold uppercase tracking-wide mb-1">Explicação do tutor</p>
                  <p className="text-sm text-tinta-700 leading-relaxed whitespace-pre-wrap">{tutorTexto[question.id]}</p>
                </div>
              ) : (
                <button
                  onClick={() => pedirExplicacaoTutor(currentIndex)}
                  disabled={tutorLoading !== null}
                  className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-red-700 hover:text-red-800 disabled:opacity-50"
                >
                  <Volume2 size={18} strokeWidth={2.5} />
                  {tutorLoading === question.id ? 'Chamando o tutor...' : 'Pedir explicação do tutor'}
                </button>
              )
            )}
            </div>
            <m.button
              onClick={nextQuestion}
              className={`${acertouAgora ? 'btn-sucesso' : 'btn-perigo'} w-full md:w-auto md:px-12 h-12 uppercase`}
              whileTap={reduzir ? undefined : { scale: 0.98 }}
              transition={springTap}
            >
              {currentIndex + 1 < questions.length ? 'Próxima' : 'Ver resultado'}
            </m.button>
          </div>
        )}
      </m.div>
      </AnimatePresence>
    </div>
  );
}
