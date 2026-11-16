/**
 * De onde vem o texto de uma pílula de áudio, em ordem de custo:
 *
 *   1. guardado no aparelho (gerado antes pela IA; texto é leve e não muda);
 *   2. roteiro completo que já veio do banco;
 *   3. a IA, que gera e o aparelho guarda;
 *   4. a versão curta de bolso, 100% local, quando a IA não responde.
 *
 * Morava dentro da AudioPillsPage do web. O celular precisa da mesma
 * ordem: sem ela, cada play gastaria uma chamada de IA.
 */
import type { ModuloAudio } from './types';
import { aiAvailable, gerarRoteiroAudio } from './aiService';
import { roteiroLocalEmergencia } from './audioPills';
import { safeGet, safeSet } from './safeStorage';

const CHAVE_ROTEIRO = 'mm_roteiro_audio_';
/** Abaixo disso é esboço do seed ou a versão curta: não serve de cache. */
const MINIMO_COMPLETO = 400;

export interface RoteiroObtido {
  texto: string;
  origem: 'aparelho' | 'banco' | 'ia' | 'bolso';
}

export async function obterRoteiroDaPilula(modulo: ModuloAudio, apiKey: string, signal?: AbortSignal): Promise<RoteiroObtido> {
  const salvo = safeGet(CHAVE_ROTEIRO + modulo.id);
  if (salvo && salvo.length > MINIMO_COMPLETO) return { texto: salvo, origem: 'aparelho' };

  if (modulo.roteiro && modulo.roteiro.length > MINIMO_COMPLETO && !modulo.roteiro.includes('[roteiro completo')) {
    return { texto: modulo.roteiro, origem: 'banco' };
  }

  // A curta NÃO vai ao cache: quando a IA voltasse, o app continuaria
  // servindo a curta para sempre.
  if (!aiAvailable(apiKey)) {
    return { texto: roteiroLocalEmergencia(modulo.materia, modulo.topico, modulo.resumo), origem: 'bolso' };
  }
  try {
    const texto = await gerarRoteiroAudio(modulo.materia, modulo.topico, apiKey, undefined, signal);
    if (texto.length > MINIMO_COMPLETO) safeSet(CHAVE_ROTEIRO + modulo.id, texto);
    return { texto, origem: 'ia' };
  } catch {
    return { texto: roteiroLocalEmergencia(modulo.materia, modulo.topico, modulo.resumo), origem: 'bolso' };
  }
}
