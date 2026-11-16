import { QuizQuestion } from '../types';

export const QUIZ_BANK: QuizQuestion[] = [
  // Matemática
  {
    id: 'mat_1',
    materia: 'Matemática',
    enunciado: 'Qual é o valor de (2+3)×4?',
    alternativas: ['14', '20', '24', '16'],
    correta: 1,
    explicacao: 'Primeiro resolve a soma (2+3=5), depois multiplica por 4: 5×4=20.',
  },
  {
    id: 'mat_2',
    materia: 'Matemática',
    enunciado: 'Uma progressão aritmética tem primeiro termo 5 e razão 3. Qual é o 10º termo?',
    alternativas: ['27', '30', '32', '35'],
    correta: 2,
    explicacao: 'PA: a₁₀ = a₁ + (n-1)×r = 5 + 9×3 = 5 + 27 = 32.',
  },
  {
    id: 'mat_3',
    materia: 'Matemática',
    enunciado: 'Qual é a área de um círculo de raio 4 cm? (π ≈ 3,14)',
    alternativas: ['25,12 cm²', '50,24 cm²', '12,56 cm²', '100,48 cm²'],
    correta: 1,
    explicacao: 'A = π×r² = 3,14×16 = 50,24 cm².',
  },
  {
    id: 'mat_4',
    materia: 'Matemática',
    enunciado: 'Se 3x + 7 = 22, qual o valor de x?',
    alternativas: ['3', '5', '7', '6'],
    correta: 1,
    explicacao: '3x = 22 - 7 = 15, x = 15/3 = 5.',
  },
  {
    id: 'mat_5',
    materia: 'Matemática',
    enunciado: 'Quantos centímetros cúbicos há em 2 litros?',
    alternativas: ['200 cm³', '2.000 cm³', '20.000 cm³', '200.000 cm³'],
    correta: 1,
    explicacao: '1 litro = 1.000 cm³, então 2 litros = 2.000 cm³.',
  },
  {
    id: 'mat_6',
    materia: 'Matemática',
    enunciado: 'Qual a probabilidade de sair cara no lançamento de uma moeda honesta?',
    alternativas: ['25%', '50%', '75%', '100%'],
    correta: 1,
    explicacao: 'Moeda tem 2 faces, 1 favorável: 1/2 = 50%.',
  },
  // Português
  {
    id: 'por_1',
    materia: 'Português',
    enunciado: 'Qual das palavras é um substantivo abstrato?',
    alternativas: ['Cadeira', 'Amor', 'Água', 'Pedra'],
    correta: 1,
    explicacao: 'Amor é um sentimento, portanto substantivo abstrato. Os demais são concretos.',
  },
  {
    id: 'por_2',
    materia: 'Português',
    enunciado: 'Na frase "Ela chegou cedo", a palavra "cedo"é:',
    alternativas: ['Substantivo', 'Adjetivo', 'Advérbio', 'Preposição'],
    correta: 2,
    explicacao: '"Cedo"modifica o verbo "chegou", indicando tempo. É advérbio de tempo.',
  },
  {
    id: 'por_3',
    materia: 'Português',
    enunciado: 'Qual a função da crase em "Fui à escola"?',
    alternativas: [
      'Indicar plural',
      'Indicar fusão da preposição "a"com o artigo "a"',
      'Indicar ênfase',
      'Indicar gênero feminino',
    ],
    correta: 1,
    explicacao: 'Crase é a fusão da preposição "a"com o artigo feminino "a": a + a = à.',
  },
  {
    id: 'por_4',
    materia: 'Português',
    enunciado: 'Assinale a frase com erro de concordância:',
    alternativas: [
      'Havia muitas pessoas na sala',
      'Existiam muitas pessoas na sala',
      'Fazem três anos que terminei',
      'Choveu muito ontem',
    ],
    correta: 2,
    explicacao:
      '"Fazer"com tempo decorrido é impessoal: "Faz três anos que terminei". O correto seria "Faz três anos".',
  },
  {
    id: 'por_5',
    materia: 'Português',
    enunciado: 'Qual das figuras de linguagem está presente em "O sol dançava no horizonte"?',
    alternativas: ['Metáfora', 'Personificação', 'Hipérbole', 'Eufemismo'],
    correta: 1,
    explicacao:
      'Atribuir ação humana (dançar) a um elemento da natureza (sol) é personificação (prosopopeia).',
  },
  {
    id: 'por_6',
    materia: 'Português',
    enunciado: 'Assinale a alternativa com uso correto de "mal"ou "mau":',
    alternativas: [
      'Ele é um mal aluno',
      'Ele chegou mau-humorado',
      'Não faça mal aos animais',
      'O mal cheiro incomoda',
    ],
    correta: 2,
    explicacao:
      '"Mal"é advérbio ou substantivo (oposto de bem), "mau"é adjetivo (oposto de bom). "Não faça mal"está correto.',
  },
  // Biologia
  {
    id: 'bio_1',
    materia: 'Biologia',
    enunciado: 'Qual organela é responsável pela produção de energia na célula?',
    alternativas: ['Ribossomo', 'Mitocôndria', 'Retículo endoplasmático', 'Complexo de Golgi'],
    correta: 1,
    explicacao: 'A mitocôndria produz ATP através da respiração celular.',
  },
  {
    id: 'bio_2',
    materia: 'Biologia',
    enunciado: 'O DNA tem qual forma estrutural?',
    alternativas: ['Hélice simples', 'Dupla hélice', 'Tripla hélice', 'Quádrupla hélice'],
    correta: 1,
    explicacao: 'O DNA tem estrutura de dupla hélice (descoberta por Watson e Crick).',
  },
  {
    id: 'bio_3',
    materia: 'Biologia',
    enunciado: 'Qual processo é responsável pela produção de glicose nas plantas?',
    alternativas: ['Respiração', 'Fermentação', 'Fotossíntese', 'Quimiossíntese'],
    correta: 2,
    explicacao: 'A fotossíntese usa luz solar, CO₂ e água para produzir glicose e oxigênio.',
  },
  // Física
  {
    id: 'fis_1',
    materia: 'Física',
    enunciado: 'Qual a unidade de medida da força no SI?',
    alternativas: ['Joule', 'Newton', 'Watt', 'Pascal'],
    correta: 1,
    explicacao: 'Força é medida em Newtons (N) no Sistema Internacional. 1 N = 1 kg·m/s².',
  },
  {
    id: 'fis_2',
    materia: 'Física',
    enunciado: 'A lei da inércia pertence a qual cientista?',
    alternativas: ['Einstein', 'Newton', 'Galileu', 'Kepler'],
    correta: 1,
    explicacao: 'A 1ª Lei de Newton (Inércia): um corpo tende a manter seu estado de movimento ou repouso.',
  },
  {
    id: 'fis_3',
    materia: 'Física',
    enunciado: 'Qual grandeza física é medida em Ohms (Ω)?',
    alternativas: ['Corrente elétrica', 'Tensão', 'Resistência', 'Potência'],
    correta: 2,
    explicacao: 'Resistência elétrica é medida em Ohms. Corrente = Ampères, Tensão = Volts.',
  },
  // Química
  {
    id: 'qui_1',
    materia: 'Química',
    enunciado: 'Qual é o número atômico do oxigênio?',
    alternativas: ['6', '8', '10', '16'],
    correta: 1,
    explicacao: 'O oxigênio tem número atômico 8 (8 prótons no núcleo).',
  },
  {
    id: 'qui_2',
    materia: 'Química',
    enunciado: 'Qual o pH de uma substância neutra?',
    alternativas: ['0', '7', '14', '1'],
    correta: 1,
    explicacao: 'pH 7 é neutro. Abaixo de 7 é ácido, acima é básico.',
  },
  {
    id: 'qui_3',
    materia: 'Química',
    enunciado: 'Ligações iônicas ocorrem entre:',
    alternativas: ['Dois metais', 'Metal e ametal', 'Dois ametais', 'Gases nobres'],
    correta: 1,
    explicacao: 'Ligação iônica ocorre entre metal (que doa elétrons) e ametal (que recebe).',
  },
  // História
  {
    id: 'his_1',
    materia: 'História',
    enunciado: 'Em que ano o Brasil declarou sua independência?',
    alternativas: ['1808', '1822', '1889', '1824'],
    correta: 1,
    explicacao: 'Independência do Brasil foi em 7 de setembro de 1822, proclamada por Dom Pedro I.',
  },
  {
    id: 'his_2',
    materia: 'História',
    enunciado: 'A Revolução Francesa começou em que ano?',
    alternativas: ['1776', '1789', '1799', '1804'],
    correta: 1,
    explicacao: 'A Revolução Francesa começou em 1789 com a queda da Bastilha.',
  },
  {
    id: 'his_3',
    materia: 'História',
    enunciado: 'Quem foi o primeiro presidente do Brasil?',
    alternativas: ['Dom Pedro I', 'Deodoro da Fonseca', 'Getúlio Vargas', 'Prudente de Morais'],
    correta: 1,
    explicacao: 'Deodoro da Fonseca foi o primeiro presidente (1889-1891), após a Proclamação da República.',
  },
  // Geografia
  {
    id: 'geo_1',
    materia: 'Geografia',
    enunciado: 'Qual é o maior bioma brasileiro em área?',
    alternativas: ['Mata Atlântica', 'Cerrado', 'Amazônia', 'Caatinga'],
    correta: 2,
    explicacao: 'A Amazônia é o maior bioma brasileiro, ocupando cerca de 49% do território.',
  },
  {
    id: 'geo_2',
    materia: 'Geografia',
    enunciado: 'O que é globalização?',
    alternativas: [
      'Isolamento econômico',
      'Integração econômica e cultural mundial',
      'Aumento de tarifas',
      'Nacionalização de empresas',
    ],
    correta: 1,
    explicacao: 'Globalização é o processo de integração econômica, cultural e tecnológica entre países.',
  },
  {
    id: 'geo_3',
    materia: 'Geografia',
    enunciado: 'Qual o principal gás de efeito estufa liberado pela queima de combustíveis fósseis?',
    alternativas: ['Oxigênio', 'Nitrogênio', 'CO₂ (gás carbônico)', 'Hélio'],
    correta: 2,
    explicacao: 'A queima de combustíveis fósseis libera CO₂, principal gás responsável pelo efeito estufa.',
  },
  // Filosofia
  {
    id: 'fil_1',
    materia: 'Filosofia',
    enunciado: '"Penso, logo existo"é uma frase de qual filósofo?',
    alternativas: ['Sócrates', 'Platão', 'Descartes', 'Nietzsche'],
    correta: 2,
    explicacao: 'René Descartes (1596-1650), filósofo racionalista francês, formulou o "Cogito, ergo sum".',
  },
  {
    id: 'fil_2',
    materia: 'Filosofia',
    enunciado: 'A "Mito da Caverna"é uma alegoria de qual filósofo?',
    alternativas: ['Sócrates', 'Platão', 'Aristóteles', 'Pitágoras'],
    correta: 1,
    explicacao: 'A alegoria da caverna está na obra "A República"de Platão.',
  },
  {
    id: 'fil_3',
    materia: 'Filosofia',
    enunciado: 'Para Aristóteles, a virtude está:',
    alternativas: ['No excesso', 'Na falta', 'No meio-termo', 'Na negação'],
    correta: 2,
    explicacao:
      'Aristóteles defendia o "justo meio"(equilíbrio entre excesso e falta) como caminho para a virtude.',
  },
  // Inglês
  {
    id: 'ing_1',
    materia: 'Inglês',
    enunciado: 'Complete: "She ___ to school every day."',
    alternativas: ['go', 'goes', 'going', 'gone'],
    correta: 1,
    explicacao: '3ª pessoa do singular no Simple Present: She goes.',
  },
  {
    id: 'ing_2',
    materia: 'Inglês',
    enunciado: 'Qual o significado de "Nevertheless"?',
    alternativas: ['No entanto', 'Nunca menos', 'Sempre', 'Talvez'],
    correta: 0,
    explicacao: 'Nevertheless = no entanto, contudo (conectivo de oposição).',
  },
  {
    id: 'ing_3',
    materia: 'Inglês',
    enunciado: 'Qual a forma correta do Past Simple de "to buy"?',
    alternativas: ['Buyed', 'Bought', 'Brought', 'Boughted'],
    correta: 1,
    explicacao: 'Buy bought (verbo irregular).',
  },
  // Redação
  {
    id: 'red_1',
    materia: 'Redação',
    enunciado: 'Quantas competências são avaliadas na redação do ENEM?',
    alternativas: ['3', '4', '5', '6'],
    correta: 2,
    explicacao: 'São 5 competências (0-200 cada, total 0-1000).',
  },
  {
    id: 'red_2',
    materia: 'Redação',
    enunciado: 'Qual o número mínimo de palavras na redação do ENEM?',
    alternativas: ['100', '150', '200', '250'],
    correta: 1,
    explicacao: 'O mínimo exigido é 150 palavras. Abaixo disso a redação é desconsiderada.',
  },
  {
    id: 'red_3',
    materia: 'Redação',
    enunciado: 'O que a competência 5 avalia na redação do ENEM?',
    alternativas: [
      'Domínio da norma culta',
      'Compreensão do tema',
      'Proposta de intervenção',
      'Coesão textual',
    ],
    correta: 2,
    explicacao: 'A Competência 5 avalia a Proposta de Intervenção: agente, ação, meio e finalidade.',
  },
];

export function getQuestionsByMateria(materia: string): QuizQuestion[] {
  return QUIZ_BANK.filter((q) => q.materia === materia);
}

export function getRandomQuestions(materia: string, count: number = 3): QuizQuestion[] {
  const pool = getQuestionsByMateria(materia);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getMaterias(): string[] {
  return [...new Set(QUIZ_BANK.map((q) => q.materia))];
}
