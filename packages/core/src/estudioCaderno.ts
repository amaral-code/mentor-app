/**
 * Notebook AI Studio: o que dá para fazer com as anotações do caderno.
 *
 * Os prompts e os planos B sem IA moravam no NotebookStudioModal do web.
 * O celular faz as mesmas quatro coisas (resumo, mapa mental, flashcards,
 * lacunas), então a lógica veio para cá e cada app só desenha.
 */
import { aiAvailable, askGemini, gerarMapaMental, type DadosMapaMental } from './aiService';
import { mapaMentalLocal } from './mapaMental';

export type FerramentaEstudio = 'resumo' | 'mapa' | 'flashcards' | 'lacunas';

export function promptResumo(textos: string[]): string {
  return [
    'Com base nas anotações de estudante abaixo, escreva um resumo bem estruturado:',
    'títulos curtos, os conceitos principais, as conexões entre os temas e o que merece revisão.',
    'Use listas com • e frases curtas: o aluno vai ler no celular.',
    '',
    ...textos.map((t) => `• ${t}`),
  ].join('\n');
}

export function promptLacunas(textos: string[]): string {
  return [
    'Analise estas anotações de estudante e diga:',
    '1. quais conceitos aparecem várias vezes (possível dúvida ainda aberta);',
    '2. que tópicos pedem revisão;',
    '3. três focos prioritários para a próxima sessão.',
    'Responda com títulos curtos e listas com •.',
    '',
    ...textos.map((t) => `• ${t}`),
  ].join('\n');
}

/** Sem IA: as primeiras frases de cada nota, como esqueleto de revisão. */
export function resumoLocal(textos: string[]): string {
  const pontos = textos
    .map((t) => t.split(/(?<=[.!?])\s+/)[0]?.trim())
    .filter((f): f is string => !!f && f.length > 8)
    .slice(0, 10);
  if (pontos.length === 0) return 'Escreva algumas anotações para gerar o resumo.';
  return ['## Pontos das suas anotações', ...pontos.map((p) => `• ${p}`), '', '*Resumo feito sem IA: a versão completa precisa de internet.*'].join('\n');
}

/** Sem IA: palavras que voltam em mais de uma nota (assunto ainda em aberto). */
export function lacunasLocais(textos: string[]): string {
  const freq = new Map<string, number>();
  for (const t of textos) {
    for (const p of new Set(t.toLowerCase().match(/[a-zà-ÿ]{5,}/g) ?? [])) freq.set(p, (freq.get(p) ?? 0) + 1);
  }
  const recorrentes = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (recorrentes.length === 0) return 'Nenhum conceito se repete entre as notas ainda. Continue anotando!';
  return [
    '## Conceitos que voltam nas suas notas',
    ...recorrentes.map(([p, n]) => `• **${p}** aparece em ${n} notas`),
    '',
    'Revise esses primeiro: quando um assunto volta várias vezes, costuma ser dúvida que ainda não fechou.',
  ].join('\n');
}

export async function gerarTextoDoEstudio(ferramenta: 'resumo' | 'lacunas', textos: string[], apiKey: string): Promise<{ texto: string; viaIA: boolean }> {
  const lista = textos.map((t) => t.trim()).filter(Boolean).slice(-15);
  const local = () => (ferramenta === 'resumo' ? resumoLocal(lista) : lacunasLocais(lista));
  if (lista.length === 0 || !aiAvailable(apiKey)) return { texto: local(), viaIA: false };
  try {
    const texto = await askGemini(ferramenta === 'resumo' ? promptResumo(lista) : promptLacunas(lista), null, apiKey);
    return texto.trim() ? { texto, viaIA: true } : { texto: local(), viaIA: false };
  } catch {
    return { texto: local(), viaIA: false };
  }
}

export async function gerarMapaDoEstudio(textos: string[], apiKey: string): Promise<{ dados: DadosMapaMental | null; viaIA: boolean }> {
  const lista = textos.map((t) => t.trim()).filter(Boolean);
  if (aiAvailable(apiKey)) {
    try {
      const dados = await gerarMapaMental(lista, apiKey);
      if (dados) return { dados, viaIA: true };
    } catch {
      /* cai no mapa local */
    }
  }
  return { dados: mapaMentalLocal(lista), viaIA: false };
}
