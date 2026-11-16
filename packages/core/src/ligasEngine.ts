export interface StudyLeagueGoal {
  id: string;
  title: string;
  description: string;
  target: number;
  unit: string;
  completedBy?: string[];
}

export interface StudyLeagueMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  type?: 'system' | 'user';
}

export interface StudyLeague {
  id: string;
  title: string;
  prompt: string;
  authorName: string;
  turma: string;
  escola: string;
  discipline: string;
  xpReward: number;
  status: 'open' | 'accepted';
  acceptedBy: string[];
  acceptedByNames: string[];
  joinedBy: string[];
  joinedByNames: string[];
  inviteCode?: string;
  private?: boolean;
  goals: StudyLeagueGoal[];
  messages: StudyLeagueMessage[];
}

export interface CreateStudyLeagueInput {
  id: string;
  title: string;
  prompt: string;
  authorName: string;
  turma: string;
  escola: string;
  discipline: string;
  xpReward: number;
  goals?: StudyLeagueGoal[];
}

export function normalizeStudyLeague(league: Partial<StudyLeague> & Pick<StudyLeague, 'id' | 'title' | 'prompt' | 'authorName' | 'turma' | 'escola' | 'xpReward'>): StudyLeague {
  return {
    id: league.id,
    title: league.title,
    prompt: league.prompt,
    authorName: league.authorName,
    turma: league.turma,
    escola: league.escola,
    discipline: league.discipline || 'Geral',
    xpReward: league.xpReward,
    status: league.status || 'open',
    acceptedBy: league.acceptedBy || [],
    acceptedByNames: league.acceptedByNames || [],
    joinedBy: league.joinedBy || league.acceptedBy || [],
    joinedByNames: league.joinedByNames || league.acceptedByNames || [],
    inviteCode: league.inviteCode || `L${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    private: league.private ?? true,
    goals: (league.goals || []).map(goal => ({
      id: goal.id,
      title: goal.title,
      description: goal.description,
      target: goal.target,
      unit: goal.unit,
      completedBy: goal.completedBy || [],
    })),
    messages: (league.messages || []).map(message => ({
      id: message.id,
      userId: message.userId,
      userName: message.userName,
      text: message.text,
      timestamp: message.timestamp,
      type: message.type || 'user',
    })),
  };
}

export function createStudyLeague(input: CreateStudyLeagueInput): StudyLeague {
  return normalizeStudyLeague({
    id: input.id,
    title: input.title,
    prompt: input.prompt,
    authorName: input.authorName,
    turma: input.turma,
    escola: input.escola,
    discipline: input.discipline,
    xpReward: input.xpReward,
    goals: input.goals || [],
    messages: [],
  });
}

export function joinLeague(league: StudyLeague, userId: string, userName: string): StudyLeague {
  if (league.joinedBy.includes(userId)) {
    return league;
  }

  return {
    ...league,
    status: 'accepted',
    acceptedBy: [...league.acceptedBy, userId],
    acceptedByNames: [...league.acceptedByNames, userName],
    joinedBy: [...league.joinedBy, userId],
    joinedByNames: [...league.joinedByNames, userName],
    private: true,
    messages: [
      ...league.messages,
      {
        id: `join_${Date.now()}`,
        userId,
        userName,
        text: 'Entrou na liga e passou a fazer parte do grupo.',
        timestamp: Date.now(),
        type: 'system',
      },
    ],
  };
}

export function toggleGoalCompletion(league: StudyLeague, goalId: string, userId: string): StudyLeague {
  return {
    ...league,
    goals: league.goals.map(goal => {
      if (goal.id !== goalId) return goal;
      const completedBy = goal.completedBy || [];
      const alreadyCompleted = completedBy.includes(userId);
      return {
        ...goal,
        completedBy: alreadyCompleted
          ? completedBy.filter(id => id !== userId)
          : [...completedBy, userId],
      };
    }),
  };
}

export function getLeaguesJoinedByUser(leagues: StudyLeague[], userId: string): StudyLeague[] {
  return leagues.filter(liga => liga.joinedBy.includes(userId));
}

export function canJoinMoreLeagues(leagues: StudyLeague[], userId: string, maxLeagues: number = 2): boolean {
  return getLeaguesJoinedByUser(leagues, userId).length < maxLeagues;
}

export function postLeagueMessage(league: StudyLeague, message: Omit<StudyLeagueMessage, 'timestamp'>): StudyLeague {
  return {
    ...league,
    messages: [
      ...league.messages,
      {
        ...message,
        type: message.type || 'user',
        timestamp: Date.now(),
      },
    ],
  };
}
