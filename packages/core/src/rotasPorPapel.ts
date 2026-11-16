/**
 * Para onde cada papel vai no app nativo (Expo Router).
 *
 * O web decide a árvore inteira pelo papel em App.tsx; no celular cada
 * papel tem o seu grupo de rotas, e um grupo só existe para quem tem o
 * papel (Stack.Protected). Esta é a tabela que as duas pontas (as
 * portas do layout e o redirecionamento inicial) consultam.
 */
import type { UserRole } from './types';

export type GrupoDeRotas = 'aluno' | 'familia' | 'professor' | 'secretaria' | 'psicologo';

const GRUPO: Record<UserRole, GrupoDeRotas | null> = {
  student: 'aluno',
  parent: 'familia',
  teacher: 'professor',
  educator: 'secretaria',
  psychologist: 'psicologo',
  // Admin não tem tela própria nem no web: promoção de papel é por SQL.
  admin: null,
};

/** Primeira rota de cada grupo (a URL que aparece no navegador). */
export const ROTA_INICIAL: Record<GrupoDeRotas, string> = {
  aluno: '/',
  familia: '/familia',
  professor: '/professor',
  secretaria: '/secretaria',
  psicologo: '/psicologo',
};

export function grupoDoPapel(papel: UserRole | string | null | undefined): GrupoDeRotas | null {
  return (papel && GRUPO[papel as UserRole]) || null;
}

/** O papel pode abrir as rotas do grupo? (Nunca as de outro papel.) */
export function podeAbrir(papel: UserRole | string | null | undefined, grupo: GrupoDeRotas): boolean {
  return grupoDoPapel(papel) === grupo;
}

export type Destino =
  | { tipo: 'entrar' }
  | { tipo: 'trocar-senha' }
  | { tipo: 'boas-vindas' }
  | { tipo: 'grupo'; grupo: GrupoDeRotas; rota: string }
  | { tipo: 'sem-tela' };

/**
 * A mesma ordem de portas do App.tsx do web: login, troca de senha
 * obrigatória, primeiro acesso (só aluno) e, por fim, o papel.
 */
export function destinoDaSessao(
  sessao: { role: string; deveTrocarSenha?: boolean; onboardingCompleted: boolean } | null | undefined,
): Destino {
  if (!sessao) return { tipo: 'entrar' };
  if (sessao.deveTrocarSenha) return { tipo: 'trocar-senha' };
  if (sessao.role === 'student' && !sessao.onboardingCompleted) return { tipo: 'boas-vindas' };
  const grupo = grupoDoPapel(sessao.role);
  return grupo ? { tipo: 'grupo', grupo, rota: ROTA_INICIAL[grupo] } : { tipo: 'sem-tela' };
}
