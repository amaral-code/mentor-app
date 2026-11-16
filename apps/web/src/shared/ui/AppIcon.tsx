import {
  Angry,
  BatteryLow,
  BicepsFlexed,
  BookMarked,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudRain,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  FlaskConical,
  Footprints,
  Frown,
  Gauge,
  Glasses,
  Globe,
  Headphones,
  Heart,
  Lightbulb,
  ListChecks,
  Lock,
  Medal,
  Meh,
  Moon,
  Music,
  Network,
  NotebookPen,
  PartyPopper,
  PenLine,
  Rocket,
  Ruler,
  Salad,
  Shirt,
  Smile,
  Sparkles,
  Star,
  Sunrise,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Video,
  Wind,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { MOOD_COLOR } from '../lib/utils';
import type { MoodType } from '../types';

/**
 * Ponte entre dados e icones.
 *
 * Modulos de dados puros (plannerEngine, storeCatalog, dropoutRisk) nao
 * podem importar componentes React: sao testados em node e usados fora da
 * arvore de renderizacao. Antes eles carregavam um emoji em string, o que
 * resolvia o acoplamento mas renderizava diferente em cada sistema
 * operacional. Agora carregam um NOME, e este mapa resolve o componente.
 */
const REGISTRO: Record<string, LucideIcon> = {
  alerta: TriangleAlert,
  bateria: BatteryLow,
  bussola: Gauge,
  cafe: Coffee,
  calendario: Calendar,
  caderno: NotebookPen,
  certo: CheckCircle2,
  chuva: CloudRain,
  coracao: Heart,
  cronometro: Timer,
  errado: XCircle,
  escrita: PenLine,
  estrela: Star,
  festa: PartyPopper,
  fogo: Flame,
  fone: Headphones,
  forca: BicepsFlexed,
  gota: Droplet,
  haltere: Dumbbell,
  ideia: Lightbulb,
  cadeado: Lock,
  lista: ClipboardList,
  livro: BookOpen,
  luaCheia: Moon,
  marcador: BookMarked,
  medalha: Medal,
  mente: Brain,
  musica: Music,
  nuvem: Cloud,
  passos: Footprints,
  raio: Zap,
  refeicao: Salad,
  respiracao: Wind,
  foguete: Rocket,
  sono: Moon,
  subida: TrendingUp,
  tarefas: ListChecks,
  alvo: Target,
  trofeu: Trophy,
  video: Video,
  brilho: Sparkles,
  amanhecer: Sunrise,
  // itens da loja
  moletom: Shirt,
  oculos: Glasses,
  // materias e ferramentas
  regua: Ruler,
  ciencia: FlaskConical,
  globo: Globe,
  mapaMental: Network,
};

interface AppIconProps {
  /** Chave do registro acima. */
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/** Renderiza um icone a partir do nome guardado nos dados. */
export function AppIcon({ name, size = 18, className = '', strokeWidth = 2 }: AppIconProps) {
  const Icon = REGISTRO[name] ?? Sparkles;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}

/* ====================================================================
   Humores
   ==================================================================== */

const MOOD_ICON: Record<MoodType, LucideIcon> = {
  stress: Angry,
  anxiety: CloudRain,
  sadness: Frown,
  tired: Moon,
  demotivated: Cloud,
  focused: Target,
  motivated: Rocket,
  happy: Smile,
  energetic: Zap,
  neutral: Meh,
};

interface MoodIconProps {
  mood: MoodType;
  size?: number;
  className?: string;
  /** Aplica a cor de MOOD_COLOR. Desligue para herdar a cor do contexto. */
  colorize?: boolean;
}

/**
 * Icone do humor, com a cor que ja estava definida em MOOD_COLOR.
 *
 * Substitui MOOD_EMOJI. Alem da consistencia visual, o emoji de humor era
 * um problema de acessibilidade: o leitor de tela anunciava "rosto
 * desanimado" no meio da frase. Aqui o icone e decorativo e o rotulo de
 * texto ao lado carrega o significado.
 */
export function MoodIcon({ mood, size = 18, className = '', colorize = true }: MoodIconProps) {
  const Icon = MOOD_ICON[mood] ?? Meh;
  return (
    <Icon
      size={size}
      className={className}
      style={colorize ? { color: MOOD_COLOR[mood] } : undefined}
      aria-hidden="true"
    />
  );
}
