/**
 * Navegação por teclado na lista de abas.
 *
 * A regra de "para onde o foco vai" fica aqui, separada do componente,
 * para poder ser testada com todas as teclas e nos extremos da lista -
 * dentro do JSX ela só seria exercitada por um humano clicando.
 *
 * ------------------------------------------------------------------
 * POR QUE `nav` + `aria-current`, E NÃO `role="tablist"`
 * ------------------------------------------------------------------
 * Apesar de chamarmos de "abas", cada item troca a PÁGINA inteira. A
 * semântica honesta é de navegação, não de painel de abas: anunciar
 * "tab" a um leitor de tela prometeria um `tabpanel` associado que não
 * existe, e a pessoa procuraria por ele.
 *
 * O padrão ARIA de tablist também exige foco em um único item (roving
 * tabindex), o que tiraria os demais da ordem do Tab. Numa lista de
 * navegação isso atrapalha: quem usa Tab espera percorrer os links.
 * Aqui as setas são um ATALHO adicional, não um substituto do Tab.
 */

/** Teclas que movem o foco. Qualquer outra é ignorada pelo componente. */
export const TECLAS_NAVEGACAO = ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const;

export type TeclaNavegacao = (typeof TECLAS_NAVEGACAO)[number];

export function ehTeclaNavegacao(tecla: string): tecla is TeclaNavegacao {
  return (TECLAS_NAVEGACAO as readonly string[]).includes(tecla);
}

/**
 * Próximo índice de foco.
 *
 * Devolve `null` quando não há para onde ir (lista vazia, ou foco fora
 * da lista) - o componente usa isso para não chamar `preventDefault` e
 * deixar a tecla seguir seu caminho normal.
 *
 * O movimento é CIRCULAR: de baixo volta ao topo. Numa lista de 15
 * itens, parar na ponta obrigaria a percorrer tudo de volta para chegar
 * ao outro extremo.
 */
export function proximoIndiceFoco(
  tecla: string,
  atual: number,
  total: number,
): number | null {
  if (!ehTeclaNavegacao(tecla)) return null;
  if (total <= 0) return null;
  /* Foco fora da lista: nao ha de onde partir. */
  if (atual < 0 || atual >= total) return null;

  switch (tecla) {
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    case 'ArrowDown':
      return (atual + 1) % total;
    case 'ArrowUp':
      return (atual - 1 + total) % total;
  }
}
