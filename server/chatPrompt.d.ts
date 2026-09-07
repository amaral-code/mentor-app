/**
 * Tipos de chatPrompt.js.
 *
 * O modulo e JavaScript porque o worker (bundlado pelo wrangler) e o app
 * (compilado pelo tsc) compartilham o MESMO prompt - e um .js com .d.ts
 * ao lado e o formato que os dois leem sem precisar de build extra.
 */

export interface ModoChat {
  id: 'enem_geral' | 'exatas' | 'natureza' | 'humanas' | 'vestibulares';
  rotulo: string;
  escopo: string;
  bancas: string[];
  fontes: string[];
  cor: string;
}

export interface FonteConsultada {
  titulo: string;
  uri: string;
  dominio: string;
}

export interface ResultadoGrounding {
  fontes: FonteConsultada[];
  consultas: string[];
  groundingUsado: boolean;
}

export type ModoResposta = 'explicativo' | 'comunicativo';

export interface OpcoesPromptChat {
  modo?: string;
  /** Hora local do aluno, 0-23. Define a densidade da resposta. */
  horaLocal?: number;
  nomeAluno?: string;
  materiaRecente?: string;
  /** Toggle Explicativo/Comunicativo da barra de entrada. */
  modoResposta?: string;
}

export declare const MODOS_CHAT: ModoChat[];
export declare const MODO_PADRAO: string;
export declare const MODOS_RESPOSTA: ModoResposta[];

export declare function acharModo(id?: string): ModoChat;
export declare function modoValido(id?: string): boolean;
export declare function modoRespostaValido(id?: string): boolean;
export declare function faixaHoraria(hora?: number): 'madrugada' | 'noite' | 'dia';
export declare function montarSystemInstructionChat(opcoes?: OpcoesPromptChat): string;
export declare function limparTextoLivre(valor: unknown, max?: number): string;
export declare function ferramentasDeBusca(modelo?: string): Record<string, unknown>[];
export declare function extrairFontes(resposta: unknown): ResultadoGrounding;
export declare function detectarCitacaoDeProva(texto?: string): boolean;
export declare function eHttps(uri: unknown): boolean;
