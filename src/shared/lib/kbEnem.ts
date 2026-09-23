import { KBEntry } from '../types';

export const ENEM_KB: KBEntry[] = [
  // === ENEM Geral ===
  {
    id: 'enem_1',
    keywords: ['enem', 'o que', 'como funciona', 'exame', 'prova'],
    content:
      'O ENEM (Exame Nacional do Ensino Médio) é a maior porta de entrada para o ensino superior no Brasil. São 4 provas objetivas com 45 questões cada: 1) Linguagens, Códigos e suas Tecnologias, 2) Matemática e suas Tecnologias, 3) Ciências Humanas e suas Tecnologias, 4) Ciências da Natureza e suas Tecnologias. Além da Redação dissertativa-argumentativa. A nota pode ser usada no SISU, PROUNI e FIES.',
    source: 'faq',
  },
  {
    id: 'enem_2',
    keywords: ['tri', 'nota', 'como calcula', 'teoria resposta'],
    content:
      'A TRI (Teoria de Resposta ao Item) é o sistema de pontuação do ENEM. Diferente de provas comuns onde cada questão vale o mesmo peso, na TRI: questões fáceis têm peso menor, questões difíceis têm peso maior. Manter um padrão coerente de acertos valoriza mais sua nota do que acertar questões difíceis e errar fáceis. Nunca chute aleatoriamente: se for chutar, elimine alternativas primeiro.',
    source: 'faq',
  },
  {
    id: 'enem_3',
    keywords: ['sisu', 'prouni', 'fies', 'nota corte', 'universidade'],
    content:
      'Com a nota do ENEM você pode: SISU (vagas em universidades públicas), PROUNI (bolsas de estudo em faculdades particulares: integrais ou parciais), FIES (financiamento estudantil). Cada curso tem uma nota de corte que varia conforme a concorrência anual. Medicina costuma ter as maiores notas (780+), enquanto licenciaturas podem ter notas mais baixas.',
    source: 'faq',
  },
  {
    id: 'enem_4',
    keywords: ['inscricao', 'quando', 'data', 'prova', 'calendario'],
    content:
      'O ENEM geralmente acontece em dois domingos consecutivos no mês de novembro. As inscrições abrem entre maio e junho. Fique atento ao site oficial do INEP. A taxa de inscrição pode ser isenta para alunos de escola pública ou baixa renda.',
    source: 'faq',
  },
  {
    id: 'enem_5',
    keywords: ['estudar', 'rotina', 'como estudar', 'plano', 'organizar'],
    content:
      'Rotina de estudos eficiente para o ENEM: 1) Estude por disciplina em vez de por assunto, 2) Use a técnica Pomodoro (25 min foco / 5 min pausa), 3) Alterne entre exatas e humanas para não cansar, 4) Revise o conteúdo em até 24 horas (curva do esquecimento de Ebbinghaus), 5) Faça pelo menos 10 questões por dia, 6) Simulado completo uma vez por mês. Consistência > Intensidade.',
    source: 'faq',
  },
  {
    id: 'enem_6',
    keywords: ['simulado', 'treinar', 'prova anterior', 'questao'],
    content:
      'Fazer simulados é essencial! O INEP disponibiliza todas as provas anteriores gratuitamente no site oficial. Resolva as provas dos últimos 5 anos pelo menos. Cronometre o tempo: 3h por dia de prova (exceto redação que tem 5h30 no total). Simule as condições reais: sem celular, sem consulta.',
    source: 'faq',
  },
  {
    id: 'enem_7',
    keywords: ['dica', 'ultima semana', 'vespera', 'antes da prova'],
    content:
      'Na véspera do ENEM: 1) Não estude conteúdo novo, 2) Reveja apenas resumos e fórmulas, 3) Separe documentos (RG, CPF), caneta preta transparente, água e lanche, 4) Durma bem (7-8h), 5) Chegue com antecedência ao local. Durante a prova: comece pelas questões mais fáceis, marque o gabarito com calma ao final.',
    source: 'faq',
  },
  {
    id: 'enem_8',
    keywords: ['redacao', 'nota 1000', 'competencias', 'correcao'],
    content:
      'A redação do ENEM vale 0-1000 pontos, divididos em 5 competências de 200 cada: C1) Domínio da norma culta (desvios gramaticais zeram), C2) Compreensão do tema (fuja de modelos prontos), C3) Seleção de informações (repertório sociocultural legítimo), C4) Coesão textual (uso correto de conectivos), C5) Proposta de intervenção (agente + ação + meio + finalidade + detalhamento). Estrutura: introdução (tese + repertório), desenvolvimento 1 (argumento 1), desenvolvimento 2 (argumento 2), conclusão (proposta de intervenção).',
    source: 'faq',
  },
  {
    id: 'enem_9',
    keywords: ['repertorio', 'citacao', 'filósofo', 'autor', 'referencia'],
    content:
      'Repertórios coringas para a redação ENEM: Constituição Federal de 1988 (cidadania e direitos), Declaração Universal dos Direitos Humanos (dignidade), Estatuto da Criança e do Adolescente (infância e educação), obras de Machado de Assis (sociedade brasileira), Milton Santos (globalização), Paulo Freire (educação), Hannah Arendt (banalidade do mal), Zygmunt Bauman (modernidade líquida). Sempre relacione o repertório ao tema proposto.',
    source: 'faq',
  },
  {
    id: 'enem_10',
    keywords: ['conectivo', 'coesao', 'argumentacao', 'texto'],
    content:
      'Conectivos essenciais para redação: Adição (além disso, ademais, outrossim), Oposição (contudo, todavia, entretanto, porém), Conclusão (portanto, assim, dessa forma, desse modo), Causa (porque, uma vez que, já que), Consequência (de modo que, em virtude de), Exemplificação (por exemplo, como, a exemplo de). Use conectivos variados para demonstrar domínio da C4.',
    source: 'faq',
  },

  // === Matemática ===
  {
    id: 'mat_100',
    keywords: ['matematica', 'formula', 'calculo', 'equacao'],
    content:
      'Matemática no ENEM: as áreas mais cobradas são 1) Razão e Proporção (regra de três, porcentagem, escalas), 2) Funções (1º e 2º grau, análise de gráficos), 3) Geometria (plana, espacial, analítica), 4) Estatística (média, moda, mediana, desvio), 5) Probabilidade (eventos independentes e dependentes), 6) Análise de gráficos e tabelas. Fórmulas essenciais: Área do círculo = πr², Teorema de Pitágoras = a² + b² = c², Volume do cubo = a³, Média aritmética = soma/n.',
    source: 'faq',
  },
  {
    id: 'mat_101',
    keywords: ['porcentagem', 'percentual', 'desconto', 'acrescimo', 'juros'],
    content:
      'Porcentagem no ENEM: aumento = valor × (1 + taxa), desconto = valor × (1 - taxa). Exemplo: produto de R$200 com 15% de desconto = 200 × 0,85 = R$170. Juros simples: J = C × i × t. Juros compostos: M = C × (1+i)^t. Questões de porcentagem aparecem em praticamente todas as provas.',
    source: 'faq',
  },
  {
    id: 'mat_102',
    keywords: ['geometria', 'area', 'volume', 'perimetro', 'forma'],
    content:
      'Geometria no ENEM: foque em áreas e volumes de figuras básicas. Fórmulas essenciais: Quadrado (A = l²), Retângulo (A = b×h), Triângulo (A = b×h/2), Círculo (A = πr²), Cilindro (V = πr²h), Cone (V = πr²h/3), Esfera (V = 4πr³/3). Interpretação de figuras geométricas em contextos reais é muito comum.',
    source: 'faq',
  },
  {
    id: 'mat_103',
    keywords: ['funcao', 'grafico', 'linear', 'quadratica', 'exponencial'],
    content:
      'Funções no ENEM: função afim (f(x)=ax+b, gráfico é reta), função quadrática (f(x)=ax²+bx+c, gráfico é parábola), função exponencial (f(x)=a^x, crescimento/decrescimento rápido). Saiba interpretar gráficos: donde a reta cruza o eixo y (termo independente), onde cruza o eixo x (raízes), vértice da parábola (x_v = -b/2a, y_v = -Δ/4a).',
    source: 'faq',
  },
  {
    id: 'mat_104',
    keywords: ['estatistica', 'media', 'moda', 'mediana', 'desvio'],
    content:
      'Estatística básica para o ENEM: Média aritmética (soma dos valores ÷ quantidade), Mediana (valor central após ordenar), Moda (valor que mais se repete). Amplitude (maior: menor). Questões de interpretação de gráficos (barras, pizza, linhas) são frequentíssimas. Saiba também ler tabelas e extrair informações.',
    source: 'faq',
  },
  {
    id: 'mat_105',
    keywords: ['probabilidade', 'chance', 'sorteio', 'evento'],
    content:
      'Probabilidade: P = (eventos favoráveis)/(eventos possíveis). Exemplo: chance de tirar um ás em um baralho = 4/52 = 1/13. Eventos independentes: P(A e B) = P(A) × P(B). Eventos mutuamente exclusivos: P(A ou B) = P(A) + P(B). No ENEM, probabilidade aparece contextualizada (sorteios, pesquisas, genética).',
    source: 'faq',
  },
  {
    id: 'mat_106',
    keywords: ['razao', 'proporcao', 'regra tres', 'escala'],
    content:
      'Razão e proporção: Regra de três simples: se 3 kg custam R$15, quanto custam 7 kg? 3/15 = 7/x 3x = 105 x = 35. Escala: 1:100.000 significa que 1cm no mapa = 1km real. Porcentagem de porcentagem: 20% de 30% = 0,2 × 0,3 = 0,06 = 6%.',
    source: 'faq',
  },
  {
    id: 'mat_107',
    keywords: ['logica', 'sequencia', 'padrao', 'raciocinio'],
    content:
      'Raciocínio lógico: sequências numéricas (PA, PG, Fibonacci), padrões de figuras, proposições lógicas (se...então, ou, e, não). PA: a_n = a₁ + (n-1)×r. PG: a_n = a₁ × q^(n-1). Soma PA: S = (a₁ + a_n)×n/2. Soma PG infinita (q<1): S = a₁/(1-q).',
    source: 'faq',
  },
  {
    id: 'mat_108',
    keywords: ['trigonometria', 'seno', 'cosseno', 'tangente', 'angulo'],
    content:
      'Trigonometria básica: seno = cateto oposto/hipotenusa, cosseno = cateto adjacente/hipotenusa, tangente = cateto oposto/cateto adjacente. Ângulos notáveis: 30° (sen=1/2, cos=√3/2), 45° (sen=cos=√2/2), 60° (sen=√3/2, cos=1/2). Lei dos Senos e Cossenos para triângulos quaisquer.',
    source: 'faq',
  },

  // === Português ===
  {
    id: 'por_100',
    keywords: ['gramatica', 'ortografia', 'acentuacao', 'grafia'],
    content:
      'Gramática no ENEM: foque em 1) Acentuação (regras básicas, hiatos, ditongos), 2) Ortografia (mal/mau, mas/mais, há/a, sessão/seção/cessão), 3) Concordância verbal e nominal (regra geral e casos especiais), 4) Regência verbal e nominal (incluindo crase), 5) Colocação pronominal (próclise, ênclise, mesóclise). O ENEM cobra gramática contextualizada, nunca isolada.',
    source: 'faq',
  },
  {
    id: 'por_101',
    keywords: ['crase', 'preposicao', 'artigo', 'fusao', 'acento grave'],
    content:
      'Crase (à) = preposição "a"+ artigo "a". Regras práticas: Use crase antes de palavras femininas (à escola, à mesa). Não use: antes de verbos (a partir), antes de palavras masculinas (a cavalo), antes de pronomes (a ela), expressões repetidas (cara a cara). Dica: troque por "ao"- se fizer sentido, tem crase. Ex: "Vou a/à praia""Vou ao mar"tem crase: "Vou à praia".',
    source: 'faq',
  },
  {
    id: 'por_102',
    keywords: ['concordancia', 'verbal', 'nominal', 'plural', 'flexao'],
    content:
      'Concordância verbal: o verbo concorda com o sujeito em número e pessoa. "Os alunos estudam"(sujeito plural, verbo plural). Casos especiais: "Mais de um aluno faltou"(singular), "Nem um nem outro faltou/faltaram"(ambos possíveis), "Havia muitas pessoas"(haver impessoal = singular). Concordância nominal: adjetivo concorda com o substantivo. "Ela é boa aluna", "Eles são bons alunos".',
    source: 'faq',
  },
  {
    id: 'por_103',
    keywords: ['literatura', 'escola literaria', 'brasileira', 'autor', 'modernismo', 'romantismo'],
    content:
      'Literatura brasileira no ENEM: principais escolas: Quinhentismo (informação), Barroco (Gregório de Matos, Padre Vieira), Arcadismo (Cláudio Manuel da Costa, Tomás Antônio Gonzaga), Romantismo (José de Alencar, Álvares de Azevedo, Castro Alves), Realismo/Naturalismo (Machado de Assis, Aluísio Azevedo), Parnasianismo (Olavo Bilac), Simbolismo (Cruz e Sousa), Pré-Modernismo (Euclides da Cunha, Lima Barreto), Modernismo (Mário de Andrade, Oswald de Andrade, Carlos Drummond de Andrade, Guimarães Rosa, Clarice Lispector).',
    source: 'faq',
  },
  {
    id: 'por_104',
    keywords: ['interpretacao', 'texto', 'leitura', 'compreensao'],
    content:
      'Interpretação de texto no ENEM: leia o enunciado primeiro, depois o texto. Identifique: ideia central, ponto de vista do autor, relações de causa e efeito, figuras de linguagem (metáfora, antítese, ironia). Questões de linguagens frequentemente exigem relacionar texto verbal com não-verbal (charges, tirinhas, gráficos, pinturas).',
    source: 'faq',
  },
  {
    id: 'por_105',
    keywords: ['figura linguagem', 'metafora', 'ironia', 'personificacao', 'pleonasmo'],
    content:
      'Figuras de linguagem mais cobradas: Metáfora (comparação implícita: "seus olhos são faróis"), Comparação ou Símile (com "como"), Personificação/Prosopopeia (atribuir ação humana a ser inanimado), Antítese (oposição de ideias), Paradoxo (ideias contraditórias), Hipérbole (exagero), Eufemismo (suavizar), Ironia (dizer o contrário), Pleonasmo (repetição para ênfase), Aliteração (repetição de sons consonantais), Assonância (repetição de sons vocálicos).',
    source: 'faq',
  },
  {
    id: 'por_106',
    keywords: ['preposicao', 'conjuncao', 'conectivo', 'conectivo'],
    content:
      'Conectivos e preposições: Preposições essenciais (a, ante, após, até, com, contra, de, desde, em, entre, para, perante, por, sem, sob, sobre, trás). Locuções prepositivas (abaixo de, acerca de, além de, apesar de, através de, diante de, em vez de, perto de). Conjunções coordenativas (e, mas, ou, logo, pois) e subordinativas (que, se, porque, embora, conquanto, caso).',
    source: 'faq',
  },
  {
    id: 'por_107',
    keywords: ['voz ativa', 'voz passiva', 'agente', 'paciente', 'verbos'],
    content:
      'Vozes verbais: Voz ativa (sujeito pratica a ação: "O aluno leu o livro"), Voz passiva analítica (sujeito recebe a ação: "O livro foi lido pelo aluno"), Voz passiva sintética (com pronome "se"- "Leu-se o livro"). Transformação: ativa passiva: objeto direto vira sujeito, verbo "ser"+ particípio, sujeito vira agente da passiva.',
    source: 'faq',
  },

  // === História ===
  {
    id: 'his_100',
    keywords: ['historia', 'brasil', 'colonia', 'imperio', 'republica'],
    content:
      'História do Brasil no ENEM: Periodização: 1) Brasil Colônia (1500-1822): capitanias hereditárias, economia açucareira, mineração, entrada da corte portuguesa (1808), 2) Império (1822-1889): Primeiro Reinado, Período Regencial, Segundo Reinado (café, abolição, imigração), 3) República (1889-hoje): República Velha (café com leite), Era Vargas, Populismo (1945-64), Ditadura Militar (1964-85), Nova República (1985-hoje).',
    source: 'faq',
  },
  {
    id: 'his_101',
    keywords: ['independencia', 'brasil', 'dom pedro', '1822', '7 setembro'],
    content:
      '🇧🇷 Independência do Brasil (7/9/1822): Dom Pedro I proclamou às margens do Ipiranga. Contexto: volta da família real a Portugal (1821), Dia do Fico (9/1/1822), ruptura gradual. O Brasil manteve monarquia e estrutura social escravista: independência conservadora, diferente das repúblicas vizinhas.',
    source: 'faq',
  },
  {
    id: 'his_102',
    keywords: ['escravidao', 'abolicao', 'lei aurea', 'negro', 'escravo'],
    content:
      'Escravidão e Abolição no Brasil: mais de 300 anos de escravidão (1550-1888). Leis abolicionistas: Lei Eusébio de Queirós (1850: fim do tráfico), Lei do Ventre Livre (1871), Lei dos Sexagenários (1885), Lei Áurea (13/5/1888: assinada pela Princesa Isabel). A abolição não veio acompanhada de políticas de inclusão dos ex-escravizados, gerando desigualdade estrutural até hoje.',
    source: 'faq',
  },
  {
    id: 'his_103',
    keywords: ['guerra', 'mundial', 'primeira', 'segunda', '1914', '1939'],
    content:
      'Grandes Guerras no ENEM: 1ª Guerra Mundial (1914-1918): causas (imperialismo, rivalidades, assassinato de Franz Ferdinand), trincheiras, entrada dos EUA, Tratado de Versalhes. 2ª Guerra Mundial (1939-1945): nazifascismo, Holocausto, Pearl Harbor, bomba atômica, criação da ONU. Brasil: participou com a FEB (Força Expedicionária Brasileira) na Itália.',
    source: 'faq',
  },
  {
    id: 'his_104',
    keywords: ['vargas', 'era vargas', 'getulio', 'estado novo'],
    content:
      'Era Vargas (1930-1945): Governo Provisório (1930-34), Governo Constitucional (1934-37), Estado Novo (1937-45: ditadura). Realizações: CLT, Justiça do Trabalho, Petrobras, indústria de base. Populismo e aproximação com trabalhadores. Queda: fim da ditadura, redemocratização em 1945.',
    source: 'faq',
  },
  {
    id: 'his_105',
    keywords: ['ditadura', 'militar', '1964', 'golpe', 'regime'],
    content:
      'Ditadura Militar (1964-1985): Golpe de 31/3/1964 contra João Goulart. Atos Institucionais (AI-5 em 1968: o mais duro), censura, repressão, desaparecidos políticos, milagre econômico (1968-73), crise do petróleo (1973), abertura lenta e gradual (Geisel, Figueiredo), Diretas Já (1984), redemocratização em 1985.',
    source: 'faq',
  },
  {
    id: 'his_106',
    keywords: ['revolucao', 'francesa', '1789', 'iluminismo', 'liberdade'],
    content:
      '🇫🇷 Revolução Francesa (1789-1799): causas (desigualdade, iluminismo, crise financeira), Queda da Bastilha (14/7/1789), Assembleia Nacional, Declaração dos Direitos do Homem e do Cidadão, Robespierre e o Terror, Diretório, golpe de Napoleão (1799). Influenciou movimentos no mundo inteiro.',
    source: 'faq',
  },
  {
    id: 'his_107',
    keywords: ['nazismo', 'fascismo', 'hitler', 'holocausto', 'totalitarismo'],
    content:
      'Nazifascismo: Fascismo italiano (Mussolini, 1922), Nazismo alemão (Hitler, 1933). Características: nacionalismo extremo, culto ao líder, antissemitismo, militarismo, anticomunismo. Holocausto: assassinato sistemático de 6 milhões de judeus. Nazismo na Alemanha: crise de 1929, propaganda, queima de livros, expansionismo (início da 2ª Guerra).',
    source: 'faq',
  },

  // === Geografia ===
  {
    id: 'geo_100',
    keywords: ['geografia', 'clima', 'relevo', 'vegetacao', 'bioma'],
    content:
      "Geografia física no ENEM: Climas do Brasil (Equatorial, Tropical, Semiárido, Tropical de Altitude, Subtropical), Relevo (planícies, planaltos, depressões), Biomas (Amazônia: maior, Cerrado: 2º maior, Caatinga: exclusivo do Brasil, Mata Atlântica: mais desmatado, Pantanal: menor, Pampa). Domínios morfoclimáticos (Ab'Sáber): Amazônico, Cerrado, Mares de Morros, Caatinga, Araucárias, Pradarias.",
    source: 'faq',
  },
  {
    id: 'geo_101',
    keywords: ['globalizacao', 'mundializacao', 'economia', 'mundo', 'internacional'],
    content:
      'Globalização: processo de integração econômica, cultural e tecnológica entre países. Características: aumento do comércio internacional, circulação de capitais, avanço das comunicações, formação de blocos econômicos (Mercosul, União Europeia, NAFTA/USMCA), multinacionais, fragmentação da produção. Críticas: desigualdade entre países, homogeneização cultural, precarização do trabalho.',
    source: 'faq',
  },
  {
    id: 'geo_102',
    keywords: ['meio ambiente', 'sustentabilidade', 'aquecimento', 'mudanca climatica', 'efeito estufa'],
    content:
      'Meio ambiente no ENEM: Efeito estufa (CO₂, CH₄, aquecimento global), desmatamento (Amazônia, Cerrado), recursos hídricos (escassez, conflitos), energias renováveis (solar, eólica, biomassa), não renováveis (petróleo, carvão, gás). Desenvolvimento sustentável: conciliar crescimento econômico com preservação ambiental e justiça social.',
    source: 'faq',
  },
  {
    id: 'geo_103',
    keywords: ['populacao', 'demografia', 'censo', 'crescimento', 'migracao'],
    content:
      'Demografia brasileira: transição demográfica (queda da natalidade e mortalidade), envelhecimento populacional, distribuição desigual (concentração no Sudeste e litoral), migrações internas (Nordeste Sudeste, recentemente movimento inverso), urbanização acelerada (83% da população vive em cidades), problemas urbanos (mobilidade, habitação, violência, segregação).',
    source: 'faq',
  },
  {
    id: 'geo_104',
    keywords: ['agropecuaria', 'agronegocio', 'agricultura', 'reforma agraria', 'campo'],
    content:
      'Geografia agrária: agricultura familiar (70% dos alimentos que chegam à mesa) vs agronegócio (exportação: soja, milho, café, carnes). Revolução Verde (1960s: mecanização, insumos químicos), transgênicos, conflitos pela terra (MST, grilagem), reforma agrária. Fronteira agrícola: expansão sobre o Cerrado e Amazônia.',
    source: 'faq',
  },
  {
    id: 'geo_105',
    keywords: ['urbano', 'cidade', 'urbanizacao', 'metropole', 'reforma urbana'],
    content:
      'Urbanização brasileira: acelerada e desigual (1950-2000). Problemas: conurbação (formação de regiões metropolitanas), segregação socioespacial (periferias x condomínios fechados), mobilidade urbana (engarrafamentos, transporte público precário), ilhas de calor, impermeabilização do solo (enchentes). Estatuto da Cidade (2001): função social da propriedade.',
    source: 'faq',
  },
  {
    id: 'geo_106',
    keywords: ['industria', 'industrializacao', 'fabrica', 'producao'],
    content:
      'Industrialização brasileira: substituição de importações (1930s), Plano de Metas (JK: 1956), milagre econômico (1968-73), desconcentração industrial (1970s: saída do Sudeste para outras regiões). Revoluções Industriais: 1ª (máquina a vapor, carvão), 2ª (eletricidade, petróleo, linha de montagem), 3ª (automação, informática), 4ª (inteligência artificial, internet das coisas).',
    source: 'faq',
  },
  {
    id: 'geo_107',
    keywords: ['cartografia', 'mapa', 'coordenada', 'projecao', 'escala'],
    content:
      'Cartografia: escala (relação entre mapa e realidade: 1:100.000 = 1cm = 1km), coordenadas geográficas (latitude/longitude), projeções cartográficas (Mercator: distorce áreas, Peters: distorce formas), fusos horários (Brasil tem 4 fusos), orientação (rosa dos ventos, GPS). Saber ler mapas temáticos (relevo, clima, população, economia).',
    source: 'faq',
  },

  // === Biologia ===
  {
    id: 'bio_100',
    keywords: ['biologia', 'celula', 'organela', 'dna', 'rna'],
    content:
      'Biologia celular no ENEM: Célula animal x vegetal (parede celular, cloroplastos, vacúolo central). Organelas: mitocôndria (respiração celular: produção de ATP), ribossomo (síntese de proteínas), retículo endoplasmático (transporte), complexo de Golgi (secreção), lisossomo (digestão celular). Núcleo: DNA (dupla hélice), RNA (fita simples), transcrição (DNA RNA), tradução (RNA proteína). Cromossomos, genes, alelos.',
    source: 'faq',
  },
  {
    id: 'bio_101',
    keywords: ['genetica', 'hereditariedade', 'lei mendel', 'cruzamento', 'gene'],
    content:
      'Genética no ENEM: Leis de Mendel: 1ª Lei (segregação dos fatores: cada característica é determinada por 2 fatores que se separam na formação dos gametas), 2ª Lei (segregação independente: para 2 ou mais características). Cruzamentos: AA x aa 100% Aa (heterozigoto). Probabilidade genética: ferramenta de cálculo. Heredogramas: análise de árvores genealógicas para identificar padrões (dominante, recessivo, ligado ao sexo).',
    source: 'faq',
  },
  {
    id: 'bio_102',
    keywords: ['ecologia', 'ecossistema', 'cadeia alimentar', 'biosfera', 'habitat'],
    content:
      'Ecologia no ENEM: Níveis de organização (indivíduo população comunidade ecossistema biosfera), cadeia alimentar (produtores consumidores decompositores), fluxo de energia (10% passa de um nível para outro), ciclo biogeoquímicos (carbono, nitrogênio, água), relações ecológicas (mutualismo, comensalismo, parasitismo, predação, competição), biomas, sucessão ecológica, desequilíbrios ambientais.',
    source: 'faq',
  },
  {
    id: 'bio_103',
    keywords: ['fisiologia', 'corpo humano', 'sistema', 'orgao', 'funcao'],
    content:
      'Fisiologia humana no ENEM: Sistema digestório (boca estômago intestino), respiratório (nariz traqueia brônquios alvéolos), circulatório (coração artérias veias capilares), nervoso (SNC + SNP, sinapses, neurotransmissores), endócrino (hormônios: insulina, adrenalina, hormônios sexuais), excretor (rins, néfrons, urina), reprodutor (gametas, fecundação, métodos contraceptivos, ISTs).',
    source: 'faq',
  },
  {
    id: 'bio_104',
    keywords: ['evolucao', 'darwin', 'selecao natural', 'especie', 'adaptacao'],
    content:
      'Evolução: Teoria de Darwin (seleção natural: organismos mais adaptados ao ambiente sobrevivem e se reproduzem), evidências evolutivas (fósseis, órgãos homólogos, DNA), especiação (formação de novas espécies: isolamento geográfico, isolamento reprodutivo). Teoria sintética da evolução (neodarwinismo): mutação + recombinação + seleção natural. Lamarckismo: uso e desuso + herança de características adquiridas (ultrapassado).',
    source: 'faq',
  },
  {
    id: 'bio_105',
    keywords: ['fotossintese', 'respiração', 'planta', 'clorofila', 'energia'],
    content:
      'Fotossíntese: 6CO₂ + 6H₂O C₆H₁₂O₆ + 6O₂ (com luz e clorofila). Etapa clara (fase luminosa: tilacoides) e etapa escura (ciclo de Calvin: estroma). Respiração celular: C₆H₁₂O₆ + 6O₂ 6CO₂ + 6H₂O + ATP (glicólise, ciclo de Krebs, cadeia respiratória). Fotossíntese x Respiração: processos opostos e complementares.',
    source: 'faq',
  },
  {
    id: 'bio_106',
    keywords: ['virus', 'bacteria', 'fungo', 'protozoario', 'doenca'],
    content:
      'Microbiologia no ENEM: Vírus (acelulares, parasitas intracelulares: COVID, HIV, dengue, gripe), Bactérias (procariontes: tuberculose, meningite, cárie, tétano), Fungos (eucariontes: micose, candidíase), Protozoários (eucariontes: malária, doença de Chagas, giardíase, toxoplasmose). Importante saber: agente causador, transmissão, sintomas, prevenção. Vacinas (imunização ativa) x Soros (imunização passiva).',
    source: 'faq',
  },
  {
    id: 'bio_107',
    keywords: ['ist', 'sexual', 'doenca', 'aids', 'hiv', 'hpv'],
    content:
      'ISTs mais cobradas: HIV/AIDS (vírus, ataca linfócitos T CD4, transmissão: sexual/sanguínea/vertical, prevenção: camisinha, tratamento: antirretrovirais), HPV (vírus, verrugas genitais, câncer de colo de útero, prevenção: vacina + camisinha), Sífilis (bactéria, fases primária/secundária/terciária, cura: penicilina), Gonorreia (bactéria, secreção purulenta, cura: antibióticos).',
    source: 'faq',
  },

  // === Física ===
  {
    id: 'fis_100',
    keywords: ['fisica', 'mecanica', 'movimento', 'forca', 'energia'],
    content:
      'Física no ENEM: Mecânica é o tópico mais cobrado. Leis de Newton: 1ª (Inércia: corpo tende a manter estado), 2ª (F = m×a: força resultante = massa × aceleração), 3ª (Ação e Reação: forças em pares). Energia: cinética (Ec = mv²/2), potencial gravitacional (Epg = mgh), potencial elástica (Epe = kx²/2). Conservação de energia: E_total inicial = E_total final (sistema isolado).',
    source: 'faq',
  },
  {
    id: 'fis_101',
    keywords: ['termologia', 'calor', 'temperatura', 'dilatacao', 'escala'],
    content:
      'Termologia: calor (energia em trânsito entre corpos com diferença de temperatura), temperatura (medida de agitação molecular). Escalas: Celsius, Fahrenheit, Kelvin (TK = TC + 273). Dilatação: linear (ΔL = L₀×α×ΔT), superficial (ΔA = A₀×β×ΔT), volumétrica (ΔV = V₀×γ×ΔT). Transmissão de calor: condução (sólidos), convecção (fluidos), radiação (ondas eletromagnéticas).',
    source: 'faq',
  },
  {
    id: 'fis_102',
    keywords: ['ondulatoria', 'onda', 'som', 'luz', 'frequencia', 'comprimento'],
    content:
      'Ondulatória: ondas mecânicas (precisam de meio: som) x eletromagnéticas (não precisam: luz). Características: amplitude, frequência (f), comprimento de onda (λ), velocidade (v = λ×f). Reflexão (eco, espelho), Refração (mudança de meio: arco-íris, lápis quebrado na água), Difração (contorno de obstáculos), Interferência (construtiva/destrutiva). Efeito Doppler: aproximação = som mais agudo, afastamento = mais grave.',
    source: 'faq',
  },
  {
    id: 'fis_103',
    keywords: ['eletricidade', 'circuito', 'corrente', 'tensao', 'resistencia'],
    content:
      'Eletricidade: corrente elétrica (movimento ordenado de cargas), tensão/ddp (diferença de potencial: Volts), resistência (Ohms: dificuldade à passagem de corrente). Lei de Ohm: V = R×I. Potência: P = V×I = R×I². Circuitos: série (mesma corrente, tensão divide), paralelo (mesma tensão, corrente divide). Consumo de energia: E = P×Δt (kWh). Geradores, receptores, capacitores.',
    source: 'faq',
  },
  {
    id: 'fis_104',
    keywords: ['optica', 'luz', 'lente', 'espelho', 'visao'],
    content:
      'Óptica: reflexão (espelhos planos e esféricos), refração (lei de Snell), lentes (convergentes: óculos de miopia, divergentes: hipermetropia). Olho humano: córnea, pupila, cristalino, retina. Defeitos da visão: miopia (dificuldade para longe: lente divergente), hipermetropia (dificuldade para perto: lente convergente), astigmatismo (distorção), presbiopia (vista cansada). Espectro eletromagnético: rádio, micro-ondas, infravermelho, luz visível, UV, raios-X, raios gama.',
    source: 'faq',
  },
  {
    id: 'fis_105',
    keywords: ['hidrostatica', 'pressao', 'densidade', 'empuxo', 'fluido'],
    content:
      'Hidrostática: densidade (d = m/V), pressão (P = F/A). Teorema de Stevin: P = d×g×h (pressão em coluna de líquido). Vasos comunicantes, prensa hidráulica (Pascal). Empuxo (Arquimedes): E = d_líquido × V_imerso × g: um corpo imerso sofre força vertical para cima igual ao peso do líquido deslocado. Flutua: densidade do objeto < densidade do líquido.',
    source: 'faq',
  },
  {
    id: 'fis_106',
    keywords: ['cinematica', 'movimento', 'velocidade', 'aceleracao', 'mrU', 'muv'],
    content:
      'Cinemática: MRU (velocidade constante: S = S₀ + v×t), MRUV (aceleração constante: v = v₀ + a×t, S = S₀ + v₀×t + at²/2, Torricelli: v² = v₀² + 2a×ΔS). Gráficos: MRU (S×t = reta inclinada, v×t = reta horizontal), MRUV (S×t = parábola, v×t = reta inclinada). Lançamento vertical, queda livre. Movimento circular: MCU (velocidade angular constante, aceleração centrípeta).',
    source: 'faq',
  },

  // === Química ===
  {
    id: 'qui_100',
    keywords: ['quimica', 'ligacao', 'atomica', 'molecular', 'ionica', 'covalente'],
    content:
      'Química no ENEM: Ligações químicas: iônica (metal + ametal: NaCl, doação/recebimento de elétrons), covalente (ametal + ametal: H₂O, CO₂, compartilhamento de elétrons), metálica (metal + metal: liga). Tabela periódica: períodos (7 linhas horizontais), grupos/famílias (18 colunas: metais alcalinos, alcalino-terrosos, halogênios, gases nobres). Propriedades periódicas: raio atômico, eletronegatividade, afinidade eletrônica.',
    source: 'faq',
  },
  {
    id: 'qui_101',
    keywords: ['estequiometria', 'mol', 'massa', 'calculo', 'reacao'],
    content:
      'Estequiometria: relação de massas nas reações químicas. Mol = 6,02×10²³ partículas. Massa molar (g/mol). Passos: 1) Escrever a equação balanceada, 2) Converter dados para mol, 3) Usar proporção estequiométrica, 4) Converter para o que se pede. Ex: 2H₂ + O₂ 2H₂O: 2 mols de H₂ reagem com 1 mol de O₂. Reagente limitante: aquele que acaba primeiro e determina a quantidade de produto.',
    source: 'faq',
  },
  {
    id: 'qui_102',
    keywords: ['solucao', 'concentracao', 'diluicao', 'molaridade', 'titulo'],
    content:
      'Soluções químicas: concentração comum (C = m/V: g/L), molaridade (M = n/V: mol/L), título (massa do soluto/massa total). Diluição: C₁V₁ = C₂V₂ (a concentração diminui ao adicionar solvente). Mistura de soluções de mesmo soluto: C_final = (C₁V₁ + C₂V₂)/(V₁ + V₂). PH: pH = -log[H⁺], escala 0-14 (ácido < 7, neutro = 7, básico > 7).',
    source: 'faq',
  },
  {
    id: 'qui_103',
    keywords: ['oxirreducao', 'redox', 'oxidacao', 'reducao', 'numero oxidacao'],
    content:
      'Oxirredução: reação com transferência de elétrons. Oxidação (perde elétrons: NOX aumenta), Redução (ganha elétrons: NOX diminui). Agente oxidante (causa oxidação: ele reduz), Agente redutor (causa redução: ele oxida). Número de oxidação (NOX): carga aparente do átomo. Pilhas: transformam energia química em elétrica (pilha de Daniell: Zn + Cu²⁺ Zn²⁺ + Cu). Eletrólise: processo inverso: energia elétrica para reação química.',
    source: 'faq',
  },
  {
    id: 'qui_104',
    keywords: ['organica', 'carbono', 'hidrocarboneto', 'funcao', 'cadeia'],
    content:
      'Química orgânica: carbono (4 ligações covalentes). Hidrocarbonetos: alcanos (C-C simples), alcenos (C=C dupla), alcinos (C≡C tripla), aromáticos (benzeno). Funções orgânicas: álcool (OH), cetona (C=O), ácido carboxílico (COOH), éster (COO), amina (NH₂), amida (CONH₂). Reações: combustão (completa: CO₂ + H₂O), saponificação (óleo + base sabão), esterificação (ácido + álcool éster + água), polimerização (formação de plásticos).',
    source: 'faq',
  },
  {
    id: 'qui_105',
    keywords: ['termoquimica', 'entalpia', 'exotermica', 'endotermica', 'calor'],
    content:
      'Termoquímica: reações exotérmicas (liberam calor: ΔH < 0), endotérmicas (absorvem calor: ΔH > 0). Entalpia (H): conteúdo de calor do sistema. Lei de Hess: ΔH total = soma dos ΔH das etapas. Entalpia padrão de formação, combustão, neutralização. Energia de ativação: energia mínima para reação acontecer. Catalisador: diminui a energia de ativação, não é consumido.',
    source: 'faq',
  },
  {
    id: 'qui_106',
    keywords: ['cinetica', 'velocidade', 'reacao', 'catalisador', 'concentracao'],
    content:
      '⏱ Cinética química: velocidade da reação = Δ[concentração]/Δt. Fatores que alteram velocidade: 1) Concentração (concentração = velocidade), 2) Temperatura (temperatura = velocidade: regra: dobra a cada 10°C), 3) Superfície de contato (área = velocidade), 4) Catalisador (acelera sem ser consumido). Lei da velocidade: v = k × [A]^m × [B]^n. Ordem de reação (m, n).',
    source: 'faq',
  },
  {
    id: 'qui_107',
    keywords: ['radioatividade', 'decaimento', 'meia vida', 'urânio', 'radiacao'],
    content:
      'Radioatividade: emissão espontânea de radiação. Tipos: alfa (α: 2 prótons + 2 nêutrons, baixo poder de penetração), beta (β: elétron, médio poder), gama (γ: onda eletromagnética, alto poder). Meia-vida: tempo para metade dos átomos decaírem. Datação por carbono-14. Fissão nuclear (quebra do núcleo: usinas nucleares, bomba atômica), Fusão nuclear (junção de núcleos: Sol, bomba de hidrogênio).',
    source: 'faq',
  },

  // === Filosofia ===
  {
    id: 'fil_100',
    keywords: ['filosofia', 'socrates', 'platao', 'aristoteles', 'pensamento'],
    content:
      'Filosofia antiga no ENEM: Sócrates (método socrático: ironia e maiêutica, "conhece-te a ti mesmo", ética baseada no conhecimento), Platão (Mundo das Ideias x Mundo Sensível, Alegoria da Caverna: conhecimento como saída da ignorância, política: rei-filósofo), Aristóteles (ética das virtudes: "justo meio", política: o homem é animal político, lógica: silogismo).',
    source: 'faq',
  },
  {
    id: 'fil_101',
    keywords: ['descartes', 'racionalismo', 'cogito', 'duvida', 'moderno'],
    content:
      'Filosofia moderna: Descartes (Racionalismo: "Penso, logo existo", dúvida metódica, dualismo mente-corpo). Diferente de: Empirismo (Hume, Locke: conhecimento vem da experiência). Kant (Revolução Copernicana: sujeito ativo no conhecimento, imperativo categórico, "esclarecimento"= usar a própria razão).',
    source: 'faq',
  },
  {
    id: 'fil_102',
    keywords: ['nietzsche', 'poder', 'moral', 'superhomem', 'vontade'],
    content:
      'Nietzsche: crítica à moral cristã (moral de escravos x moral de senhores), Vontade de Poder (impulso fundamental do ser humano), Super-homem (além-do-homem: criar seus próprios valores), Eterno Retorno (viver cada momento como se fosse repetir eternamente), Morte de Deus (declínio dos valores transcendentais).',
    source: 'faq',
  },
  {
    id: 'fil_103',
    keywords: ['etica', 'moral', 'justica', 'direito', 'politica'],
    content:
      'Ética e Política: Ética (reflexão sobre o agir moral: o que é certo/errado?), Moral (conjunto de normas de uma sociedade). Contratualismo: Hobbes (homem lobo do homem, Estado absoluto), Locke (direitos naturais, Estado liberal), Rousseau (bom selvagem, vontade geral, democracia direta). Utilitarismo (Mill, Bentham: maior bem para o maior número). John Rawls (justiça como equidade, véu da ignorância).',
    source: 'faq',
  },
  {
    id: 'fil_104',
    keywords: ['escola franfur', 'indústria cultural', 'adorno', 'consumo', 'midia'],
    content:
      'Escola de Frankfurt: Adorno e Horkheimer (Indústria Cultural: cultura produzida em massa para manipular consciências, alienação), Benjamin (reprodutibilidade técnica da obra de arte: perda da aura), Marcuse (sociedade unidimensional: falsas necessidades), Habermas (espaço público, agir comunicativo). Crítica à mídia, consumo e padronização cultural.',
    source: 'faq',
  },
  {
    id: 'fil_105',
    keywords: ['existencialismo', 'sartre', 'liberdade', 'escolha', 'essencia'],
    content:
      'Existencialismo: Sartre ("A existência precede a essência": o ser humano não tem essência pré-definida, se constrói pelas escolhas), liberdade radical (condenado a ser livre), responsabilidade (suas escolhas afetam toda a humanidade), má-fé (negar a própria liberdade). Camus (absurdo: busca de sentido em um mundo sem sentido, Sísifo como herói). Heidegger (ser-no-mundo, ser-para-a-morte).',
    source: 'faq',
  },
  {
    id: 'fil_106',
    keywords: ['politica', 'poder', 'estado', 'governo', 'democracia'],
    content:
      'Filosofia Política: Platão (República: governo dos filósofos), Aristóteles (Política: classificação dos governos: monarquia x tirania, aristocracia x oligarquia, democracia x demagogia), Maquiavel (separação entre moral e política: "os fins justificam os meios", virtù e fortuna), Marx (luta de classes, alienação, mais-valia, materialismo histórico-dialético, comunismo), Foucault (microfísica do poder, biopoder).',
    source: 'faq',
  },

  // === Sociologia ===
  {
    id: 'soc_100',
    keywords: ['sociologia', 'sociedade', 'classe', 'desigualdade', 'estratificacao'],
    content:
      'Sociologia no ENEM: Desigualdade social: Marx (classes sociais = relação com meios de produção: burguesia x proletariado, mais-valia, alienação, luta de classes, ideologia). Weber (estratificação social: classe + status + poder, ação social). Durkheim (fato social: exterior, coercitivo, geral; consciência coletiva, solidariedade mecânica x orgânica, anomia).',
    source: 'faq',
  },
  {
    id: 'soc_101',
    keywords: ['cultura', 'diversidade', 'etnocentrismo', 'identidade', 'antropologia'],
    content:
      'Cultura e diversidade: Cultura (conjunto de valores, crenças, costumes de um grupo), Etnocentrismo (julgar outra cultura pela sua própria: inferiorização), Relativismo cultural (compreender cada cultura em seus próprios termos), Identidade cultural (pertencimento a um grupo: Hall, Bauman), Multiculturalismo (convivência de múltiplas culturas), Antropologia (Lévi-Strauss: estruturalismo, DaMatta: "o que faz o brasil, Brasil").',
    source: 'faq',
  },
  {
    id: 'soc_102',
    keywords: ['trabalho', 'emprego', 'precarizacao', 'mercado', 'capitalismo'],
    content:
      'Sociologia do trabalho: Taylorismo (divisão técnica, cronômetro), Fordismo (linha de montagem, produção em massa), Toyotismo (produção flexível, just-in-time, equipes). Precarização: informalidade, uberização, trabalho intermitente, desemprego estrutural (tecnologia eliminando postos). Direitos trabalhistas: CLT, carteira assinada, reforma trabalhista (2017).',
    source: 'faq',
  },
  {
    id: 'soc_103',
    keywords: ['movimento social', 'protesto', 'ativismo', 'luta', 'direitos'],
    content:
      'Movimentos sociais no Brasil: Movimento Negro (Zumbi, consciência negra, desigualdade racial, cotas), Movimento Feminista (sufrágio, Simone de Beauvoir, violência doméstica: Lei Maria da Penha, igualdade de gênero), Movimento LGBTQIA+ (Stonewall, direitos, homofobia), Movimento dos Sem-Terra: MST (reforma agrária), Movimento Estudantil (UNE, caras-pintadas: impeachment Collor), Movimento Ambientalista (sustentabilidade).',
    source: 'faq',
  },
  {
    id: 'soc_104',
    keywords: ['globalizacao', 'mundializacao', 'cultura', 'consumo', 'midia'],
    content:
      "Globalização e cultura: Homogeneização cultural (McDonald's, Hollywood, padronização), Híbridos culturais (Canclini: mistura do global com local), Sociedade do consumo (Bauman: modernidade líquida, consumismo como forma de vida), Aldeia global (McLuhan: comunicação instantânea). Mídia: indústria cultural, fake news, pós-verdade (emoção > fatos), algoritmos e bolhas sociais.",
    source: 'faq',
  },
  {
    id: 'soc_105',
    keywords: ['cidadania', 'direitos', 'constituicao', 'democracia', 'politica'],
    content:
      'Cidadania no Brasil: Direitos civis (liberdade, propriedade, justiça), Direitos políticos (voto, ser votado, partidos), Direitos sociais (educação, saúde, trabalho, moradia, lazer). Constituição de 1988 ("Constituição Cidadã"): Estado Democrático de Direito, direitos fundamentais, capítulo dos direitos sociais. Democracia no Brasil: redemocratização (1985), Diretas Já, assembleia constituinte.',
    source: 'faq',
  },
  {
    id: 'soc_106',
    keywords: ['questao racial', 'racismo', 'negro', 'indigena', 'desigualdade'],
    content:
      'Questão racial no Brasil: Racismo estrutural (Almeida: enraizado nas instituições e na sociedade), mito da democracia racial (falsa ideia de que não há racismo no Brasil: Florestan Fernandes), desigualdades (renda, educação, violência: dados do IBGE), cotas raciais (Lei 12.711/2012: alunos de escola pública, pretos, pardos, indígenas), genocídio da juventude negra, população indígena (invasão de terras, demarcação, direitos originários).',
    source: 'faq',
  },
  {
    id: 'soc_107',
    keywords: ['genero', 'feminismo', 'mulher', 'patriarcado', 'igualdade'],
    content:
      'Gênero e feminismo: Diferença entre sexo (biológico) e gênero (construção social: Simone de Beauvoir "Não se nasce mulher, torna-se"), Patriarcado (sistema de dominação masculina), Ondas do feminismo: 1ª (sufrágio, séc. XIX-XX), 2ª (igualdade, 1960-80), 3ª (interseccionalidade: raça, classe, gênero), 4ª (digital, body positive, #MeToo). Violência de gênero: Lei Maria da Penha (2006), feminicídio (Lei 13.104/2015).',
    source: 'faq',
  },

  // === Inglês ===
  {
    id: 'ing_100',
    keywords: ['ingles', 'interpretacao', 'texto', 'reading', 'vocabulary'],
    content:
      '🇬🇧 Inglês no ENEM: a prova de língua estrangeira moderno cobra principalmente interpretação de textos autênticos (notícias, artigos, charges, letras de música, propagandas). Dicas: 1) Leia o título primeiro, 2) Identifique palavras cognatas (semelhantes ao português), 3) Use o contexto para deduzir significado, 4) Responda com base no texto: evite inferências externas. Não precisa traduzir tudo: foque na ideia geral.',
    source: 'faq',
  },
  {
    id: 'ing_101',
    keywords: ['verbo', 'tense', 'tempo', 'present', 'past', 'future', 'grammar'],
    content:
      'Tempos verbais em inglês: Simple Present (I study: facts, routine), Present Continuous (I am studying: now), Simple Past (I studied: finished), Past Continuous (I was studying: in progress), Present Perfect (I have studied: past with present connection), Future (will + verb / going to). Verbos irregulares comuns: go-went-gone, buy-bought-bought, see-saw-seen, take-took-taken, make-made-made.',
    source: 'faq',
  },
  {
    id: 'ing_102',
    keywords: ['conectivo', 'linking', 'however', 'therefore', 'although', 'despite'],
    content:
      'Conectivos em inglês: Addition (and, also, moreover, furthermore, besides), Contrast (but, however, although, even though, yet, nevertheless, on the other hand), Cause/Effect (because, since, therefore, thus, consequently, as a result), Sequence (first, then, next, after, finally), Conclusion (in conclusion, to sum up, overall). Essenciais para interpretar relações entre ideias no texto.',
    source: 'faq',
  },
  {
    id: 'ing_103',
    keywords: ['cognato', 'falso cognato', 'palavra', 'vocabulary', 'meaning'],
    content:
      'Falsos cognatos (false friends): actually = na verdade (não "atualmente"currently), agenda = pauta (não "agenda"diary/planner), college = faculdade (não "colégio"high school), parents = pais (não "parentes"relatives), pretend = fingir (não "pretender"intend), sensible = sensato (não "sensível"sensitive), library = biblioteca (não "livraria"bookstore), push = empurrar (não "puxar"pull).',
    source: 'faq',
  },
  {
    id: 'ing_104',
    keywords: ['charge', 'cartoon', 'tirinha', 'comic', 'strip', 'humor'],
    content:
      'Interpretação de charges e tirinhas em inglês: preste atenção em 1) Elementos visuais (expressões faciais, objetos, cenário), 2) Onomatopeias (sound effects: "bang!", "crash!", "wow!"), 3) Jogo de palavras (pun), 4) Ironia e sarcasmo, 5) Contexto cultural. As charges geralmente criticam questões sociais, políticas ou econômicas. O tom visual é tão importante quanto o texto.',
    source: 'faq',
  },

  // === Estudo e Produtividade ===
  {
    id: 'est_1',
    keywords: ['pomodoro', 'tecnica', 'foco', 'tempo', 'produtividade'],
    content:
      '⏱ Técnica Pomodoro: 25 minutos de foco total, 5 minutos de pausa. A cada 4 ciclos, pausa maior de 15-30 min. Adaptação para ENEM: estude 50 min e pause 10 min (mais adequado para questões e leitura). O importante é manter o foco absoluto durante o período de estudo: sem celular, sem redes sociais.',
    source: 'faq',
  },
  {
    id: 'est_2',
    keywords: ['revisao', 'repeticao', 'esquecimento', 'memoria', 'eba'],
    content:
      'Curva do esquecimento (Ebbinghaus): esquecemos 50% do conteúdo em 1 hora, 70% em 24h. Para combater: revisão espaçada: 1ª revisão em 24h, 2ª em 7 dias, 3ª em 30 dias. Técnicas: flash cards (pergunta na frente, resposta atrás), resumo ativo (explicar em voz alta), mapa mental. A revisão é mais importante que o estudo inicial.',
    source: 'faq',
  },
  {
    id: 'est_3',
    keywords: ['mapa mental', 'resumo', 'esquema', 'grafico', 'visual'],
    content:
      'Mapas mentais: técnica de estudo visual. Comece com o tema central no meio, ramifique com subtópicos, use cores e desenhos. Mapas mentais ajudam a: 1) Ver conexões entre assuntos, 2) Memorizar visualmente, 3) Revisar rápido. Ferramentas: papel e caneta coloridos, ou apps como XMind, MindMeister. Recomendado para revisão, não para o primeiro contato com o conteúdo.',
    source: 'faq',
  },
  {
    id: 'est_4',
    keywords: ['questao', 'exercicio', 'praticar', 'resolver', 'banco'],
    content:
      'Resolução de questões: a forma mais eficaz de estudar para o ENEM. 1) Resolva sem consultar, 2) Cronometre (ideal: 3 min por questão), 3) Corrija e entenda o erro, 4) Anote a matéria para revisar. Meta: 10-20 questões por dia nos meses finais. Use provas anteriores do ENEM (disponíveis no site do INEP). Acertar é bom, mas errar e aprender é o que realmente faz diferença.',
    source: 'faq',
  },
  {
    id: 'est_5',
    keywords: ['sono', 'dormir', 'descanso', 'memoria', 'aprendizado'],
    content:
      'Sono e aprendizado: durante o sono, o cérebro consolida memórias e processa informações do dia. Dormir mal reduz em até 40% a capacidade de aprendizado. Recomendações: 7-9h por noite, evitar telas 1h antes de dormir, não estudar até tarde na véspera da prova. Cochilo de 20 min após o almoço melhora a retenção.',
    source: 'faq',
  },
  {
    id: 'est_6',
    keywords: ['alimentacao', 'nutricao', 'comida', 'energia', 'cerebro'],
    content:
      'Alimentação para estudos: carboidratos complexos (pão integral, aveia): energia de longa duração, proteínas (ovos, iogurte, castanhas): neurotransmissores, frutas (banana, maçã): glicose estável, água (2L/dia): hidratação cerebral. Evite: açúcar refinado (pico de energia seguido de queda), frituras (digestão pesada), excesso de café (ansiedade e insônia). No dia da prova: leve água, chocolate amargo, frutas secas e sanduíche natural.',
    source: 'faq',
  },
  {
    id: 'est_7',
    keywords: ['ansiedade', 'calma', 'nervoso', 'respirar', 'meditacao'],
    content:
      'Controle da ansiedade: Técnica 4-7-8 (inspire pelo nariz por 4s, segure por 7s, expire pela boca por 8s: repita 3x), Meditação mindfulness (5 min focando na respiração), Visualização positiva (imagine-se fazendo a prova com calma), Exercício físico (libera endorfina, reduz cortisol). Lembre-se: ansiedade é normal e até ajuda (eustress), o problema é o excesso.',
    source: 'faq',
  },
  {
    id: 'est_8',
    keywords: ['meta', 'objetivo', 'planejamento', 'semanal', 'cronograma'],
    content:
      'Planejamento semanal: 1) Defina metas REALISTAS (ex: resolver 50 questões de matemática), 2) Distribua matérias ao longo da semana (alternar exatas/humanas), 3) Inclua revisão e descanso, 4) Use o método SMART: Específico, Mensurável, Alcançável, Relevante, Temporal. Exemplo: "Resolver 30 questões de geometria até sexta-feira"em vez de "estudar matemática".',
    source: 'faq',
  },

  // === Atualidades ===
  {
    id: 'atu_1',
    keywords: ['atualidade', 'noticia', 'acontecimento', 'atual', 'mundo'],
    content:
      'Atualidades para o ENEM: o exame cobra capacidade de relacionar conhecimentos com fatos recentes. Acompanhe: meio ambiente (crise climática, desmatamento, COP), tecnologia (IA, redes sociais, privacidade de dados: LGPD), política (democracia, extremismo, fake news), economia (inflação, desemprego, reformas), saúde (pandemias, SUS, saúde mental), sociedade (desigualdade, racismo, gênero, migrações). Fontes confiáveis: Jornal Nacional, Folha, BBC Brasil, Agência Senado.',
    source: 'faq',
  },
  {
    id: 'atu_2',
    keywords: ['fake news', 'desinformacao', 'verdade', 'noticia falsa', 'midia'],
    content:
      'Fake news e desinformação: notícias falsas criadas para enganar. Como identificar: 1) Verifique a fonte (site conhecido?), 2) Leia além do título (clickbait), 3) Cheque a data (notícia velha reciclada), 4) Procure em veículos confiáveis, 5) Desconfie de conteúdo muito emocional. Pós-verdade: apelo à emoção supera fatos objetivos. O ENEM pode cobrar análise crítica de informações.',
    source: 'faq',
  },
  {
    id: 'atu_3',
    keywords: ['ia', 'inteligencia artificial', 'chatgpt', 'tecnologia', 'futuro'],
    content:
      'Inteligência Artificial: IA generativa (ChatGPT, Gemini, Claude: criam conteúdo novo), Machine Learning (aprendizado de máquina: algoritmos que aprendem com dados), impacto no trabalho (automação de tarefas repetitivas, novas profissões), ética (vieses algorítmicos, privacidade, PL das IAs). O ENEM pode cobrar aspectos sociais, éticos e ambientais da tecnologia.',
    source: 'faq',
  },
];
