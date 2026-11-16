/**
 * Divide um valor grande em pedaços para caber num cofre pequeno.
 *
 * O Keychain do iOS e o Keystore do Android (via expo-secure-store)
 * avisam ou falham acima de ~2 KB por chave, e a sessão do Supabase
 * (dois JWTs e o perfil) passa disso. Guardar a sessão inteira fora do
 * cofre, no armazenamento comum, seria deixar o token legível para
 * qualquer backup do aparelho.
 *
 * Formato: `<chave>__n` guarda quantos pedaços há; `<chave>__0`,
 * `<chave>__1`... guardam o texto. Função pura sobre um armazenamento
 * qualquer, para ser testada sem aparelho.
 */

export interface ArmazenamentoAssincrono {
  getItem(chave: string): Promise<string | null>;
  setItem(chave: string, valor: string): Promise<void>;
  removeItem(chave: string): Promise<void>;
}

/* 1800, e não 2048: o limite é em bytes e um caractere acentuado ocupa
   dois em UTF-8. O token é ASCII, mas o nome do aluno no perfil não. */
export const TAMANHO_PEDACO = 1800;

const chaveContagem = (chave: string) => `${chave}__n`;
const chavePedaco = (chave: string, i: number) => `${chave}__${i}`;

export function emPedacos(base: ArmazenamentoAssincrono, tamanho = TAMANHO_PEDACO): ArmazenamentoAssincrono {
  async function apagar(chave: string): Promise<void> {
    const n = Number(await base.getItem(chaveContagem(chave))) || 0;
    await Promise.all(Array.from({ length: n }, (_, i) => base.removeItem(chavePedaco(chave, i))));
    await base.removeItem(chaveContagem(chave));
  }

  return {
    async getItem(chave) {
      const n = Number(await base.getItem(chaveContagem(chave)));
      if (!Number.isInteger(n) || n <= 0) return null;
      const partes = await Promise.all(Array.from({ length: n }, (_, i) => base.getItem(chavePedaco(chave, i))));
      /* Pedaço faltando = gravação interrompida no meio. Devolver o texto
         remendado seria entregar um JSON quebrado ao Supabase; melhor
         dizer "sem sessão" e pedir login de novo. */
      if (partes.some((p) => p === null)) return null;
      return partes.join('');
    },
    async setItem(chave, valor) {
      await apagar(chave);
      const partes: string[] = [];
      for (let i = 0; i < valor.length; i += tamanho) partes.push(valor.slice(i, i + tamanho));
      if (partes.length === 0) partes.push('');
      await Promise.all(partes.map((p, i) => base.setItem(chavePedaco(chave, i), p)));
      // A contagem por último: se o app morrer antes, a leitura vê "sem sessão".
      await base.setItem(chaveContagem(chave), String(partes.length));
    },
    removeItem: apagar,
  };
}
