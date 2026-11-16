/**
 * Compartilha um link (#57): a folha de compartilhamento do celular
 * quando existe (WhatsApp é o caminho natural de convite de liga), e a
 * área de transferência no computador.
 *
 * Devolve como foi feito, para a tela dizer "copiado" só quando copiou.
 */
export async function compartilharLink(titulo: string, url: string): Promise<'compartilhado' | 'copiado' | 'falhou'> {
  if (typeof navigator !== 'undefined' && 'share' in navigator && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: titulo, url });
      return 'compartilhado';
    } catch {
      /* cancelado pelo usuário: cai na cópia */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copiado';
  } catch {
    return 'falhou';
  }
}
