/**
 * Teto de espera para chamadas de rede (mobile/4G instavel).
 *
 * O fetch do supabase-js nao tem timeout proprio: com a rede oscilando a
 * promise fica pendente para sempre e a UI congela no "Aguarde..." ou na
 * tela em branco. O race abaixo rejeita apos `ms` com mensagem acionavel;
 * a chamada original segue em segundo plano e e ignorada. Funcao pura.
 */
/*
 * Aceita PromiseLike de proposito: o PostgrestBuilder do supabase-js e
 * thenable (tem .then), mas nao e Promise de verdade - tipar como
 * Promise<T> quebrava o tsc no carregarPerfil.
 */
export function comTimeout<T>(promessa: Promise<T> | PromiseLike<T>, ms: number, rotulo: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const teto = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${rotulo}: demorou demais (${Math.round(ms / 1000)}s). Verifique sua conexão e tente de novo.`)),
      ms,
    );
  });
  return Promise.race([Promise.resolve(promessa), teto]).finally(() => clearTimeout(timer));
}

/** 15s para auth (login/cadastro/sessao) - chega para 4G ruim, sem espera infinita. */
export const TIMEOUT_AUTH_MS = 15_000;
/** 20s para a carga inicial de dados (11 tabelas em paralelo no boot). */
export const TIMEOUT_BOOT_MS = 20_000;
