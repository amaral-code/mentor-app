/**
 * CODIGO DE VINCULO E REGRA DE IDADE.
 *
 * Duas regras que precisam valer igual no banco e na tela:
 *
 *   - o codigo que o aluno entrega ao responsavel (migration 024) tem 8
 *     caracteres hexadecimais em maiusculas. O banco compara com
 *     `upper(trim(...))`, entao o front normaliza do mesmo jeito - quem
 *     digita "a1b2 c3d4" nao pode receber "codigo invalido";
 *   - "menor de 16" decide se o consentimento do psicologo exige o
 *     responsavel (LGPD, art. 14). A funcao `e_menor_de_16` e a fonte da
 *     verdade; o que esta aqui existe so para a tela avisar ANTES de
 *     chamar o banco, e por isso segue exatamente o mesmo criterio,
 *     inclusive tratar data desconhecida como menor.
 */

export const CODIGO_TAMANHO = 8;
export const IDADE_CONSENTIMENTO = 16;

/**
 * Sobe para maiuscula e tira separadores, do mesmo jeito que o banco
 * compara (`upper(trim(...))`).
 *
 * Mantem letra fora do hexadecimal DE PROPOSITO. Filtrar aqui parecia
 * mais seguro e era pior: quem digitava "G" via o caractere sumir da
 * tela sem nenhuma explicacao, e ficava tentando de novo. A letra
 * invalida fica visivel e quem avisa e `soHexadecimal`, com o motivo.
 */
export function normalizarCodigo(bruto: string): string {
  return (bruto ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, CODIGO_TAMANHO);
}

/**
 * O codigo nasce de um md5, entao so tem 0-9 e A-F. Um "G" ou um "Z" e
 * erro de leitura garantido - da para avisar sem ir ao servidor.
 */
export function soHexadecimal(bruto: string): boolean {
  return !/[^0-9A-F]/.test(normalizarCodigo(bruto));
}

export function codigoValido(bruto: string): boolean {
  const limpo = normalizarCodigo(bruto);
  return limpo.length === CODIGO_TAMANHO && soHexadecimal(limpo);
}

/**
 * Quebra em dois blocos de quatro para leitura em voz alta: ler oito
 * caracteres seguidos por telefone e onde o erro de digitacao nasce.
 */
export function formatarCodigo(codigo: string | null | undefined): string {
  const limpo = normalizarCodigo(codigo ?? '');
  if (limpo.length <= 4) return limpo;
  return `${limpo.slice(0, 4)} ${limpo.slice(4)}`;
}

/**
 * Le 'AAAA-MM-DD' sem passar por `new Date(string)`.
 *
 * `new Date('2010-05-01')` e meia-noite UTC; comparada com um `Date`
 * local a oeste de Greenwich, ela cai no dia 30 de abril. Num calculo de
 * idade isso e um dia de diferenca que, na vespera do aniversario de 16
 * anos, muda a resposta da regra de consentimento.
 */
function partesData(iso: string): { ano: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? '').trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  // Rejeita 31/02 e afins: o Date normalizaria para 03/03 em silencio.
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return { ano, mes, dia };
}

/** Idade em anos completos, ou null se a data for desconhecida/invalida. */
export function idadeEm(nascimento: string | null | undefined, hoje: Date = new Date()): number | null {
  const p = partesData(nascimento ?? '');
  if (!p) return null;
  let idade = hoje.getFullYear() - p.ano;
  const aindaNaoFezAniversario =
    hoje.getMonth() + 1 < p.mes || (hoje.getMonth() + 1 === p.mes && hoje.getDate() < p.dia);
  if (aindaNaoFezAniversario) idade--;
  return idade;
}

/**
 * Espelha `public.e_menor_de_16`. Sem data devolve TRUE de proposito: o
 * erro seguro e pedir o responsavel de quem ja podia consentir sozinho;
 * o inverso libera dado de saude mental de menor sem base legal.
 */
export function ehMenorDe16(nascimento: string | null | undefined, hoje: Date = new Date()): boolean {
  const idade = idadeEm(nascimento, hoje);
  if (idade === null) return true;
  return idade < IDADE_CONSENTIMENTO;
}

/**
 * Valida o que o usuario digitou. A faixa larga (4 a 120 anos) so barra
 * erro de digitacao evidente - ano trocado, data no futuro. Idade minima
 * de estudo nao e assunto deste campo.
 */
export function validarDataNascimento(
  iso: string,
  hoje: Date = new Date(),
): { ok: true } | { ok: false; erro: string } {
  if (!iso?.trim()) return { ok: false, erro: 'Informe a data de nascimento.' };
  const idade = idadeEm(iso, hoje);
  if (idade === null) return { ok: false, erro: 'Data inválida. Use dia, mês e ano.' };
  if (idade < 0) return { ok: false, erro: 'A data está no futuro.' };
  if (idade < 4) return { ok: false, erro: 'Confira o ano: a idade ficou muito baixa.' };
  if (idade > 120) return { ok: false, erro: 'Confira o ano: a idade ficou muito alta.' };
  return { ok: true };
}
