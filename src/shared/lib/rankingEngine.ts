import type { Escola, Turma, RankingEntry, RankingFilter, RankingData, UserProfile } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';

// === Escolas demo simuladas ===
export const ESCOLAS: Escola[] = [
  { id: 'escola_1', nome: 'Colégio Ampli', cidade: 'São Paulo', cor: '#f59e0b' },
  { id: 'escola_2', nome: 'Instituto Saber', cidade: 'Rio de Janeiro', cor: '#3b82f6' },
  { id: 'escola_3', nome: 'Colégio Futuro', cidade: 'Belo Horizonte', cor: '#10b981' },
  { id: 'escola_4', nome: 'Centro Educacional Nova Geração', cidade: 'Curitiba', cor: '#8b5cf6' },
  { id: 'escola_5', nome: 'Colégio Primavera', cidade: 'Salvador', cor: '#ec4899' },
];

export const TURMAS: Turma[] = [
  { id: '1A-EXA', nome: '1ª Série A (Exatas)', escolaId: 'escola_1' },
  { id: '1B-HUM', nome: '1ª Série B (Humanas)', escolaId: 'escola_1' },
  { id: '2A-EXA', nome: '2ª Série A (Exatas)', escolaId: 'escola_1' },
  { id: '2B-HUM', nome: '2ª Série B (Humanas)', escolaId: 'escola_1' },
  { id: '3A-INT', nome: '3ª Série A (Integrado)', escolaId: 'escola_1' },
  { id: '3B-INT', nome: '3ª Série B (Integrado)', escolaId: 'escola_1' },
  { id: 'SA-1A', nome: '1ª Série A', escolaId: 'escola_2' },
  { id: 'SA-2A', nome: '2ª Série A', escolaId: 'escola_2' },
  { id: 'SA-3A', nome: '3ª Série A', escolaId: 'escola_2' },
  { id: 'CF-1A', nome: '1º Ano EM', escolaId: 'escola_3' },
  { id: 'CF-2A', nome: '2º Ano EM', escolaId: 'escola_3' },
  { id: 'CF-3A', nome: '3º Ano EM', escolaId: 'escola_3' },
  { id: 'CNG-1A', nome: '1ª Série', escolaId: 'escola_4' },
  { id: 'CNG-2A', nome: '2ª Série', escolaId: 'escola_4' },
  { id: 'CNG-3A', nome: '3ª Série', escolaId: 'escola_4' },
  { id: 'CP-1A', nome: '1º Ano', escolaId: 'escola_5' },
  { id: 'CP-2A', nome: '2º Ano', escolaId: 'escola_5' },
  { id: 'CP-3A', nome: '3º Ano', escolaId: 'escola_5' },
];

const ADJETIVOS = [
  'Determinado',
  'Focado',
  'Persistente',
  'Incansável',
  'Brillante',
  'Estratégico',
  'Disciplinado',
  'Intenso',
  'Dedicado',
  'Guerreiro',
  'Supremo',
  'Ágil',
  'Veloz',
  'Expert',
  'Ninja',
  'Lendário',
  'Invencível',
  'Poderoso',
  'Sábio',
  'Audaz',
  'Valente',
  'Campeão',
  'Raio',
  'Fera',
  'Mestre',
  'Super',
  'Turbo',
  'Ligeiro',
  'Top',
  'Brabo',
];

const ANIMAIS = [
  'Coruja',
  'Leão',
  'Fênix',
  'Tubarão',
  'Águia',
  'Pantera',
  'Lobo',
  'Falcão',
  'Tigre',
  'Grifo',
  'Orca',
  'Gavião',
  'Cervo',
  'Lince',
  'Bufalo',
  'Jaguar',
  'Condor',
  'Lontra',
  'Zebra',
  'Gazela',
  'Puma',
  'Harpia',
  'Tucano',
  'Arara',
  'Pégaso',
];

/** Apelido anonimo e estavel: o ranking nao expoe nome real de ninguem. */
function gerarNickname(seed: number): string {
  const adj = ADJETIVOS[Math.floor(seedRandom(seed) * ADJETIVOS.length)];
  const animal = ANIMAIS[Math.floor(seedRandom(seed + 50) * ANIMAIS.length)];
  const num = Math.floor(seedRandom(seed + 150) * 99) + 1;
  return `${animal}${adj}${num}`;
}

function nivelPorXp(xp: number): number {
  let level = 1;
  let acc = 0;
  while (acc + 100 * level <= xp) {
    acc += 100 * level;
    level++;
  }
  return level;
}

/* ---------------------------------------------------------------------
 * Cache de escolas, turmas e perfil.
 *
 * Estas funcoes sao SINCRONAS e chamadas de dentro do render, mas os dados
 * agora vivem no banco. Em vez de tornar tudo assincrono (o que
 * contaminaria varios componentes), o App hidrata este cache uma vez no
 * login via hidratarCache(); as leituras seguem instantaneas.
 *
 * Enquanto o cache nao chega, valem as constantes ESCOLAS/TURMAS, que sao
 * so a semente de demonstracao.
 * ------------------------------------------------------------------- */

let cacheEscolas: Escola[] | null = null;
let cacheTurmas: Turma[] | null = null;
let cachePerfil: UserProfile | null = null;

export function hidratarCache(dados: { escolas?: Escola[]; turmas?: Turma[]; perfil?: UserProfile }): void {
  if (dados.escolas) cacheEscolas = dados.escolas;
  if (dados.turmas) cacheTurmas = dados.turmas;
  if (dados.perfil) cachePerfil = dados.perfil;
}

export function limparCache(): void {
  cacheEscolas = null;
  cacheTurmas = null;
  cachePerfil = null;
}

/** Escolas disponiveis (do banco, com fallback para a semente). */
export function getEscolasCadastradas(): Escola[] {
  return cacheEscolas && cacheEscolas.length > 0 ? cacheEscolas : ESCOLAS;
}

export function getTurmasCadastradas(): Turma[] {
  return cacheTurmas && cacheTurmas.length > 0 ? cacheTurmas : TURMAS;
}

export function getProfile(uid: string): UserProfile {
  if (cachePerfil && cachePerfil.uid === uid) return cachePerfil;
  return { uid, nome: 'Você', email: '' };
}

/** Gera dados mock de ranking para demonstração offline */
function gerarRankingMock(
  filter: RankingFilter,
  userProfile: UserProfile,
  userXp: number,
  userStreak: number,
): RankingEntry[] {
  const escolas = getEscolasCadastradas();
  const turmas = getTurmasCadastradas();
  const entries: RankingEntry[] = [];
  const rng = seedFromString(userProfile.uid || 'default');

  // Each entry - anonymous nicknames (LGPD compliant, like Duolingo)
  for (let i = 0; i < ADJETIVOS.length * ANIMAIS.length; i++) {
    if (entries.length >= 48) break;
    const nickname = gerarNickname(rng + i * 7);
    const turma = turmas[i % turmas.length];
    const escola = escolas.find((e) => e.id === turma.escolaId) || escolas[0];
    const xp = gerarXpMockSeed(rng + i * 3 + 1);
    const streak = gerarStreakMockSeed(rng + i * 3 + 100);
    entries.push({
      posicao: 0,
      nome: nickname,
      turma: turma.nome,
      turmaId: turma.id,
      escola: escola.nome,
      escolaId: escola.id,
      xp,
      level: nivelPorXp(xp),
      streak,
      avatarInicial: '',
      destaque: false,
      variacao: Math.floor((seedRandom(rng + i * 3) - 0.5) * 6) - 2,
    });
  }

  const userEntry: RankingEntry = {
    posicao: 0,
    nome: userProfile.nome || 'Você',
    turma: turmas.find((t) => t.id === userProfile.turmaId)?.nome || 'sem turma',
    turmaId: userProfile.turmaId || '',
    escola: escolas.find((e) => e.id === userProfile.escolaId)?.nome || 'sem escola',
    escolaId: userProfile.escolaId || '',
    xp: userXp,
    level: nivelPorXp(userXp),
    streak: userStreak,
    avatarInicial: userProfile.nome?.charAt(0)?.toUpperCase() || 'V',
    destaque: true,
    variacao: 0,
  };
  entries.push(userEntry);

  // Filter
  let filtered = entries;
  if (filter === 'turma' && userProfile.turmaId) {
    filtered = entries.filter((e) => e.turmaId === userProfile.turmaId);
  } else if (filter === 'escola' && userProfile.escolaId) {
    filtered = entries.filter((e) => e.escolaId === userProfile.escolaId);
  }

  // Sort by XP descending
  filtered.sort((a, b) => b.xp - a.xp);

  // Assign positions
  return filtered.map((e, i) => ({ ...e, posicao: i + 1 }));
}

/** Busca dados reais do Supabase */
/**
 * Ranking real, vindo da view `ranking`.
 *
 * A versao anterior consultava `profiles` e `gamification`, tabelas do
 * 001_schema.sql que NUNCA existiram neste banco. As duas chamadas
 * devolviam 404, o catch engolia, e a tela caia nos dados de demonstracao
 * sem avisar ninguem: o aluno via um ranking inventado achando que era o
 * da turma dele.
 *
 * A view ja resolve dois problemas no servidor: junta perfil com
 * gamificacao e limita o escopo a colegas de escola ou de liga, para nao
 * expor nome e escola de estudantes menores de idade a qualquer conta.
 */
async function gerarRankingSupabase(
  filter: RankingFilter,
  userProfile: UserProfile,
): Promise<RankingEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('ranking')
    .select('id, nome, escola_id, turma_id, escola_nome, turma_nome, xp, level, streak')
    .order('xp', { ascending: false })
    .limit(500);

  if (error) {
    console.warn('[ranking] consulta falhou:', error.message);
    return [];
  }

  const entries: RankingEntry[] = (data ?? []).map((r: any, idx: number) => {
    const eu = r.id === userProfile.uid;
    return {
      posicao: 0,
      // Apelido anonimo para os colegas: o ranking nao precisa expor o
      // nome real de ninguem para funcionar.
      nome: eu ? userProfile.nome || 'Você' : gerarNickname(seedFromString(r.id || `${idx}`)),
      turma: r.turma_nome || 'sem turma',
      turmaId: r.turma_id || '',
      escola: r.escola_nome || 'sem escola',
      escolaId: r.escola_id || '',
      xp: r.xp ?? 0,
      level: r.level ?? 1,
      streak: r.streak ?? 0,
      avatarInicial: eu ? userProfile.nome?.charAt(0)?.toUpperCase() || 'V' : '',
      destaque: eu,
      variacao: 0,
    };
  });

  let filtrado = entries.filter((e) => e.xp > 0);
  if (filter === 'turma' && userProfile.turmaId) {
    filtrado = filtrado.filter((e) => e.turmaId === userProfile.turmaId);
  } else if (filter === 'escola' && userProfile.escolaId) {
    filtrado = filtrado.filter((e) => e.escolaId === userProfile.escolaId);
  }

  filtrado.sort((a, b) => b.xp - a.xp);
  return filtrado.map((e, i) => ({ ...e, posicao: i + 1 }));
}

export async function getRankingData(
  filter: RankingFilter,
  uid: string,
  userXp: number,
  userStreak: number,
): Promise<RankingData> {
  const profile = getProfile(uid);

  let entries: RankingEntry[];

  if (isSupabaseConfigured()) {
    entries = await gerarRankingSupabase(filter, profile);
    // If empty (no other users registered), fallback to mock
    if (entries.length <= 1) {
      entries = gerarRankingMock(filter, profile, userXp, userStreak);
    }
  } else {
    entries = gerarRankingMock(filter, profile, userXp, userStreak);
  }

  const labels: Record<RankingFilter, string> = {
    geral: 'Ranking Geral',
    turma: 'Ranking da Turma',
    escola: 'Ranking da Escola',
  };

  return {
    filter,
    label: labels[filter],
    entries,
    totalParticipantes: entries.length,
    updatedAt: Date.now(),
  };
}

// === Deterministic seeded random (for consistent mock data) ===
function seedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seedRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function gerarXpMockSeed(seed: number): number {
  return Math.floor(seedRandom(seed) * 5000) + 200;
}

function gerarStreakMockSeed(seed: number): number {
  return Math.floor(seedRandom(seed) * 30) + 1;
}
