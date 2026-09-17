import { describe, expect, it } from 'vitest';
import {
  buildMindmapMermaid,
  parseMapaMental,
  parseQuizJson,
  sanitizarRotuloMermaid,
} from '../aiService';

/**
 * Quiz em JSON e mapa mental em JSON+Mermaid.
 *
 * O bug que estes testes travam: o gerador em texto livre ("Resposta: B")
 * quebrava a cada variação de formato do modelo e a tela de jogo voltava
 * vazia. Com schema fixo + validação campo a campo, o que não passa é
 * descartado - e o Mermaid é montado aqui, nunca pelo modelo.
 */

const QUIZ_OK = JSON.stringify([
  {
    tema: 'Funções afins',
    enunciado: 'Uma função afim passa por (0, 2) e (2, 6). Qual é o coeficiente angular?',
    alternativas: ['1', '2', '3', '4'],
    correta: 1,
    explicacao: 'm = (6-2)/(2-0) = 2.',
    dica: 'Lembre da fórmula m = Δy/Δx.',
    dificuldade: 'facil',
  },
  {
    tema: 'Probabilidade',
    enunciado: 'Ao lançar um dado honesto, qual a probabilidade de sair número par?',
    alternativas: ['1/6', '1/3', '1/2', '2/3'],
    correta: 2,
    explicacao: '3 pares em 6 faces = 1/2.',
    dica: 'Conte os casos favoráveis.',
    dificuldade: 'facil',
  },
]);

describe('parseQuizJson', () => {
  it('converte JSON válido com tema, 4 alternativas, dica e dificuldade', () => {
    const qs = parseQuizJson(QUIZ_OK, 'Matemática');
    expect(qs).toHaveLength(2);
    expect(qs[0].materia).toBe('Matemática');
    expect(qs[0].topico).toBe('Funções afins');
    expect(qs[0].alternativas).toHaveLength(4);
    expect(qs[0].correta).toBe(1);
    expect(qs[0].dica).toContain('Δy');
    expect(qs[0].dificuldade).toBe('facil');
  });

  it('aceita correta como letra e objeto embrulhado', () => {
    const raw = JSON.stringify({
      questoes: [
        {
          tema: 'T',
          enunciado: 'Enunciado com mais de dez caracteres aqui.',
          alternativas: ['A1', 'B2', 'C3', 'D4'],
          correta: 'C',
          explicacao: 'x',
          dica: 'y',
          dificuldade: 'media',
        },
      ],
    });
    const qs = parseQuizJson(raw, 'Física');
    expect(qs).toHaveLength(1);
    expect(qs[0].correta).toBe(2);
  });

  it('remove cercas de markdown antes do parse', () => {
    const qs = parseQuizJson('```json\n' + QUIZ_OK + '\n```', 'Matemática');
    expect(qs).toHaveLength(2);
  });

  it('descarta questão com menos de 4 alternativas ou índice inválido', () => {
    const raw = JSON.stringify([
      { tema: 'T', enunciado: 'Enunciado válido com contexto suficiente.', alternativas: ['A', 'B'], correta: 0, explicacao: 'x' },
      { tema: 'T', enunciado: 'Outro enunciado válido com contexto aqui.', alternativas: ['A', 'B', 'C', 'D'], correta: 7, explicacao: 'x' },
      { tema: 'T', enunciado: 'Enunciado ok para renderizar na tela.', alternativas: ['A', 'B', 'C', 'D', 'E'], correta: 0, explicacao: 'x' },
    ]);
    const qs = parseQuizJson(raw, 'Química');
    // Só a terceira passa (5ª alternativa é cortada, não a questão).
    expect(qs).toHaveLength(1);
    expect(qs[0].alternativas).toHaveLength(4);
  });

  it('texto fora de JSON devolve lista vazia (tela mostra erro, não quebra)', () => {
    expect(parseQuizJson('Desculpe, não consegui gerar.', 'Biologia')).toEqual([]);
    expect(parseQuizJson('', 'Biologia')).toEqual([]);
  });

  it('repasa a fonte declarada pela banca', () => {
    const raw = JSON.stringify([
      {
        tema: 'T', enunciado: 'Enunciado com contexto suficiente aqui.',
        alternativas: ['A', 'B', 'C', 'D'], correta: 0, explicacao: 'x',
        fonte: 'ENEM 2022', dificuldade: 'media',
      },
    ]);
    expect(parseQuizJson(raw, 'História')[0].fonte).toBe('ENEM 2022');
  });
  /* ============================================================
   * RESPOSTA CORTADA NO LIMITE DE TOKENS
   * ------------------------------------------------------------
   * Era o "as vezes nao gera dependendo das questoes": o pedido
   * estourava o teto de saida do back-end, o array voltava sem o `]`
   * final, `JSON.parse` falhava no todo e a tela recebia lista VAZIA -
   * mesmo havendo questoes inteiras dentro da resposta.
   * ============================================================ */
  it('recupera as questoes inteiras de uma resposta truncada', () => {
    // Array valido, cortado no meio da terceira questao.
    const cortado = QUIZ_OK.slice(0, QUIZ_OK.length - 1) + ',{"tema":"Geometria","enunciado":"Um triangulo ret';
    const qs = parseQuizJson(cortado, 'Matemática');
    expect(qs).toHaveLength(2);
    expect(qs[0].alternativas).toHaveLength(4);
    expect(qs[1].correta).toBe(2);
  });

  it('descarta o objeto incompleto em vez de gerar questao quebrada', () => {
    const cortado = '[{"enunciado":"Questao completa e valida aqui","alternativas":["a","b","c","d"],"correta":0,"explicacao":"x"},{"enunciado":"corta';
    const qs = parseQuizJson(cortado, 'Física');
    expect(qs).toHaveLength(1);
    expect(qs[0].enunciado).toContain('completa');
  });

  it('resgata tambem quando o modelo embrulha num objeto e corta', () => {
    const cortado = '{"questoes":[{"enunciado":"Enunciado suficientemente longo","alternativas":["a","b","c","d"],"correta":3,"explicacao":"y"},{"enunc';
    const qs = parseQuizJson(cortado, 'Química');
    expect(qs).toHaveLength(1);
    expect(qs[0].correta).toBe(3);
  });

  it('enunciado com chaves nao atrapalha o resgate', () => {
    const cortado = '[{"enunciado":"Dado o conjunto {1,2,3}, quantos subconjuntos","alternativas":["2","4","6","8"],"correta":3,"explicacao":"2^3"},{"en';
    const qs = parseQuizJson(cortado, 'Matemática');
    expect(qs).toHaveLength(1);
    expect(qs[0].enunciado).toContain('{1,2,3}');
  });

  it('resposta sem nada aproveitavel segue devolvendo vazio', () => {
    expect(parseQuizJson('desculpe, nao consigo gerar isso', 'Matemática')).toEqual([]);
    expect(parseQuizJson('{"erro":"cota', 'Matemática')).toEqual([]);
  });

});

describe('generateQuizStructured (banca + antirrepeticao)', () => {
  it('prompt atua como banca, filtra dificuldade e injeta o historico', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.stubEnv('VITE_AI_PROVIDER', 'gemini');
    vi.stubEnv('VITE_AI_MODEL', 'gemini-2.0-flash');
    vi.stubEnv('VITE_AI_BASE_URL', '');
    const { generateQuizStructured } = await import('../aiService');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '[]' }] } }] }),
      text: async () => '[]',
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateQuizStructured('Matemática', 'Funções', 'chave', 5, {
      dificuldade: 'dificil',
      historico: ['Questão antiga sobre função afim.'],
    });

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    const system = corpo.systemInstruction.parts[0].text;
    const user = corpo.contents[0].parts[0].text;

    // Banca examinadora com provas reais como referencia.
    expect(system).toContain('banca examinadora');
    expect(system).toContain('FUVEST');
    expect(system).toContain('UNICAMP');
    // Dificuldade pedida na tela de configuracao.
    expect(user).toContain('DIFÍCIL');
    expect(user).toContain('FUVEST/UNICAMP segunda fase');
    // Historico antirrepeticao injetado.
    expect(user).toContain('JÁ APLICADAS');
    expect(user).toContain('Questão antiga sobre função afim.');
    // Schema com fonte e indice (nunca letra).
    expect(user).toContain('"fonte"');
    expect(user).toContain('ÍNDICE (0-3)');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe('mapa mental', () => {
  it('sanitiza tudo que quebra o Mermaid', () => {
    expect(sanitizarRotuloMermaid('Fotossíntese (clorofila) [etapa 1] "luz"')).toBe('Fotossíntese clorofila etapa 1 luz');
    expect(sanitizarRotuloMermaid('a#b|c`d\\e')).toBe('abcde');
    expect(sanitizarRotuloMermaid('')).toBe('');
  });

  it('monta mindmap válido com limites (5 ramos, 4 filhos)', () => {
    const code = buildMindmapMermaid({
      titulo: 'Revolução Francesa',
      ramos: Array.from({ length: 7 }, (_, i) => ({
        rotulo: `Causa ${i}`,
        filhos: ['a', 'b', 'c', 'd', 'e', 'f'],
      })),
    });
    const linhas = code.split('\n');
    expect(linhas[0]).toBe('mindmap');
    expect(linhas[1]).toContain('root((');
    expect(linhas[1]).toContain('Revolução Francesa');
    // mindmap + root + 5 ramos + 5x4 filhos = 27 linhas.
    expect(linhas).toHaveLength(27);
  });

  it('parseMapaMental extrai titulo e ramos do JSON do modelo', () => {
    const dados = parseMapaMental(
      '```json\n{"titulo":"Citologia","ramos":[{"rotulo":"Membrana","filhos":["seletiva","bicamada"]}]}\n```',
    );
    expect(dados?.titulo).toBe('Citologia');
    expect(dados?.ramos).toHaveLength(1);
    expect(dados?.ramos[0].filhos).toEqual(['seletiva', 'bicamada']);
  });

  it('sem ramos válidos, devolve null (cai no fallback local)', () => {
    expect(parseMapaMental('{"titulo":"X","ramos":[]}')).toBeNull();
    expect(parseMapaMental('texto livre')).toBeNull();
  });
});
