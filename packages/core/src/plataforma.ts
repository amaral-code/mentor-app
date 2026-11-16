/**
 * Adaptadores de plataforma.
 *
 * O `@mentor/core` roda igual no navegador (Vite), no celular (Expo/React
 * Native) e nos testes em Node. O que muda entre eles fica atrás desta
 * interface, e cada app instala a sua implementação no boot:
 *
 * - web:    apps/web/src/plataforma/web.ts  (localStorage, import.meta.env)
 * - mobile: MMKV, process.env.EXPO_PUBLIC_*, NetInfo (milestone M2)
 * - testes: o padrão abaixo, ou `configurarPlataforma` com um armazenamento
 *   em memória (`criarArmazenamentoEmMemoria`).
 *
 * Por que não importar `localStorage` direto: no React Native ele não
 * existe, e o JavaScript quebra no primeiro acesso. E `import.meta.env` é
 * coisa do Vite: o Metro (bundler do Expo) não sabe o que é.
 */

/** Armazenamento chave/valor SÍNCRONO (web: localStorage; mobile: MMKV). */
export interface ArmazenamentoChaveValor {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export interface Plataforma {
  /** Armazenamento local, ou `null` quando não há (SSR, testes em Node, modo privado). */
  armazenamento(): ArmazenamentoChaveValor | null;
  /** Variável pública definida no build. String vazia quando não existe. */
  envBuild(nome: string): string;
  /** Se o aparelho está online; `null` quando a plataforma não sabe dizer. */
  online(): boolean | null;
  /** Build de desenvolvimento (habilita proxies e mensagens de dev). */
  dev(): boolean;
  /**
   * Sai do app para uma URL externa (checkout do pagamento, por exemplo).
   * Web: `location.assign`. Mobile: `Linking.openURL`.
   */
  abrirUrl(url: string): void;
  /**
   * Chama `aoSair` quando o app vai para segundo plano (aba escondida,
   * app minimizado). Devolve a função que desfaz o registro.
   * Web: `visibilitychange`. Mobile: `AppState`.
   */
  aoIrParaSegundoPlano(aoSair: () => void): () => void;
}

const PADRAO: Plataforma = {
  armazenamento: () => null,
  envBuild: () => '',
  online: () => null,
  dev: () => false,
  abrirUrl: () => {
    throw new Error('abrirUrl sem plataforma instalada: chame configurarPlataforma no boot do app.');
  },
  aoIrParaSegundoPlano: () => () => {},
};

/*
 * Guardado em globalThis, e não numa variável do módulo: os testes usam
 * `vi.resetModules()` + import dinâmico para reler a configuração, e isso
 * recria este módulo. Numa variável local, a plataforma instalada pelo
 * setup dos testes sumiria a cada reset e o código cairia no padrão vazio.
 */
const CHAVE = Symbol.for('@mentor/core/plataforma');
type ComPlataforma = typeof globalThis & { [CHAVE]?: Plataforma };

export function plataforma(): Plataforma {
  return (globalThis as ComPlataforma)[CHAVE] ?? PADRAO;
}

/** Instala (ou completa) a plataforma. O que não for passado mantém o atual. */
export function configurarPlataforma(parcial: Partial<Plataforma>): void {
  (globalThis as ComPlataforma)[CHAVE] = { ...plataforma(), ...parcial };
}

/** Volta ao padrão vazio. Útil entre testes. */
export function _resetarPlataforma(): void {
  delete (globalThis as ComPlataforma)[CHAVE];
}

/** Armazenamento que vive só na memória: testes e plataformas sem disco. */
export function criarArmazenamentoEmMemoria(inicial: Record<string, string> = {}): ArmazenamentoChaveValor {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, String(valor)),
    removeItem: (chave) => void dados.delete(chave),
  };
}
