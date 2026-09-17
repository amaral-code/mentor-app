import { getSupabase } from './supabase';
import { sinalComTimeout, DEEPSEEK_TIMEOUT_MS } from './aiProvider';
import { aiProxyToken, temBackendIA, urlBackendIA } from './runtimeConfig';
const GEMINI_VISION_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface ResultadoOcr {
  transcricao: string;
  duvida: string;
  /** Pronto para alimentar o input do chat (duvida + trecho). */
  textoParaChat: string;
}

/**
 * Prompt ESPELHO do worker (`POST /api/ocr-process`): transcreve o
 * manuscrito e extrai a duvida em JSON. Mantido duplicado de proposito -
 * worker (Node/wrangler) e front (Vite) nao compartilham modulo aqui.
 */
export const PROMPT_OCR = [
  'Voce e o scanner do Midnight Mentor. Transcreva o texto MANUSCRITO da foto com fidelidade total (mantenha numeros, formulas e unidades).',
  'Depois, em UMA frase, extraia a duvida principal do aluno sobre esse trecho.',
  'Responda APENAS com JSON valido, sem markdown: {"transcricao": "<texto fiel>", "duvida": "<duvida em 1 frase>"}',
  'Se a foto estiver ilegivel, devolva {"transcricao": "", "duvida": ""}.',
].join('\n');

function normalizar(data: unknown): ResultadoOcr {
  const o = (data ?? {}) as Record<string, unknown>;
  const transcricao = String(o.transcricao ?? '').slice(0, 4000);
  const duvida = String(o.duvida ?? '').slice(0, 500);
  const textoParaChat =
    String(o.textoParaChat ?? '').trim() ||
    (duvida && transcricao
      ? `${duvida}\n\nTrecho do caderno: ${transcricao}`
      : transcricao || duvida);
  return { transcricao, duvida, textoParaChat };
}

function extrairJson(texto: string): ResultadoOcr {
  const limpo = texto.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return normalizar(JSON.parse(limpo));
  } catch {
    const i = limpo.indexOf('{');
    const f = limpo.lastIndexOf('}');
    if (i >= 0 && f > i) {
      try {
        return normalizar(JSON.parse(limpo.slice(i, f + 1)));
      } catch {
        /* cai no vazio abaixo */
      }
    }
    return { transcricao: limpo.slice(0, 4000), duvida: '', textoParaChat: limpo.slice(0, 4000) };
  }
}

/**
 * EPICO 1: foto do caderno (data-URL ou base64) -> transcricao + duvida.
 * Com worker publicado usa `/api/ocr-process` (chave no servidor); sem
 * worker, chama o Gemini Vision direto com a chave do aluno.
 */
export async function transcreverManuscrito(
  imageBase64: string,
  opts: { apiKey?: string; signal?: AbortSignal } = {},
): Promise<ResultadoOcr> {
  const base64 = imageBase64.includes(',') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

  if (temBackendIA()) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = aiProxyToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Foto de material escolar de menor: worker exige o JWT.
    try {
      const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
      const jwt = data.session?.access_token;
      if (jwt) headers['X-Supabase-Auth'] = jwt;
    } catch {
      /* sem sessao o worker devolve 401 acionavel */
    }
    const res = await fetch(urlBackendIA('/api/ocr-process'), {
      method: 'POST',
      headers,
      signal: sinalComTimeout(opts.signal, DEEPSEEK_TIMEOUT_MS),
      body: JSON.stringify({ imageBase64: base64 }),
    });
    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      throw new Error(`Falha no OCR (${res.status}): ${detalhe.slice(0, 160)}`);
    }
    return normalizar(await res.json());
  }

  // Sem worker: Gemini Vision direto (chave do aluno, como no chat direto).
  const apiKey = (opts.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('OCR indisponível: defina GEMINI_API_KEY nas Environment Variables do projeto, ou informe sua chave da IA no Perfil.');
  }
  const match = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  const mimeType = match ? match[1] : 'image/jpeg';
  const data = match ? match[2] : base64;
  const res = await fetch(GEMINI_VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: sinalComTimeout(opts.signal, DEEPSEEK_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: PROMPT_OCR }, { inlineData: { mimeType, data } }],
        },
      ],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Falha no OCR (${res.status}).`);
  const json = await res.json();
  const texto = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || '').join('') ?? '';
  return extrairJson(String(texto));
}
