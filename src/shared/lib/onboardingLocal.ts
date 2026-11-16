import { safeGet, safeSet } from './safeStorage';

/**
 * Marca "já fiz o onboarding" NESTE aparelho.
 *
 * ==================================================================
 * O BUG QUE ISTO RESOLVE
 * ==================================================================
 * O wizard reaparecia a cada volta para a aba, obrigando o aluno a
 * responder a pesquisa outra vez. A sequência era:
 *
 *   1. aluno conclui o wizard;
 *   2. `concluirOnboarding` tenta gravar `onboarding_completed` no banco
 *      e FALHA (migration 021 pendente, ou RLS barrando o update);
 *   3. `concluirOnboardingLocal` libera o app marcando a flag em
 *      MEMÓRIA - e o código dizia, em comentário, que ninguém ficaria
 *      preso no wizard por causa de infra;
 *   4. o aluno troca de aba e volta. O Supabase dispara
 *      `TOKEN_REFRESHED`, o app recarrega o perfil do banco e
 *      SOBRESCREVE a memória com o que está lá: `false`;
 *   5. wizard de novo.
 *
 * A proteção do passo 3 existia, mas não sobrevivia ao passo 4: memória
 * é apagada por qualquer releitura do perfil. Aqui a marca é durável,
 * então ela ainda vale depois do refresh.
 *
 * ==================================================================
 * ISTO NÃO SUBSTITUI O BANCO
 * ==================================================================
 * É rede de segurança, não a fonte da verdade: vale só neste navegador,
 * e o aluno que entrar de outro aparelho verá o wizard novamente. O
 * conserto de verdade é a coluna existir e o update passar - o banco é
 * quem sincroniza entre aparelhos.
 *
 * Por que é seguro guardar isto no cliente: a flag não dá acesso a
 * nada. Diferente do papel do usuário (que foi REMOVIDO do localStorage
 * de propósito, porque dava para virar educador digitando no console),
 * "já vi o wizard" não abre porta nenhuma - o pior caso é alguém pular
 * uma tela de boas-vindas no próprio navegador.
 */

/* Por usuário: laboratório de escola tem vários alunos no mesmo
   navegador, e a marca de um não pode valer para o outro. */
const chave = (uid: string) => `mm_onboarding_ok_${uid}`;

export function marcarOnboardingLocal(uid: string): void {
  if (uid) safeSet(chave(uid), '1');
}

export function onboardingConcluidoLocal(uid: string): boolean {
  return !!uid && safeGet(chave(uid)) === '1';
}

/**
 * Quem passa pelo wizard de primeiro acesso: SÓ o estudante.
 *
 * O wizard pergunta meta de estudo, tempo por dia, turno e data de
 * nascimento. Nada disso é pergunta para psicólogo, responsável,
 * professor ou secretaria, e o App checava o wizard ANTES de olhar o
 * papel: o psicólogo, no primeiro login, respondia "O que você quer
 * conquistar? Passar no ENEM" antes de ver o próprio painel.
 *
 * A flag no banco nasce `false` para todo mundo (021), então não dava
 * para contar com ela: a decisão precisa do papel.
 */
export function precisaOnboarding(
  session: { role: string; onboardingCompleted: boolean } | null | undefined,
): boolean {
  return !!session && session.role === 'student' && !session.onboardingCompleted;
}
