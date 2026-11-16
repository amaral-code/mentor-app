import { MoodType, MicroTask, DailyPlan } from '../types';

/**
 * Engine de planejamento adaptativo baseado em humor.
 * 100% local, baseado em tabela fixa de estratégias.
 * Substituir por recomendação ML quando disponível.
 */

interface Strategy {
  mood: MoodType;
  tasks: Omit<MicroTask, 'id' | 'completed'>[];
}

const STRATEGIES: Strategy[] = [
  {
    mood: 'stress',
    tasks: [
      {
        titulo: 'Pausa Respiratória',
        descricao: '5 minutos de respiração 4-7-8 para acalmar o sistema nervoso',
        icon: 'respiracao',
      },
      {
        titulo: 'Revisão Leve',
        descricao: 'Folhear resumos antigos sem pressão de aprender algo novo',
        icon: 'escrita',
      },
      { titulo: 'Caminhada Curta', descricao: '10 minutos andando para liberar tensão', icon: 'passos' },
    ],
  },
  {
    mood: 'anxiety',
    tasks: [
      {
        titulo: 'Lista de Prioridades',
        descricao: 'Escrever 3 tarefas pequenas e realizáveis para hoje',
        icon: 'lista',
      },
      {
        titulo: 'Micro Meta de 5 min',
        descricao: 'Estudar um tópico fácil por apenas 5 minutos',
        icon: 'alvo',
      },
      {
        titulo: 'Exercício de Aterramento',
        descricao: 'Técnica 5-4-3-2-1: nomeie 5 coisas que vê, 4 que toca...',
        icon: 'mente',
      },
    ],
  },
  {
    mood: 'sadness',
    tasks: [
      {
        titulo: 'Pausa Autocompaixão',
        descricao: 'Tome uma bebida quente e escreva algo bom sobre você',
        icon: 'cafe',
      },
      {
        titulo: 'Leitura Inspiradora',
        descricao: 'Leia um texto curto e inspirador sobre superação',
        icon: 'livro',
      },
      {
        titulo: 'Estudo com Música',
        descricao: 'Escolha uma playlist calma e revise um assunto fácil',
        icon: 'musica',
      },
    ],
  },
  {
    mood: 'tired',
    tasks: [
      {
        titulo: 'Power Nap',
        descricao: '15-20 minutos de cochilo para recarregar as energias',
        icon: 'sono',
      },
      {
        titulo: 'Hidratação + Lanche',
        descricao: 'Beba água e coma algo leve antes de continuar',
        icon: 'gota',
      },
      {
        titulo: 'Vídeo Aula Curta',
        descricao: 'Assista a uma videoaula de no máximo 15 minutos',
        icon: 'video',
      },
    ],
  },
  {
    mood: 'demotivated',
    tasks: [
      {
        titulo: 'Tarefa Mais Fácil',
        descricao: 'Comece pela tarefa mais trivial que você precisa fazer',
        icon: 'brilho',
      },
      {
        titulo: 'Meta Ridícula',
        descricao: 'Estude por apenas 2 minutos. Depois pode parar, se quiser',
        icon: 'trofeu',
      },
      {
        titulo: 'Registre o Progresso',
        descricao: 'Tire print do que já estudou esta semana: você fez mais do que lembra',
        icon: 'brilho',
      },
    ],
  },
  {
    mood: 'focused',
    tasks: [
      {
        titulo: '⏱ Sessão Rota Ultra',
        descricao: 'Ciclo de 10 minutos de foco total em uma única matéria',
        icon: 'cronometro',
      },
      {
        titulo: 'Matéria Mais Difícil',
        descricao: 'Aproveite o foco para encarar o tópico mais desafiador',
        icon: 'marcador',
      },
      {
        titulo: 'Resumo Ativo',
        descricao: 'Escreva um resumo do que aprendeu sem consultar o material',
        icon: 'brilho',
      },
    ],
  },
  {
    mood: 'motivated',
    tasks: [
      {
        titulo: 'Sessão Extra',
        descricao: 'Faça um ciclo extra de estudo além do planejado',
        icon: 'foguete',
      },
      {
        titulo: 'Quiz Desafiador',
        descricao: 'Tente responder questões mais difíceis da matéria atual',
        icon: 'escrita',
      },
      {
        titulo: 'Ensine Alguém',
        descricao: 'Explique o que aprendeu em voz alta como se estivesse ensinando',
        icon: 'livro',
      },
    ],
  },
  {
    mood: 'happy',
    tasks: [
      { titulo: 'Compartilhe', descricao: 'Conte para alguém o que te fez feliz hoje', icon: 'brilho' },
      {
        titulo: 'Estudo Criativo',
        descricao: 'Faça um mapa mental ou desenho sobre o assunto estudado',
        icon: 'brilho',
      },
      {
        titulo: 'Revisão Gamificada',
        descricao: 'Transforme a revisão em um jogo: pontue cada acerto',
        icon: 'medalha',
      },
    ],
  },
  {
    mood: 'energetic',
    tasks: [
      {
        titulo: 'Sessão Intensa',
        descricao: 'Aproveite a energia para um ciclo de estudo profundo',
        icon: 'raio',
      },
      {
        titulo: 'Exercício + Estudo',
        descricao: 'Ouça um podcast educacional enquanto se exercita',
        icon: 'brilho',
      },
      {
        titulo: 'Desafio de Questões',
        descricao: 'Tente bater seu recorde de questões em 20 minutos',
        icon: 'alvo',
      },
    ],
  },
  {
    mood: 'neutral',
    tasks: [
      { titulo: 'Revisão Geral', descricao: 'Revise o resumo da semana anterior', icon: 'marcador' },
      {
        titulo: 'Exercícios Padrão',
        descricao: 'Resolva 5 questões de matemática e 5 de português',
        icon: 'escrita',
      },
      {
        titulo: 'Organize os Estudos',
        descricao: 'Atualize seu cronograma e organize os materiais',
        icon: 'brilho',
      },
    ],
  },
];

/**
 * Gera o plano do dia a partir do humor.
 *
 * ROTACAO SEMANAL: o mesmo humor gerava as mesmas 3 tarefas todo dia, e o
 * aluno decorava a sequencia em vez de estudar. `diaSemana` (0 = domingo)
 * gira a ordem e desloca o ponto de partida, entao cada dia tem uma
 * combinacao diferente — sem precisar de rede ou de banco novo.
 */
export function generatePlan(mood: MoodType, diaSemana: number = new Date().getDay()): Omit<DailyPlan, 'date'> {
  const strategy = STRATEGIES.find((s) => s.mood === mood) || STRATEGIES[STRATEGIES.length - 1];
  const base = strategy.tasks;
  const giro = ((diaSemana % base.length) + base.length) % base.length;
  const rotacionadas = [...base.slice(giro), ...base.slice(0, giro)];
  const tasks: MicroTask[] = rotacionadas.map((t) => ({
    ...t,
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    completed: false,
  }));

  return { mood, tasks };
}

export const XP_PER_TASK = 20;
