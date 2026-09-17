import { getSupabase } from './supabase';
import { isDeepSeekProvider } from './aiProvider';
import { aiProxyToken, aiVisionModel, temBackendIA, urlBackendIA } from './runtimeConfig';
import {
  ESQUEMA_CORRECAO,
  COMPETENCIAS,
  normalizarCorrecao,
  pareceFotoIlegivel,
  promptCorrecaoFoto,
  type CorrecaoFoto,
  type ChaveCompetencia,
} from '../../../server/essaySchema.js';

export { COMPETENCIAS, pareceFotoIlegivel };
export type { CorrecaoFoto, ChaveCompetencia };

/**
 * CLIENTE DA CORRECAO POR FOTO.
 *
 * Igual ao chat, dois caminhos com o mesmo prompt e o mesmo contrato:
 *
 *   COM worker  -> POST /api/essays/upload-and-grade (multipart). A
 *                  chave fica no servidor, a imagem vai para o bucket
 *                  privado com service_role e a correcao entra no
 *                  historico.
 *   SEM worker  -> o app sobe a foto pelo supabase-js (RLS do Storage
 *                  garante a pasta do dono) e chama o Gemini direto com
 *                  a chave do aluno.
 *
 * O caminho sem worker existe porque hoje o projeto roda assim; sem ele,
 * a funcionalidade so apareceria depois de publicar o proxy.
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const BUCKET = 'essay_scans';

export interface ResultadoCorrecaoFoto extends CorrecaoFoto {
  essay_id?: number | string | null;
  image_url?: string | null;
  image_path?: string | null;
  /** Transcricao curta demais: quase sempre foto ruim, nao redacao curta. */
  ilegivel?: boolean;
}

export const temEndpointDeRedacao = (): boolean => temBackendIA();

async function paraBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const BLOCO = 0x8000;
  let binario = '';
  // Cede a thread a cada ~40 blocos: foto de caderno comprimida tem centenas
  // de kB e o loop de btoa e sincrono. Sem o respiro, a tela de envio
  // congela com o spinner parado bem na hora do upload.
  for (let i = 0; i < bytes.length; i += BLOCO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + BLOCO));
    if ((i / BLOCO) % 40 === 39) await new Promise((r) => setTimeout(r, 0));
  }
  return btoa(binario);
}

/** Caminho 1: worker. */
async function pelaApi(arquivo: File, tema: string, signal?: AbortSignal): Promise<ResultadoCorrecaoFoto> {
  const sb = getSupabase();
  const { data: sessao } = (await sb?.auth.getSession()) ?? { data: { session: null } };

  const headers: Record<string, string> = {};
  const token = aiProxyToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // O worker exige o JWT: a foto e material escolar de um menor, e o
  // caminho no bucket e derivado do dono da sessao.
  if (sessao?.session?.access_token) headers['X-Supabase-Auth'] = sessao.session.access_token;

  const form = new FormData();
  form.append('imagem', arquivo);
  if (tema) form.append('tema', tema);

  const resposta = await fetch(urlBackendIA('/api/essays/upload-and-grade'), {
    method: 'POST',
    headers,
    body: form,
    signal,
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw new Error(mensagemDeErro(resposta.status, detalhe));
  }
  return resposta.json();
}

/** Caminho 2: upload pelo supabase-js + Gemini direto. */
async function direto(
  arquivo: File,
  tema: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ResultadoCorrecaoFoto> {
  if (!apiKey.trim()) {
    throw new Error('Configure a chave da IA no Perfil para corrigir por foto.');
  }

  // O DeepSeek-V4-Flash configurado aqui e um modelo de texto (chat
  // completions): a correcao por FOTO exige visao multimodal via worker
  // (/api/essays/upload-and-grade, com a foto no bucket privado). Sem
  // worker, o caminho suportado continua sendo o Gemini vision.
  if (isDeepSeekProvider()) {
    throw new Error(
      'Correção por foto indisponível no modo DeepSeek sem back-end (o modelo configurado é de texto). ' +
        'Defina GEMINI_API_KEY nas Environment Variables do projeto — o back-end usa o Gemini Vision para a foto, mesmo com o chat no DeepSeek.',
    );
  }

  const sb = getSupabase();
  const uid = (await sb?.auth.getUser())?.data.user?.id;

  let caminho: string | null = null;
  let imagemUrl: string | null = null;

  // O upload e "melhor esforco": se o bucket ainda nao existe (migracao
  // 013 nao aplicada), a correcao acontece do mesmo jeito - o aluno so
  // nao tem a foto guardada no historico.
  if (sb && uid) {
    caminho = `${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(caminho, arquivo, {
      contentType: arquivo.type || 'image/jpeg',
      upsert: true,
    });
    if (error) {
      console.warn('[redacao] foto nao guardada no bucket:', error.message);
      caminho = null;
    } else {
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60 * 24 * 7);
      imagemUrl = data?.signedUrl ?? null;
    }
  }

  const base64 = await paraBase64(await arquivo.arrayBuffer());

  // Chave no header, nunca na URL (?key= vaza em logs de proxy/CDN).
  const resposta = await fetch(`${GEMINI_URL}/${aiVisionModel()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptCorrecaoFoto(tema) },
            { inlineData: { mimeType: arquivo.type || 'image/jpeg', data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: ESQUEMA_CORRECAO,
      },
    }),
  });

  if (!resposta.ok) {
    throw new Error(mensagemDeErro(resposta.status, await resposta.text()));
  }

  const dados = await resposta.json();
  const texto = (dados?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => p?.text || '')
    .join('')
    .trim();

  // O modelo às vezes devolve prosa em vez de JSON: erro acionável (a tela
  // trata como foto ilegível) em vez de SyntaxError cru sem contexto.
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error('Não consegui ler a folha na foto. Tente enquadrar só o texto, com boa luz.');
  }
  const correcao = normalizarCorrecao(bruto);
  return {
    ...correcao,
    image_url: imagemUrl,
    image_path: caminho,
    ilegivel: pareceFotoIlegivel(correcao),
  };
}

function mensagemDeErro(status: number, detalhe: string): string {
  if (status === 401) return 'Sessao expirada. Entre de novo para enviar a foto.';
  if (status === 413) return 'A foto ficou grande demais. Tente enquadrar so a folha.';
  if (status === 415) return 'Formato de imagem nao aceito. Use JPG ou PNG.';
  if (status === 429) return 'Muitas correcoes seguidas. Aguarde um instante.';
  return `Nao foi possivel corrigir a foto (${status}). ${detalhe.slice(0, 120)}`;
}

export async function corrigirRedacaoPorFoto(
  arquivo: File,
  opcoes: { tema?: string; apiKey: string; signal?: AbortSignal },
): Promise<ResultadoCorrecaoFoto> {
  const tema = (opcoes.tema || '').trim();
  return temEndpointDeRedacao()
    ? pelaApi(arquivo, tema, opcoes.signal)
    : direto(arquivo, tema, opcoes.apiKey, opcoes.signal);
}

/** Converte para o formato da correcao digitada, para reaproveitar telas e historico. */
export function paraEssayCorrection(c: CorrecaoFoto) {
  return {
    competencia1: c.scores.competence_1.score,
    competencia2: c.scores.competence_2.score,
    competencia3: c.scores.competence_3.score,
    competencia4: c.scores.competence_4.score,
    competencia5: c.scores.competence_5.score,
    notaFinal: c.total_score,
    pontosFortes: c.strengths,
    pontosMelhorar: c.actionable_improvements,
    originalText: c.transcription,
  };
}
