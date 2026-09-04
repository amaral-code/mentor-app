import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Testes das chamadas de IA do modulo de bem-estar.
 *
 * O fetch e substituido: o objetivo nao e falar com o Google, e provar o
 * que o NOSSO codigo monta e como ele reage - qual endpoint, qual
 * payload, quais regras vao no prompt e o que acontece quando a resposta
 * vem quebrada.
 *
 * aiService le import.meta.env no momento do import (PROXY_URL e uma
 * const de modulo), entao cada cenario reimporta o modulo depois de
 * ajustar o ambiente.
 */

/** Resposta no formato que o Gemini devolve. */
function respostaGemini(texto: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] }),
    text: async () => texto,
  };
}

async function carregarAi(proxy = '') {
  vi.resetModules();
  // Estes testes fixam o envelope Gemini. O caminho DeepSeek tem
  // cobertura propria em deepseekProvider.test.ts.
  vi.stubEnv('VITE_AI_PROVIDER', 'gemini');
  vi.stubEnv('VITE_AI_MODEL', 'gemini-2.0-flash');
  vi.stubEnv('VITE_AI_BASE_URL', proxy);
  vi.stubEnv('VITE_AI_PROXY_TOKEN', proxy ? 'token-de-teste' : '');
  return import('../aiService');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('gerarRoteiroAudio', () => {
  it('pede um roteiro falado com as restricoes de duracao e formato', async () => {
    const { gerarRoteiroAudio } = await carregarAi();
    const fetchMock = vi.fn().mockResolvedValue(respostaGemini('Se a celula fosse uma cidade...'));
    vi.stubGlobal('fetch', fetchMock);

    const texto = await gerarRoteiroAudio('Biologia', 'Citologia', 'chave');

    expect(texto).toBe('Se a celula fosse uma cidade...');
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = corpo.contents[0].parts[0].text;

    expect(prompt).toContain('Citologia');
    expect(prompt).toContain('Biologia');
    expect(prompt).toContain('3 minutos');
    // As restricoes que fazem o texto servir para OUVIR, nao para ler.
    expect(prompt).toContain('400 e 470 palavras');
    expect(prompt).toContain('observe a figura');
    expect(prompt).toContain('Nao use markdown');
    expect(corpo.generationConfig.temperature).toBe(0.6);
  });

  it('limpa marcacao que o modelo insista em colocar', async () => {
    const { gerarRoteiroAudio } = await carregarAi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaGemini('## Titulo\n**Ola** `mundo`')));

    expect(await gerarRoteiroAudio('Historia', 'Vargas', 'chave')).toBe('Titulo\nOla mundo');
  });

  it('propaga falha do servidor', async () => {
    const { gerarRoteiroAudio } = await carregarAi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403, json: async () => ({}), text: async () => 'sem permissao',
    }));

    await expect(gerarRoteiroAudio('Biologia', 'Citologia', 'chave')).rejects.toThrow(/roteiro/i);
  });
});

describe('sintetizarAudio', () => {
  it('exige o proxy: a chave do TTS nao pode ir para o navegador', async () => {
    const { sintetizarAudio } = await carregarAi('');
    await expect(sintetizarAudio('texto')).rejects.toThrow(/VITE_AI_BASE_URL/);
  });

  it('chama /tts no worker e devolve data URL pronta para o player', async () => {
    const { sintetizarAudio } = await carregarAi('https://worker.dev');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ audioBase64: 'QUJD', mime: 'audio/mpeg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { url } = await sintetizarAudio('Roteiro', { voz: 'pt-BR-Neural2-A', velocidade: 1.2 });

    expect(url).toBe('data:audio/mpeg;base64,QUJD');
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe('https://worker.dev/tts');
    expect(init.headers.Authorization).toBe('Bearer token-de-teste');
    expect(JSON.parse(init.body)).toEqual({ texto: 'Roteiro', voz: 'pt-BR-Neural2-A', velocidade: 1.2 });
  });

  it('avisa quando o audio volta vazio em vez de tocar silencio', async () => {
    const { sintetizarAudio } = await carregarAi('https://worker.dev');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }));

    await expect(sintetizarAudio('x')).rejects.toThrow(/vazia/i);
  });
});

describe('gerarIntervencaoDoomscroll', () => {
  const contexto = { materiaSugerida: 'Biologia', segundosVagando: 140, horaLocal: 23 };

  it('exige uma unica proposta curta e sem julgamento', async () => {
    const { gerarIntervencaoDoomscroll } = await carregarAi();
    const fetchMock = vi.fn().mockResolvedValue(
      respostaGemini('{"titulo":"Voce parece na duvida.","convite":"Vamos fazer 3 questoes de Biologia?","acao":"Comecar 3 questoes","materia":"Biologia"}'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const r = await gerarIntervencaoDoomscroll(contexto, 'chave');
    expect(r.titulo).toBe('Voce parece na duvida.');
    expect(r.acao).toBe('Comecar 3 questoes');

    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(prompt).toContain('paralisia por analise');
    expect(prompt).toContain('Nao use emoji');
    expect(prompt).toContain('nao motive');
    // A regra central: uma opcao so.
    expect(prompt).toContain('Nao ofereca mais de uma opcao');
    expect(prompt).toContain('140 segundos');
  });

  it('completa campos faltantes em vez de quebrar a interface', async () => {
    const { gerarIntervencaoDoomscroll } = await carregarAi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaGemini('{"titulo":"Pausa?"}')));

    const r = await gerarIntervencaoDoomscroll(contexto, 'chave');
    expect(r.titulo).toBe('Pausa?');
    expect(r.convite).toContain('Biologia');
    expect(r.acao).toBeTruthy();
  });

  it('aceita JSON embrulhado em texto do modelo', async () => {
    const { gerarIntervencaoDoomscroll } = await carregarAi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respostaGemini('Claro! {"titulo":"Ei","convite":"Tres questoes?","acao":"Comecar","materia":"Fisica"} '),
    ));

    expect((await gerarIntervencaoDoomscroll(contexto, 'chave')).materia).toBe('Fisica');
  });
});

describe('gerarRelatorioDescompressao', () => {
  const metricas = {
    diasAtivos: 4, minutosOffline: 120, minutosFoco: 75, horasSonoMedia: 7.5,
    questoesRespondidas: 40, taxaAcerto: 65, streak: 4, sessoesMadrugada: 0, revisoesEmDia: 3,
  };

  it('envia a postura no system e os numeros no prompt do usuario', async () => {
    const { gerarRelatorioDescompressao } = await carregarAi();
    const fetchMock = vi.fn().mockResolvedValue(respostaGemini('Voce apareceu em 4 dos 7 dias.'));
    vi.stubGlobal('fetch', fetchMock);

    const texto = await gerarRelatorioDescompressao(metricas, 'chave', 'Ana');
    expect(texto).toBe('Voce apareceu em 4 dos 7 dias.');

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system = corpo.systemInstruction.parts[0].text;
    const usuario = corpo.contents[0].parts[0].text;

    // Postura no system: e o que o modelo nao pode fazer quando os
    // numeros da semana sao ruins.
    expect(system).toContain('Nunca');
    expect(system).toContain('coach');
    expect(system).toContain('4 frases');
    // Dados no user.
    expect(usuario).toContain('Ana');
    expect(usuario).toContain('120 minutos');
    // Teto de tokens e o que segura o "curto e direto".
    expect(corpo.generationConfig.maxOutputTokens).toBe(220);
  });
});

describe('gerarAlertaParaResponsavel', () => {
  it('proibe diagnostico e vazamento de conteudo privado do aluno', async () => {
    const { gerarAlertaParaResponsavel } = await carregarAi();
    const fetchMock = vi.fn().mockResolvedValue(respostaGemini('O ritmo de estudo mudou nos ultimos dias.'));
    vi.stubGlobal('fetch', fetchMock);

    await gerarAlertaParaResponsavel(
      { nomeAluno: 'Ana', score: 82, motivos: ['estudo de madrugada'] },
      'chave',
    );

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.systemInstruction.parts[0].text).toContain('nunca revela conteudo escrito pelo aluno');
    const prompt = corpo.contents[0].parts[0].text;
    expect(prompt).toContain('82/100');
    expect(prompt).toContain('nunca de conteudo privado');
    expect(prompt).toContain('Nao diagnostique');
    expect(prompt).toContain('sem pressionar');
  });
});
