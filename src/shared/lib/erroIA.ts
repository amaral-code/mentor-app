/**
 * Traduz a falha do back-end de IA para uma frase que o ALUNO entende.
 *
 * Antes o corpo cru da resposta ia direto para o toast:
 *   Erro ao gerar questões: {"error":"misconfigured","message":"Defina o secret DEEPSEEK_API_KEY."}
 * Isso é instrução para quem administra o servidor, mostrada a quem só
 * queria fazer um quiz. O detalhe técnico continua no console, que é
 * onde quem mantém o app procura.
 */

function campo(bruto: string, nome: 'error' | 'message'): string {
  try {
    const dados = JSON.parse(bruto) as Record<string, unknown>;
    const valor = dados?.[nome];
    return typeof valor === 'string' ? valor : '';
  } catch {
    return '';
  }
}

/** Erro de configuração do servidor: repetir a chamada não muda nada. */
export function ehErroDeConfiguracao(bruto: string | null | undefined): boolean {
  return campo(String(bruto ?? ''), 'error') === 'misconfigured';
}

export function explicarErroIA(status: number, bruto: string | null | undefined): string {
  const texto = String(bruto ?? '');
  const codigo = campo(texto, 'error');

  if (codigo === 'misconfigured') {
    return 'a inteligência artificial ainda não foi configurada neste site. Avise quem administra a plataforma.';
  }
  if (status === 401 || codigo === 'sem_sessao') {
    return 'sua sessão expirou. Saia da conta e entre de novo.';
  }
  if (status === 429 || codigo === 'muitas_chamadas') {
    return 'muitos pedidos em pouco tempo. Espere um minuto e tente de novo.';
  }
  if (status >= 500) {
    return 'o serviço de inteligência artificial está fora do ar. Tente de novo em instantes.';
  }
  return 'não foi possível concluir agora. Tente de novo.';
}
