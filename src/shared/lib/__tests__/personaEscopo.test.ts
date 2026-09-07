import { afterEach, describe, expect, it, vi } from 'vitest';
import { montarInstrucaoDaPersona } from '../aiService';
import { useAppStore } from '../../../stores/appStore';
import type { ChatPersona } from '../../types';

/**
 * O professor de materia precisa FICAR na materia.
 *
 * Estes testes existem porque a versao anterior parecia certa lendo o
 * codigo - a instrucao dizia "responda apenas sobre matematica" - e nao
 * era: a frase ia solta no meio de um paragrafo, sem dizer o que fazer
 * com pergunta de fora, e competindo com um pedido de tom oposto. O que
 * se verifica aqui e o texto que de fato viaja para o modelo.
 */

const MATEMATICA = () =>
  useAppStore.getState().personas.find((p) => p.id === 'prof_matematica')!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('professores embutidos', () => {
  it('as quatro materias tem escopo declarado', () => {
    const { personas } = useAppStore.getState();
    for (const id of ['prof_matematica', 'prof_portugues', 'prof_ciencias', 'prof_humanas']) {
      const p = personas.find((x) => x.id === id)!;
      expect(p, id).toBeDefined();
      expect(p.escopo, `${id} sem escopo`).toBeTruthy();
    }
  });

  it('o mentor geral NAO tem escopo - e ele quem recebe o que sobra', () => {
    expect(useAppStore.getState().personas.find((p) => p.id === 'mentor_enem')!.escopo).toBeUndefined();
  });

  it('o escopo de matematica cobre os assuntos que o ENEM cobra', () => {
    const escopo = MATEMATICA().escopo!.toLowerCase();
    for (const assunto of ['álgebra', 'geometria', 'estatística', 'probabilidade', 'funç']) {
      expect(escopo, assunto).toContain(assunto);
    }
  });
});

describe('montarInstrucaoDaPersona', () => {
  it('limita o professor de matematica e diz o que fazer fora do escopo', () => {
    const instrucao = montarInstrucaoDaPersona(MATEMATICA());

    expect(instrucao).toContain('PAPEL: Prof. Matemática');
    expect(instrucao).toContain('ESCOPO: voce responde somente sobre matemática');
    // O desfecho e o que faltava: nomear a area e mandar para o professor certo.
    expect(instrucao).toContain('nao responda o conteudo pedido');
    expect(instrucao).toContain('indique qual professor do app cobre isso');
  });

  it('nunca trata cansaco ou ansiedade como fora de escopo', () => {
    const instrucao = montarInstrucaoDaPersona(MATEMATICA());
    expect(instrucao).toContain('EXCECAO');
    expect(instrucao).toContain('ansiedade');
    expect(instrucao).toContain('NUNCA sao fora de escopo');
  });

  it('fora de escopo, recusa educada e oferece ajuda na propria materia', () => {
    const instrucao = montarInstrucaoDaPersona(MATEMATICA());
    expect(instrucao).toContain('recuse em UMA frase educada');
    expect(instrucao).toContain('ofereca ajuda dentro da SUA materia');
  });

  it('o mentor geral cobre TRI, redacao 1000 e cronogramas, sem escopo', () => {
    const { personas } = useAppStore.getState();
    const mentor = personas.find((p) => p.id === 'mentor_enem')!;
    expect(mentor.instruction).toContain('TRI');
    expect(mentor.instruction).toContain('1000');
    expect(mentor.instruction).toContain('cronogramas');
    expect(montarInstrucaoDaPersona(mentor)).not.toContain('ESCOPO:');
  });

  it('cada professor declara exclusividade na propria materia', () => {
    const { personas } = useAppStore.getState();
    const mapa: Record<string, string> = {
      prof_matematica: 'SOMENTE matematica',
      prof_portugues: 'exclusivamente lingua portuguesa',
      prof_ciencias: 'exclusivamente ciencias da natureza',
      prof_humanas: 'exclusivamente ciencias humanas',
    };
    for (const [id, trecho] of Object.entries(mapa)) {
      const p = personas.find((x) => x.id === id)!;
      expect(p.instruction, id).toContain(trecho);
    }
  });

  it('resolve o conflito entre rigor do papel e tom do Sagui', () => {
    const instrucao = montarInstrucaoDaPersona(MATEMATICA());
    expect(instrucao).toContain('PRECEDENCIA');
    expect(instrucao).toContain('o TOM segue o do Sagui');
    // O tom base continua presente.
    expect(instrucao).toContain('Sagui');
    expect(instrucao).toContain('ensino médio noturno');
  });

  it('persona criada pelo usuario nao ganha limite que ela nao pediu', () => {
    const minha: ChatPersona = {
      id: '42', name: 'Tutor de Xadrez', icon: 'brain', color: '#fff',
      instruction: 'Ajude com aberturas de xadrez.', createdAt: 0,
    };
    const instrucao = montarInstrucaoDaPersona(minha);

    expect(instrucao).toContain('PAPEL: Tutor de Xadrez');
    expect(instrucao).not.toContain('ESCOPO:');
  });

  it('persona customizada real recebe a trava de seguranca para estudos', () => {
    const minha: ChatPersona = {
      id: 'persona_99', name: 'Tutor Livre', icon: 'mente', color: '#fff',
      instruction: 'Ajude com qualquer coisa.', createdAt: Date.now(),
    };
    const instrucao = montarInstrucaoDaPersona(minha);

    expect(instrucao).not.toContain('ESCOPO:');
    expect(instrucao).toContain('SEGURANCA');
    expect(instrucao).toContain('hacking');
    expect(instrucao).toContain('ilicitas');
    expect(instrucao).toContain('xingamentos');
    expect(instrucao).toContain('SOMENTE para estudos');
  });

  it('professores embutidos NAO recebem a trava de customizada', () => {
    expect(montarInstrucaoDaPersona(MATEMATICA())).not.toContain('SEGURANCA');
    const { personas } = useAppStore.getState();
    const mentor = personas.find((p) => p.id === 'mentor_enem')!;
    expect(montarInstrucaoDaPersona(mentor)).not.toContain('SEGURANCA');
  });

  it('sem professor selecionado, so o prompt base do Sagui', () => {
    const instrucao = montarInstrucaoDaPersona(null);
    expect(instrucao).not.toContain('PAPEL:');
    expect(instrucao).not.toContain('ESCOPO:');
    expect(instrucao).toContain('Sagui');
  });

  it('toggle comunicativo entra no system; padrao e explicativo', () => {
    const com = montarInstrucaoDaPersona(MATEMATICA(), { modoResposta: 'comunicativo' });
    expect(com).toContain('MODO DE RESPOSTA: comunicativo');
    expect(com).toContain('macetes rapidos');

    const padrao = montarInstrucaoDaPersona(MATEMATICA());
    expect(padrao).toContain('MODO DE RESPOSTA: explicativo');
  });

  it('cada professor cita a propria materia e nao a dos outros', () => {
    const { personas } = useAppStore.getState();
    const humanas = montarInstrucaoDaPersona(personas.find((p) => p.id === 'prof_humanas')!);

    expect(humanas).toContain('ESCOPO: voce responde somente sobre ciências humanas');
    expect(humanas).not.toContain('somente sobre matemática');
  });
});

describe('o que chega ao modelo', () => {
  it('sendMessageToGemini envia o escopo no systemInstruction', async () => {
    // Fixa o envelope Gemini (o .env do projeto pode apontar para deepseek;
    // o caminho DeepSeek tem cobertura propria em deepseekProvider.test.ts).
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'gemini');
    vi.stubEnv('VITE_AI_MODEL', 'gemini-2.0-flash');
    vi.stubEnv('VITE_AI_BASE_URL', '');
    const { sendMessageToGemini } = await import('../aiService');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'x = 4' }] } }] }),
      text: async () => 'x = 4',
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessageToGemini('Resolva 2x = 8', { apiKey: 'chave', persona: MATEMATICA() });

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system = corpo.systemInstruction.parts[0].text;

    expect(system).toContain('ESCOPO: voce responde somente sobre matemática');
    expect(system).toContain('PRECEDENCIA');
    // A pergunta do aluno vai como conteudo, nao no system.
    expect(corpo.contents.at(-1).parts[0].text).toBe('Resolva 2x = 8');
  });

  it('sendMessageToGemini repassa o modo de resposta ao system', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'gemini');
    vi.stubEnv('VITE_AI_MODEL', 'gemini-2.0-flash');
    vi.stubEnv('VITE_AI_BASE_URL', '');
    const { sendMessageToGemini } = await import('../aiService');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
      text: async () => 'ok',
    });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessageToGemini('oi', { apiKey: 'chave', persona: MATEMATICA(), modoResposta: 'comunicativo' });

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.systemInstruction.parts[0].text).toContain('MODO DE RESPOSTA: comunicativo');
  });
});
