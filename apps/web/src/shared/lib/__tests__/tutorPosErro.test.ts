import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarPromptTutorPosErro } from '../aiService';
import type { ErroParaTutor } from '../aiService';

/**
 * Tutor pos-erro.
 *
 * O valor esta no diagnostico (reconstruir o raciocinio errado), nao em
 * repetir o gabarito. Estes testes travam a estrutura do prompt e o
 * caminho sem rede (acerto nao chama a IA).
 */

const ERRO: ErroParaTutor = {
  materia: 'Matemática',
  topico: 'Funções afins',
  enunciado: 'Uma função afim passa por (0, 2) e (2, 6). Qual o coeficiente angular?',
  alternativas: ['1', '2', '3', '4'],
  escolhida: 0,
  correta: 1,
  explicacao: 'm = (6-2)/(2-0) = 2.',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('montarPromptTutorPosErro', () => {
  it('system exige estrutura empatica curta, sem culpa', () => {
    const { system } = montarPromptTutorPosErro(ERRO);
    expect(system).toContain('Sagui');
    expect(system).toContain('O que você provavelmente pensou');
    expect(system).toContain('Onde saiu do trilho');
    expect(system).toContain('Da próxima vez');
    expect(system).toContain('150 palavras');
    expect(system).toContain('sem culpa');
  });

  it('user leva resposta dada vs gabaritada com letras', () => {
    const { user } = montarPromptTutorPosErro(ERRO);
    expect(user).toContain('Matemática');
    expect(user).toContain('Funções afins');
    expect(user).toContain('O aluno marcou: A) 1');
    expect(user).toContain('Resposta correta: B) 2');
    expect(user).toContain('m = (6-2)/(2-0)');
  });
});

describe('explicarErroComTutor', () => {
  async function carregarAi() {
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'gemini');
    vi.stubEnv('VITE_AI_MODEL', 'gemini-2.0-flash');
    vi.stubEnv('VITE_AI_BASE_URL', '');
    return import('../aiService');
  }

  it('acerto nao chama a IA (economiza a chamada)', async () => {
    const { explicarErroComTutor } = await carregarAi();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const texto = await explicarErroComTutor({ ...ERRO, escolhida: 1 }, 'chave');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(texto).toContain('Resposta certa');
  });

  it('erro envia o diagnostico e devolve o texto do tutor', async () => {
    const { explicarErroComTutor } = await carregarAi();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Você pensou em Δx...' }] } }] }),
      text: async () => 'Você pensou em Δx...',
    });
    vi.stubGlobal('fetch', fetchMock);

    const texto = await explicarErroComTutor(ERRO, 'chave');
    expect(texto).toContain('Você pensou em Δx...');
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.systemInstruction.parts[0].text).toContain('Sagui');
    expect(corpo.contents[0].parts[0].text).toContain('O aluno marcou: A) 1');
  });
});
