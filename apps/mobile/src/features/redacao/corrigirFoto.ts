import { getSupabase } from '@mentor/api/supabase';
import { DEEPSEEK_TIMEOUT_MS, sinalComTimeout } from '@mentor/core/aiProvider';
import { aiProxyToken, temBackendIA, urlBackendIA } from '@mentor/core/runtimeConfig';
import { correctEssay } from '@mentor/core/essayCorrector';
import type { EssayCorrection } from '@mentor/core/types';
import { ajustarParaGrade, COMPETENCIAS, normalizarCorrecao, pareceFotoIlegivel, type CorrecaoFoto } from '../../../../../server/essaySchema.js';
import { arquivoParaFormData } from '../../lib/arquivoFormData';
import type { FotoPronta } from '../../lib/foto';

/** O que a tela mostra, venha a correção do servidor ou do corretor offline. */
export interface ResultadoRedacao {
  origem: 'servidor' | 'offline';
  total: number;
  competencias: { titulo: string; nota: number; feedback: string }[];
  fortes: string[];
  melhorar: string[];
  transcricao: string;
  tema: string;
  ilegivel: boolean;
  /** Para o store (`setLastCorrection`), no formato que o resto do app usa. */
  paraStore: EssayCorrection;
}

function mensagemDeErro(status: number, detalhe: string): string {
  if (status === 401) return 'Sessão expirada. Entre de novo para enviar a foto.';
  if (status === 413) return 'A foto ficou grande demais. Tente enquadrar só a folha.';
  if (status === 415) return 'Formato de imagem não aceito. Use JPG ou PNG.';
  if (status === 429) return 'Muitas correções seguidas. Aguarde um instante.';
  return `Não foi possível corrigir a foto (${status}). ${detalhe.slice(0, 120)}`;
}

function doServidor(c: CorrecaoFoto, tema: string): ResultadoRedacao {
  return {
    origem: 'servidor',
    total: c.total_score,
    competencias: COMPETENCIAS.map((def) => ({ titulo: def.titulo, nota: c.scores[def.chave].score, feedback: c.scores[def.chave].feedback })),
    fortes: c.strengths,
    melhorar: c.actionable_improvements,
    transcricao: c.transcription,
    tema: c.detected_theme || tema,
    ilegivel: pareceFotoIlegivel(c),
    paraStore: {
      competencia1: c.scores.competence_1.score,
      competencia2: c.scores.competence_2.score,
      competencia3: c.scores.competence_3.score,
      competencia4: c.scores.competence_4.score,
      competencia5: c.scores.competence_5.score,
      notaFinal: c.total_score,
      pontosFortes: c.strengths,
      pontosMelhorar: c.actionable_improvements,
      originalText: c.transcription,
    },
  };
}

/**
 * Foto para `/api/essays/upload-and-grade`: o servidor guarda no bucket
 * privado do aluno (`essay_scans/<uid>/...`), faz o OCR e corrige nas 5
 * competências numa chamada só. Exige o JWT: é material de um menor.
 */
export async function corrigirFotoNoServidor(foto: FotoPronta, tema: string, signal?: AbortSignal): Promise<ResultadoRedacao> {
  if (!temBackendIA()) throw new Error('Sem conexão com o servidor de correção.');
  const headers: Record<string, string> = {};
  const token = aiProxyToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
  if (data.session?.access_token) headers['X-Supabase-Auth'] = data.session.access_token;

  const form = new FormData();
  form.append('imagem', await arquivoParaFormData(foto.uri, 'redacao.jpg', 'image/jpeg'));
  if (tema.trim()) form.append('tema', tema.trim());

  /* O dobro do teto do chat: a foto sobe, o OCR lê e a correção roda, tudo
     na mesma requisição. Abaixo disso, 4G fraco cortaria no meio. */
  const resposta = await fetch(urlBackendIA('/api/essays/upload-and-grade'), {
    method: 'POST',
    headers,
    body: form,
    signal: sinalComTimeout(signal, DEEPSEEK_TIMEOUT_MS * 2),
  });
  if (!resposta.ok) throw new Error(mensagemDeErro(resposta.status, await resposta.text().catch(() => '')));
  return doServidor(normalizarCorrecao(await resposta.json()), tema);
}

/**
 * Corretor offline (heurístico, do @mentor/core): não lê foto, então
 * trabalha sobre o texto que o aluno digitou ou a transcrição que já
 * tinha chegado. A nota é estimativa e a tela diz isso.
 */
export function corrigirOffline(texto: string, tema: string): ResultadoRedacao {
  const bruta = correctEssay(texto, tema || undefined);
  /* O corretor heurístico devolve qualquer número (78, 4...). A grade do
     INEP é 0, 40, 80, 120, 160 ou 200: ajustada aqui, a nota offline fala
     a mesma língua da correção do servidor. */
  const notas = [bruta.competencia1, bruta.competencia2, bruta.competencia3, bruta.competencia4, bruta.competencia5].map(ajustarParaGrade);
  const c: EssayCorrection = {
    ...bruta,
    competencia1: notas[0],
    competencia2: notas[1],
    competencia3: notas[2],
    competencia4: notas[3],
    competencia5: notas[4],
    notaFinal: notas.reduce((s, n) => s + n, 0),
  };
  return {
    origem: 'offline',
    total: c.notaFinal,
    competencias: COMPETENCIAS.map((def, i) => ({ titulo: def.titulo, nota: notas[i], feedback: '' })),
    fortes: c.pontosFortes,
    melhorar: c.pontosMelhorar,
    transcricao: texto,
    tema,
    ilegivel: false,
    paraStore: c,
  };
}
