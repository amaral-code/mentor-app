export interface ChallengeSupportText {
  titulo: string;
  texto: string;
}

export interface ChallengeTheme {
  id: string;
  tema: string;
  coletanea: ChallengeSupportText[];
  dica: string;
}

export const CHALLENGE_THEMES: ChallengeTheme[] = [
  {
    id: 'desafio_1',
    tema: 'O estigma associado às doenças mentais na sociedade brasileira',
    coletanea: [
      {
        titulo: 'Texto I: Dados da OMS',
        texto: 'Segundo a Organização Mundial da Saúde (OMS), cerca de 11% da população brasileira sofre de transtornos de ansiedade e depressão. Apesar da alta prevalência, grande parte das pessoas evita buscar ajuda por medo do julgamento social.',
      },
      {
        titulo: 'Texto II: Pensador',
        texto: 'O filósofo Michel Foucault, em "História da Loucura", mostra como as sociedades modernas historicamente isolaram e silenciaram aqueles que consideravam "diferentes", influenciando preconceitos que persistem até hoje.',
      },
      {
        titulo: 'Texto III: Pesquisa',
        texto: 'Pesquisa da USP aponta que 64% dos brasileiros não conversariam abertamente sobre saúde mental em ambiente de trabalho, revelando o quanto o tabu ainda limita o acolhimento e o tratamento.',
      },
    ],
    dica: 'Desenvolva um ponto de vista claro sobre as causas do estigma (falta de informação, cultura de produtividade) e proponha intervenção com agente, ação, meio e finalidade.',
  },
  {
    id: 'desafio_2',
    tema: 'A valorização dos povos e comunidades tradicionais no Brasil',
    coletanea: [
      {
        titulo: 'Texto I: Constituição',
        texto: 'A Constituição Federal de 1988 reconhece o direito dos povos indígenas e comunidades tradicionais às suas terras, culturas e modos de vida, ainda que na prática esses direitos sejam frequentemente desrespeitados.',
      },
      {
        titulo: 'Texto II: Dados',
        texto: 'Segundo o Censo do IBGE, mais de 1,6 milhão de pessoas se reconhecem como indígenas no Brasil, distribuídas em cerca de 300 etnias que falam mais de 270 línguas.',
      },
      {
        titulo: 'Texto III: Reflexão',
        texto: 'O sociólogo Darcy Ribeiro defendia que a identidade brasileira é resultado do encontro de matrizes indígenas, africanas e europeias, e que desvalorizar esses povos é negar parte da nossa própria história.',
      },
    ],
    dica: 'Articule os textos com um repertório externo (dados, legislação, autores) e termine com proposta de intervenção respeitosa e concreta.',
  },
  {
    id: 'desafio_3',
    tema: 'Os impactos do uso excessivo das redes sociais na saúde e na sociabilidade',
    coletanea: [
      {
        titulo: 'Texto I: Dados',
        texto: 'O Brasil é um dos países com maior tempo de uso de redes sociais no mundo: em média, os brasileiros passam mais de 3 horas e meia por dia conectados, segundo a consultoria DataReportal.',
      },
      {
        titulo: 'Texto II: Pesquisa',
        texto: 'Estudo da Universidade Federal de São Paulo (Unifesp) associou o uso intenso de telas ao aumento de sintomas de ansiedade, depressão e dificuldades de sono em jovens.',
      },
      {
        titulo: 'Texto III: Pensador',
        texto: 'O sociólogo Zygmunt Bauman, com o conceito de "modernidade líquida", aponta que as relações contemporâneas se tornaram frágeis e descartáveis, fenômeno intensificado pela cultura digital.',
      },
    ],
    dica: 'Explore a tensão entre conectividade e isolamento, use dados dos textos como repertório e proponha educação digital e regulação como caminhos.',
  },
  {
    id: 'desafio_4',
    tema: 'A democratização do acesso à cultura no Brasil',
    coletanea: [
      {
        titulo: 'Texto I: Dados',
        texto: 'A pesquisa "Retratos da Leitura no Brasil" mostra que cerca de metade da população brasileira não lê regularmente, e o acesso a cinemas, teatros e museus se concentra nas grandes capitais.',
      },
      {
        titulo: 'Texto II: Legislação',
        texto: 'O artigo 215 da Constituição Federal garante a todos o pleno exercício dos direitos culturais, determinando ao Estado o apoio e incentivo à valorização e difusão das manifestações culturais.',
      },
      {
        titulo: 'Texto III: Pensador',
        texto: 'O educador Paulo Freire defendia que a cultura é uma dimensão fundamental da formação do ser humano e que o acesso à arte é uma forma de conscientização e libertação.',
      },
    ],
    dica: 'Relacione cultura e cidadania, cite os textos de apoio e apresente intervenção com meios viáveis de ampliação do acesso.',
  },
  {
    id: 'desafio_5',
    tema: 'Os desafios para a valorização da profissão docente no Brasil',
    coletanea: [
      {
        titulo: 'Texto I: Dados',
        texto: 'Segundo dados da OCDE, o salário inicial de professores no Brasil é um dos mais baixos entre os países avaliados, e a carreira docente atrai cada vez menos jovens.',
      },
      {
        titulo: 'Texto II: Pesquisa',
        texto: 'Pesquisa do Instituto Península revelou que mais da metade dos professores brasileiros considera abandonar a profissão, citando baixa remuneração, sobrecarga e falta de reconhecimento.',
      },
      {
        titulo: 'Texto III: Pensador',
        texto: 'O educador Anísio Teixeira defendia a valorização do magistério como condição essencial para a qualidade da educação pública e para o desenvolvimento nacional.',
      },
    ],
    dica: 'Conecte a valorização docente à qualidade da educação, use os dados como repertório e proponha medidas com agente, ação e finalidade.',
  },
  {
    id: 'desafio_6',
    tema: 'O desafio de combater a desigualdade de gênero no mercado de trabalho brasileiro',
    coletanea: [
      {
        titulo: 'Texto I: Dados',
        texto: 'Dados do IBGE mostram que as mulheres ganham, em média, cerca de 20% menos que os homens para funções equivalentes e ocupam menos de 40% dos cargos de liderança nas empresas.',
      },
      {
        titulo: 'Texto II: Pesquisa',
        texto: 'Pesquisa da FGV aponta que a divisão desigual das tarefas domésticas e de cuidado é um dos principais obstáculos para a permanência e ascensão das mulheres no trabalho.',
      },
      {
        titulo: 'Texto III: Pensador',
        texto: 'A filósofa Simone de Beauvoir, em "O Segundo Sexo", analisa como construções sociais atribuem papéis distintos a homens e mulheres, influenciando desigualdades que atravessam a vida profissional.',
      },
    ],
    dica: 'Apresente as causas estruturais da desigualdade, integre os textos de apoio e construa proposta de intervenção múltipla e coerente.',
  },
  {
    id: 'desafio_7',
    tema: 'A preservação e valorização das línguas indígenas no Brasil',
    coletanea: [
      {
        titulo: 'Texto I: Dados',
        texto: 'O Brasil possui mais de 270 línguas indígenas faladas, mas pesquisadores estimam que muitas delas correm risco de extinção nas próximas décadas por falta de registro e transmissão.',
      },
      {
        titulo: 'Texto II: Legislação',
        texto: 'A Constituição Federal reconhece o direito dos povos indígenas à sua identidade, cultura e formas de organização social, incluindo a proteção de suas línguas como patrimônio cultural.',
      },
      {
        titulo: 'Texto III: Pesquisa',
        texto: 'Estudos da Universidade de Brasília mostram que o ensino bilíngue em escolas indígenas fortalece a autoestima das comunidades e contribui para a preservação do idioma materno.',
      },
    ],
    dica: 'Trate a língua como patrimônio cultural, articule os textos e proponha políticas de registro, ensino e valorização com agentes claros.',
  },
  {
    id: 'desafio_8',
    tema: 'A importância do repertório sociocultural na formação do estudante',
    coletanea: [
      {
        titulo: 'Texto I: Pensador',
        texto: 'O sociólogo Pierre Bourdieu desenvolveu o conceito de "capital cultural", mostrando que o acesso a livros, arte e conhecimento desde cedo influencia diretamente o desempenho escolar e social.',
      },
      {
        titulo: 'Texto II: Dados',
        texto: 'A pesquisa "Juventudes e Leitura" indica que estudantes que convivem com livros e frequentam bibliotecas e espaços culturais apresentam melhor desempenho em provas como o ENEM.',
      },
      {
        titulo: 'Texto III: Reflexão',
        texto: 'No ENEM, a redação que cita autores, obras, filmes e dados reais de forma pertinente alcança notas mais altas na competência 3, que avalia a seleção de repertórios socioculturais produtivos.',
      },
    ],
    dica: 'Defenda a leitura e a cultura como base da argumentação, cite os conceitos dos textos e encerre com proposta de intervenção.',
  },
];

export function getRandomTheme(): ChallengeTheme {
  const index = Math.floor(Math.random() * CHALLENGE_THEMES.length);
  return CHALLENGE_THEMES[index];
}
