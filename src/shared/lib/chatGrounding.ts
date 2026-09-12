import {
  MODOS_CHAT,
  MODO_PADRAO,
  acharModo,
  extrairFontes,
  extrairSinalFrustracao,
  detectarCitacaoDeProva,
  ferramentasDeBusca,
  montarSystemInstructionChat,
  type FonteConsultada,
  type ModoChat,
} from '../../../server/chatPrompt.js';

export { MODOS_CHAT, MODO_PADRAO, acharModo };
export type { FonteConsultada, ModoChat };
export type ModoChatId = ModoChat['id'];

/**
 * CLIENTE DO CHAT TEMATICO.
 *
 * DOIS CAMINHOS, UM COMPORTAMENTO
 * Com o worker publicado, a conversa vai para /api/chat/completions: a
 * chave fica no servidor e a busca do Google entra junto. Sem worker, o
 * app fala direto com o Gemini usando a chave que o proprio aluno colou
 * no Perfil - que e como o projeto sempre funcionou e continua
 * funcionando.
 *
 * O system instruction e o MESMO nos dois casos porque vem do modulo
 * compartilhado server/chatPrompt.js. Se cada lado montasse o seu, o
 * mentor seria socratico ou nao dependendo de haver proxy configurado.
 *
 * A diferenca que sobra e honesta e visivel: sem worker, a chave do
 * aluno normalmente nao tem grounding habilitado, entao a resposta vem
 * sem fontes - e a interface nao mostra badge de fonte nenhuma.
 */

import {
  AI_MODEL,
  AI_PROVIDER,
  DEEPSEEK_DEV_PROXY_PATH,
  DEEPSEEK_TIMEOUT_MS,
  GEMINI_CHAT_CONFIG,
  erroProxyLocalSemChave,
  erroSemBackendDeepSeek,
  fetchDeepSeek,
  garantirTextoResposta,
  geminiGenConfigToDeepSeek,
  isDeepSeekProvider,
  sinalComTimeout,
  toChatCompletionsMessages,
} from './aiProvider';

const PROXY_URL = ((import.meta.env.VITE_AI_BASE_URL as string) || '').replace(/\/+$/, '');
const PROXY_TOKEN = (import.meta.env.VITE_AI_PROXY_TOKEN as string) || '';
const MODELO_DIRETO = ((import.meta.env.VITE_AI_MODEL as string) || '').trim() || AI_MODEL;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface MensagemChat {
  role: 'user' | 'model';
  text: string;
}

export type ModoRespostaChat = 'explicativo' | 'comunicativo';

export interface ContextoChat {
  modo: ModoChatId | string;
  mensagens: MensagemChat[];
  apiKey: string;
  nomeAluno?: string;
  materiaRecente?: string;
  /** Toggle Explicativo/Comunicativo da barra de entrada do Mentor. */
  modoResposta?: ModoRespostaChat;
  /** Injetavel para teste; por padrao, a hora do aparelho. */
  horaLocal?: number;
  signal?: AbortSignal;
}

export interface RespostaChat {
  texto: string;
  /** EPICO 2: bloco `frustracao` do modelo, ja removido do texto. */
  frustrationDetected: boolean;
  fontes: FonteConsultada[];
  consultas: string[];
  groundingUsado: boolean;
  citouProva: boolean;
  modo: string;
  viaWorker: boolean;
}

export const temEndpointDeChat = (): boolean => PROXY_URL.length > 0;

function textoDaResposta(dados: any): string {
  const partes = dados?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return '';
  return partes.map((p: any) => p?.text || '').join('').trim();
}

/** Caminho 1: o worker, com busca e chave do servidor. */
async function pelaApi(ctx: ContextoChat): Promise<RespostaChat> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROXY_TOKEN) headers['Authorization'] = `Bearer ${PROXY_TOKEN}`;

  // Timeout de 30s como nos demais caminhos: sem isso, rede que engole
  // pacote deixava "Sagui está digitando" para sempre.
  const resposta = await fetch(`${PROXY_URL}/api/chat/completions`, {
    method: 'POST',
    headers,
    signal: sinalComTimeout(ctx.signal, DEEPSEEK_TIMEOUT_MS),
    body: JSON.stringify({
      provider: AI_PROVIDER,
      model: MODELO_DIRETO,
      modo: ctx.modo,
      mensagens: ctx.mensagens,
      horaLocal: ctx.horaLocal ?? new Date().getHours(),
      nomeAluno: ctx.nomeAluno,
      materiaRecente: ctx.materiaRecente,
      modoResposta: ctx.modoResposta,
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(`Erro no mentor (${resposta.status}): ${detalhe.slice(0, 180)}`);
  }

  const dados = await resposta.json();
  // O worker ja remove o bloco; a flag viaja separada. O parse local cobre
  // worker antigo que ainda devolva o bloco no texto.
  const { textoLimpo, frustrationDetected } = extrairSinalFrustracao(String(dados.texto ?? ''));
  return {
    // Resposta vazia vira erro para cair no fallback local com toast,
    // em vez de bolha vazia que parecia "não respondeu".
    texto: garantirTextoResposta(textoLimpo),
    frustrationDetected: Boolean(dados.frustrationDetected) || frustrationDetected,
    fontes: dados.fontes ?? [],
    consultas: dados.consultas ?? [],
    groundingUsado: !!dados.groundingUsado,
    citouProva: !!dados.citouProva,
    modo: dados.modo ?? ctx.modo,
    viaWorker: true,
  };
}

/** Caminho 2 direto: DeepSeek (chat completions) ou Gemini, com a chave do aluno. */
async function direto(ctx: ContextoChat): Promise<RespostaChat> {
  const systemText = montarSystemInstructionChat({
    modo: ctx.modo,
    horaLocal: ctx.horaLocal ?? new Date().getHours(),
    nomeAluno: ctx.nomeAluno,
    materiaRecente: ctx.materiaRecente,
    modoResposta: ctx.modoResposta,
  });
  const systemInstruction = { parts: [{ text: systemText }] };

  // DeepSeek nao tem grounding do Google e nunca sai do navegador em
  // cross-origin: sem worker, o back-end e o proxy local (mesmo system
  // prompt, resposta sem fontes - a interface ja trata esse caso).
  if (isDeepSeekProvider()) {
    return viaProxyLocalDeepSeek(ctx, systemText);
  }

  const contents = ctx.mensagens
    .filter((m) => m.text?.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  const chamar = async (comBusca: boolean) => {
    const payload: Record<string, unknown> = {
      systemInstruction,
      contents,
      // Mesmos valores do DeepSeek barato (só muda o nome do campo).
      generationConfig: { ...GEMINI_CHAT_CONFIG },
    };
    if (comBusca) payload.tools = ferramentasDeBusca(MODELO_DIRETO);

    // Chave no header, nunca na URL (?key= vaza em logs de proxy/CDN).
    return fetch(`${GEMINI_URL}/${MODELO_DIRETO}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ctx.apiKey },
      signal: sinalComTimeout(ctx.signal, DEEPSEEK_TIMEOUT_MS),
      body: JSON.stringify(payload),
    });
  };

  // Tenta com busca; chave pessoal do AI Studio costuma recusar a
  // ferramenta, e nesse caso a conversa segue sem fontes em vez de
  // morrer num 400.
  let resposta = await chamar(true);
  let tentouBusca = true;
  if (!resposta.ok && resposta.status === 400) {
    resposta = await chamar(false);
    tentouBusca = false;
  }

  if (!resposta.ok) {
    if (resposta.status === 403 || resposta.status === 400) {
      throw new Error('Chave da IA invalida ou sem permissao. Confira no Perfil.');
    }
    if (resposta.status === 429) {
      throw new Error('Limite de requisicoes atingido. Tente de novo em instantes.');
    }
    throw new Error(`Erro na IA (${resposta.status}).`);
  }

  const dados = await resposta.json();
  const { textoLimpo, frustrationDetected } = extrairSinalFrustracao(textoDaResposta(dados));
  const texto = garantirTextoResposta(textoLimpo);
  const grounding = extrairFontes(dados);

  return {
    texto,
    frustrationDetected,
    fontes: grounding.fontes,
    consultas: grounding.consultas,
    groundingUsado: tentouBusca && grounding.groundingUsado,
    citouProva: detectarCitacaoDeProva(texto),
    modo: String(ctx.modo),
    viaWorker: false,
  };
}

/**
 * Caminho 2b: DeepSeek via proxy LOCAL (back-end, sem grounding do Google).
 *
 * O system prompt e o mesmo do worker; a resposta volta sem fontes (a
 * interface ja trata esse caso). A chave NUNCA sai do navegador: o Vite
 * injeta o Authorization no servidor. Sem proxy local (build sem worker),
 * erro acionavel em vez de cross-origin fadado ao "Failed to fetch".
 */
async function viaProxyLocalDeepSeek(ctx: ContextoChat, systemText: string): Promise<RespostaChat> {
  if (!import.meta.env.DEV) throw erroSemBackendDeepSeek();

  const contents = ctx.mensagens
    .filter((m) => m.text?.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const messages = toChatCompletionsMessages({ parts: [{ text: systemText }] }, contents);
  // Conversão do config único: mesmo custo/comportamento do worker.
  const gen = geminiGenConfigToDeepSeek({ ...GEMINI_CHAT_CONFIG });

  // Timeout + diagnostico dentro do helper (o erro ja vem classificado e
  // com dica acionavel; o log seguro vai para o console.debug).
  const resposta = await fetchDeepSeek(
    `${DEEPSEEK_DEV_PROXY_PATH}/chat/completions`,
    {
      method: 'POST',
      // SEM Authorization de proposito: a chave e injetada pelo Vite no
      // servidor (vite.config.ts). Nada de segredo no navegador.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELO_DIRETO, messages, ...gen }),
    },
    {
      sinalUsuario: ctx.signal,
      rotuloDestino: 'proxy local (/deepseek-api)',
      contexto: { model: MODELO_DIRETO, mensagens: messages.length, via: 'chatGrounding-devProxy' },
    },
  );

  if (!resposta.ok) {
    // 404 = rota nao registrada pelo Vite = .env sem DEEPSEEK_API_KEY
    // (ou dev server nao reiniciado apos adiciona-la).
    if (resposta.status === 404) throw erroProxyLocalSemChave();
    if (resposta.status === 401 || resposta.status === 403 || resposta.status === 400) {
      throw new Error('Chave da IA inválida ou sem permissão. Confira a DEEPSEEK_API_KEY no servidor.');
    }
    if (resposta.status === 429) {
      throw new Error('Limite de requisicoes atingido. Tente de novo em instantes.');
    }
    throw new Error(`Erro na IA (${resposta.status}).`);
  }

  const dados = await resposta.json();
  const brutoProxy = String(dados?.choices?.[0]?.message?.content ?? '');
  const sinalProxy = extrairSinalFrustracao(brutoProxy);
  const texto = garantirTextoResposta(sinalProxy.textoLimpo);
  return {
    texto,
    frustrationDetected: sinalProxy.frustrationDetected,
    fontes: [],
    consultas: [],
    groundingUsado: false,
    citouProva: detectarCitacaoDeProva(texto),
    modo: String(ctx.modo),
    viaWorker: false,
  };
}

export async function conversarComMentor(ctx: ContextoChat): Promise<RespostaChat> {
  return temEndpointDeChat() ? pelaApi(ctx) : direto(ctx);
}
