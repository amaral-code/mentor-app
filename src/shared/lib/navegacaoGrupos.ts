import type { TabId } from '../types';

/**
 * Agrupamento do menu do aluno por TAREFA.
 *
 * Eram 16 itens numa lista corrida, todos com o mesmo peso: o aluno lia
 * a lista inteira para achar "Redação". Agrupado pelo que ele veio fazer
 * (estudar, se concentrar, ver como está indo, cuidar das próprias
 * coisas), o olho pula direto para o bloco certo.
 *
 * A ORDEM dos itens aqui é a ordem do teclado (setas, Home, End): o menu
 * é uma lista só, os grupos são só rótulos no meio dela.
 */
export interface GrupoNavegacao {
  /** `null` = sem rótulo (a Central abre a lista sozinha). */
  rotulo: string | null;
  abas: TabId[];
}

export const GRUPOS_NAVEGACAO: GrupoNavegacao[] = [
  { rotulo: null, abas: ['dashboard'] },
  { rotulo: 'Estudar', abas: ['chat', 'quiz', 'essay', 'calendario', 'notebook', 'audio'] },
  { rotulo: 'Concentrar', abas: ['foco', 'sala', 'escudo'] },
  { rotulo: 'Acompanhar', abas: ['estatisticas', 'ranking', 'comunidade', 'store'] },
  { rotulo: 'Você', abas: ['agenda', 'profile'] },
];

/** Lista plana na ordem de exibição (e de navegação por teclado). */
export function ordemDasAbas(grupos: GrupoNavegacao[] = GRUPOS_NAVEGACAO): TabId[] {
  return grupos.flatMap((g) => g.abas);
}
