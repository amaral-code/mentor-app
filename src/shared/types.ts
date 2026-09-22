// ===== Auth =====
// Espelha o enum papel_usuario do banco.
export type UserRole = 'student' | 'educator' | 'parent' | 'admin' | 'psychologist' | 'teacher';

/**
 * Perfil do usuario (tabela `perfis`).
 *
 * NAO existe campo de senha: a senha vive no Supabase Auth (bcrypt, no
 * servidor) e nunca passa pelo nosso codigo alem do POST de login.
 */
export interface User {
  uid: string;              // = auth.users.id
  email: string;
  nome: string;
  sobrenome?: string;
  metaEstudo?: string;
  role: UserRole;
  escolaId?: string | null;
  turmaId?: string | null;
}

/**
 * Sessao ativa. Derivada do JWT + tabela `perfis`, nunca do localStorage:
 * um objeto de sessao gravado no navegador e editavel pelo usuario, o que
 * tornava o papel forjavel.
 */
export interface Session {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  escolaId?: string | null;
  turmaId?: string | null;
  /** Conta importada pela secretaria: precisa trocar a senha temporária. */
  deveTrocarSenha?: boolean;
  /** Onboarding inteligente: false = primeiro acesso (wizard), true = recorrente. */
  onboardingCompleted: boolean;
  /** Metas escolhidas no passo 2 (ex.: "Passar no ENEM"). */
  metasEstudo: string[];
  /** Disponibilidade do passo 3 (ex.: "1 hora"). */
  tempoDiarioEstudo?: string | null;
  /** Turno principal do passo 3 ("manha" | "tarde" | "noite"). */
  turnoEstudo?: string | null;
}

export type RolePage = 'dashboard' | 'educator-dashboard' | 'parent-dashboard';

// ===== Mood/Emotion =====
export type MoodType = 'stress' | 'anxiety' | 'sadness' | 'tired' | 'demotivated' | 'focused' | 'motivated' | 'happy' | 'energetic' | 'neutral';

export interface MoodEntry {
  timestamp: number;
  mood: MoodType;
  text?: string;
}

export interface EmotionWord {
  word: string;
  mood: MoodType;
  valence: number; // -1 to 1
  sscDelta: number; // -10 to 10
}

// ===== SSC =====
export interface SSCInput {
  sono: number; // 0-12
  cansaco: number; // 0-10
  mood: MoodType;
}

export type SSCLevel = 'normal' | 'attention' | 'critical';

// ===== Planner =====
export interface MicroTask {
  id: string;
  titulo: string;
  descricao: string;
  /** Nome do icone no registro de AppIcon (antes era um emoji em string). */
  icon: string;
  completed: boolean;
}

export interface DailyPlan {
  date: string; // YYYY-MM-DD
  mood: MoodType;
  tasks: MicroTask[];
}

// ===== Gamification =====
export interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  lastAccessDate: string; // YYYY-MM-DD
}

// ===== Chat =====
/** Thread do Mentor (migration 016): historico lateral da conta. */
export interface Conversa {
  id: string;
  titulo: string;
  modo: string;
  criadoEm: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  mood?: MoodType;
  image?: string;

  /**
   * Grounding: de onde a resposta veio.
   *
   * Vive so na sessao - chat_mensagens nao tem coluna para isso, e
   * guardar o link de uma busca que expira teria pouco valor depois. O
   * que importa e o aluno enxergar a procedencia NA HORA de ler a
   * resposta, que e quando ele decide se confia.
   */
  fontes?: { titulo: string; uri: string; dominio: string }[];
  /** A busca do Google foi de fato usada nesta resposta. */
  groundingUsado?: boolean;
  /** A resposta cita banca + ano (ex.: "ENEM 2019"). */
  citouProva?: boolean;
  /** Modo tematico ativo quando a resposta foi gerada. */
  modoChat?: string;
  /** Toggle Explicativo/Comunicativo vigente na resposta (selo Didático/Macete). */
  modoResposta?: 'explicativo' | 'comunicativo';
}

export interface KBEntry {
  id: string;
  keywords: string[];
  content: string;
  source: 'faq' | 'quiz';
}

// ===== Essay =====
export interface EssayCorrection {
  competencia1: number; // 0-200
  competencia2: number;
  competencia3: number;
  competencia4: number;
  competencia5: number;
  notaFinal: number;
  pontosFortes: string[];
  pontosMelhorar: string[];
  originalText: string;
}

export interface ChallengeResult {
  id: string;
  tema: string;
  notaFinal: number;
  competencia1: number;
  competencia2: number;
  competencia3: number;
  competencia4: number;
  competencia5: number;
  xpGanho: number;
  tempoUsadoSegundos: number;
  finalizado: boolean; // enviado dentro do prazo
  timestamp: number;
}

// ===== Quiz =====
export interface QuizQuestion {
  id: string;
  materia: string;
  /** Assunto especifico da questao (ex.: "Funções afins"). Informado pela IA. */
  topico?: string;
  enunciado: string;
  /** Sempre 4 alternativas na geracao por IA; apenas uma correta. */
  alternativas: string[];
  correta: number; // index
  explicacao: string;
  /** Pista curta que ajuda sem entregar a resposta. Informada pela IA. */
  dica?: string;
  /**
   * Origem declarada pela IA: "ENEM 2022" quando inspirada em prova real,
   * ou "inédita, estilo <banca>" quando criada no padrão da banca.
   * Nunca apresentada como oficial quando for inédita.
   */
  fonte?: string;
  /**
   * Informada pela IA na geracao. Alimenta a feature "tempo demais em
   * questao facil" do modelo de fadiga - sem ela, ficar 4 minutos numa
   * questao dificil pareceria o mesmo sintoma.
   */
  dificuldade?: Dificuldade;
}

export interface QuizResult {
  materia: string;
  acertos: number;
  total: number;
  xpGanho: number;
  timestamp: number;
}

// ===== Notebook =====
export interface Nota {
  id: string;
  text: string;
  data: string; // ISO date
  tag?: string;
}

// ===== Log =====
export type LogEventType = 'atividade' | 'exercicio' | 'foco' | 'quiz' | 'essay' | 'login' | 'tutorial';

export interface LogEntry {
  timestamp: number;
  type: LogEventType;
  description: string;
  xp?: number;
}

// ===== Storage =====
export interface StorageRepository<T> {
  get(id: string): T | null;
  set(id: string, data: T): void;
  list(): T[];
  push(data: T): void;
  delete(id: string): void;
}

// ===== Weekly Report =====
export interface WeeklyReport {
  diasAtivos: number;
  totalAtividades: number;
  totalExercicios: number;
  performance: 'excelente' | 'boa' | 'regular' | 'atencao';
  analise: string;
  days: { date: string; active: boolean }[];
}

// ===== Persona =====
export interface ChatPersona {
  id: string;
  name: string;
  icon: string;
  color: string;
  instruction: string;
  createdAt: number;
  /**
   * Materia a que este professor se limita.
   *
   * So os professores embutidos tem escopo; persona criada pelo usuario
   * fica sem, e nesse caso nenhuma regra de recusa e aplicada - inventar
   * um limite que o usuario nao pediu faria a persona dele recusar as
   * proprias perguntas. Quando existe, vira uma regra explicita no
   * system instruction (ver montarInstrucaoDaPersona em aiService).
   */
  escopo?: string;
}

// ===== School / Class / Ranking =====
export type TurmaKey = string; // "3A-MAT" | "3B-HUM" etc
export type EscolaKey = string; // "escola_1" etc

export interface Escola {
  id: EscolaKey;
  nome: string;
  cidade?: string;
  cor?: string;
}

export interface Turma {
  id: TurmaKey;
  nome: string;
  escolaId: EscolaKey;
  ano?: string;
}

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  escolaId?: EscolaKey;
  turmaId?: TurmaKey;
  avatarUrl?: string;
}

export interface RankingEntry {
  posicao: number;
  nome: string;
  turma: string;
  turmaId: TurmaKey;
  escola: string;
  escolaId: EscolaKey;
  xp: number;
  level: number;
  streak: number;
  avatarInicial: string;
  destaque?: boolean; // current user
  variacao?: number; // position change vs last week (-2, +1, 0)
}

export type RankingFilter = 'geral' | 'turma' | 'escola';

export interface RankingData {
  filter: RankingFilter;
  label: string;
  entries: RankingEntry[];
  totalParticipantes: number;
  updatedAt: number;
}

// ===== Community Chat =====
export interface CommunityMessage {
  id: string;
  escolaId: EscolaKey;
  turmaId: TurmaKey;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  moderated: boolean;
  moderatedReason?: string;
  replyTo?: string;
  likes?: number;
  likedBy?: string[];
  materia?: string;
}

export interface CommunityChatFilter {
  escolaId: EscolaKey;
  materia?: string;
}

// ===== Tab Navigation =====
export type TabId =
  | 'dashboard' | 'chat' | 'essay' | 'notebook' | 'quiz' | 'profile' | 'ranking'
  | 'foco' | 'comunidade' | 'store'
  // Sala de Foco (body doubling, migration 023)
  | 'sala'
  // Modulo de bem-estar (migracoes 010/011)
  | 'escudo' | 'audio' | 'calendario' | 'cuidado'
  // Agenda de consultas com psicologos (marketplace)
  | 'agenda'
  // Analytics do quiz (migration 015)
  | 'estatisticas';

export interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

// =====================================================================
// Modulo de bem-estar, marketplace e foco offline (migracoes 010/011)
// =====================================================================

// ===== Marketplace de psicologos =====
export interface Psicologo {
  id: string;
  nome: string;
  crp: string;
  bio: string;
  especialidades: string[];
  abordagem: string;
  valorCentavos: number;
  duracaoMinutos: number;
  fotoUrl?: string | null;
  aceitaNovos: boolean;
  notaMedia: number;
  totalAtendimentos: number;
}

/** Janela semanal recorrente declarada pelo profissional. */
export interface JanelaDisponibilidade {
  diaSemana: number; // 0 = domingo
  horaInicio: string; // "14:00"
  horaFim: string; // "20:00"
}

/** Horario concreto oferecido ao responsavel, derivado das janelas. */
export interface SlotAgenda {
  inicio: string; // ISO
  fim: string; // ISO
}

export type StatusPagamento = 'pendente' | 'pago' | 'reembolsado' | 'falhou' | 'isento';
export type StatusAgendamento = 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'no_show';
export type ProvedorSala = 'jitsi' | 'google_meet' | 'zoom' | 'manual';

export interface Agendamento {
  id: string;
  alunoId: string;
  alunoNome?: string;
  responsavelId?: string | null;
  psicologoId: string;
  psicologoNome?: string;
  alertaId?: string | null;
  inicio: string; // ISO
  fim: string; // ISO
  duracaoMinutos: number;
  meetingUrl?: string | null;
  meetingProvider: ProvedorSala;
  valorCentavos: number;
  statusPagamento: StatusPagamento;
  status: StatusAgendamento;
}

export type SeveridadeAlerta = 'info' | 'atencao' | 'alto' | 'critico';
export type StatusAlerta = 'aberto' | 'visto' | 'em_atendimento' | 'resolvido';

export interface AlertaSaudeMental {
  id: string;
  alunoId: string;
  alunoNome?: string;
  tipo: string; // burnout | ssc | humor | evasao | madrugada
  severidade: SeveridadeAlerta;
  score: number;
  gatilho: Record<string, unknown>;
  mensagem: string;
  status: StatusAlerta;
  criadoEm: string;
}

export type StatusVinculo = 'pendente' | 'ativo' | 'recusado' | 'revogado';

export interface VinculoResponsavel {
  id: string;
  responsavelId: string;
  alunoId: string;
  alunoNome?: string;
  responsavelNome?: string;
  parentesco: string;
  status: StatusVinculo;
  criadoEm: string;
}

export interface Notificacao {
  id: string;
  canal: 'email' | 'push' | 'in_app';
  tipo: string;
  titulo: string;
  corpo: string;
  payload: Record<string, unknown>;
  lida: boolean;
  criadoEm: string;
}

// ===== Escudo de dopamina =====
export type ModoEscudo = 'leve' | 'enem' | 'maratona';

export interface SessaoOffline {
  id?: number;
  inicio: string; // ISO
  fim: string; // ISO
  minutosOffline: number;
  interrupcoes: number;
  modo: ModoEscudo;
  moedasCreditadas: number;
}

export interface CarteiraFoco {
  saldo: number;
  totalGanho: number;
  totalGasto: number;
}

// ===== Telemetria e burnout =====
export type Dificuldade = 'facil' | 'media' | 'dificil';

export interface EventoTelemetria {
  questionId: string;
  materia: string;
  dificuldade: Dificuldade;
  tempoGastoSegundos: number;
  acertou: boolean;
  horaLocal: number; // 0-23
  timestamp: number;
}

export type ClasseBurnout = 'saudavel' | 'alerta' | 'fadiga' | 'esgotamento';

export interface IndiceBurnout {
  data: string; // YYYY-MM-DD
  score: number; // 0-100
  classe: ClasseBurnout;
  features: Record<string, number>;
}

// ===== Pilulas de audio =====
export interface ModuloAudio {
  id: string;
  materia: string;
  topico: string;
  titulo: string;
  resumo: string;
  roteiro: string;
  audioUrl?: string | null;
  duracaoSegundos: number;
  voz: string;
}

export interface ProgressoAudio {
  moduloId: string;
  segundosOuvidos: number;
  concluido: boolean;
}

// ===== Revisao espacada (Ebbinghaus / SRS) =====
export interface RevisaoEspacada {
  id?: number;
  topicoId: string;
  topicoNome: string;
  materia: string;
  nivelMemoria: number; // 0-5
  intervaloDias: number;
  facilidade: number; // 1.3 - 3.0
  ultimaNota?: number;
  revisoesFeitas: number;
  proximaRevisao: string; // YYYY-MM-DD
  ultimaRevisao?: string | null;
}

// ===== Intervencoes da IA =====
export interface IntervencaoIA {
  id?: number;
  tipo: 'doomscroll' | 'burnout' | 'madrugada';
  mensagem: string;
  gatilho: Record<string, unknown>;
  aceita?: boolean | null;
  criadoEm?: string;
}

// ===== Relatorio de descompressao =====
export interface RelatorioSemanal {
  id?: number;
  semanaInicio: string; // YYYY-MM-DD (segunda-feira)
  textoGerado: string;
  metricas: MetricasDescompressao;
  lido: boolean;
}

export interface MetricasDescompressao {
  diasAtivos: number;
  minutosOffline: number;
  minutosFoco: number;
  horasSonoMedia: number;
  questoesRespondidas: number;
  taxaAcerto: number;
  streak: number;
  sessoesMadrugada: number;
  revisoesEmDia: number;
}
