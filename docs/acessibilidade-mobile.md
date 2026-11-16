# Acessibilidade do app nativo (#34)

O que o app faz sozinho, o que foi verificado e o roteiro manual que
falta rodar num aparelho de verdade.

## O que o app segue do sistema

| Ajuste do sistema | Onde o app obedece |
| --- | --- |
| Tamanho da letra (fonte dinâmica no iOS, escala no Android) | `Texto` acompanha até 2x (`maxFontSizeMultiplier`) |
| Reduzir movimento | `useMovimentoReduzido` (sagui, esqueleto, trilha, nível novo) |
| Leitor de tela (VoiceOver, TalkBack) | rótulos, papéis, `accessibilityLiveRegion` e `anunciar()` |
| Alto contraste (iOS "Escurecer cores", Android "Texto de alto contraste") | `useSincronizarContrasteDoSistema` na raiz |

## O que é do app (Mais, Acessibilidade)

- **Alto contraste**: texto cinza vira tinta, bordas de cartão, campo e
  botão secundário escurecem. Se o sistema já ligou, a chave aparece
  travada com o aviso.
- **Cores de acerto e erro**: `coresDeSinal` (`@mentor/core/acessibilidadeCores`).
  Verde contra vermelho é o par que protan e deutan não separam; o app
  troca por azul contra laranja (ou vermelho contra verde azulado no
  tritan). Vale no quiz, no gabarito, nos acertos por matéria da Central
  e nas notas da redação. Há teste garantindo contraste AA de todas as
  variantes sobre branco e sobre o fundo claro de cada uma.
- Mesma chave do web (`mm_acessibilidade`), mesmos nomes de campo.

## Verificado no export web (Playwright)

Todo elemento interativo com nome acessível, sem exceção, em: entrar,
Central, Quiz (escolha de matéria e questão respondida), Mais e
Acessibilidade. Captura do quiz em deuteranopia com alto contraste.

## Roteiro manual (TalkBack e VoiceOver)

Rodar num development build (#36), com o leitor ligado, deslizando um
item por vez. Cada linha é um "passou / não passou".

1. **Entrar**: os campos dizem "E-mail" e "Senha"; o botão diz "Entrar";
   erro de senha é falado sem precisar procurar.
2. **Barra de abas**: cada aba é anunciada com o nome e "selecionada".
3. **Central**: a faixa do plano é lida como cabeçalho; cada bolinha da
   trilha diz o nome da tarefa e se está concluída; o gráfico da semana
   é lido como uma frase ("Atividades nos últimos 7 dias...").
4. **Quiz**: as alternativas são um grupo de opção; depois de responder,
   o leitor fala "Mandou bem!" ou "Quase lá!" sem mover o foco; a
   alternativa certa é anunciada como "correta".
5. **Mentor**: a resposta em streaming não é lida pedaço por pedaço
   (só quando termina).
6. **Foco**: o tempo restante é anunciado a cada minuto, não a cada
   segundo.
7. **Apoio** (topo de toda tela): alcançável em no máximo três deslizes
   a partir do título; o overlay de crise prende o foco e o CVV 188 é o
   primeiro item.
8. **Letra no máximo** (200%): nenhum botão corta o texto, nada some
   para fora da tela na Central, no Quiz e no Mentor.
9. **Reduzir movimento ligado**: o sagui fica parado e o nível novo
   aparece sem pulo.
10. **Alto contraste do sistema ligado**: a chave do app aparece travada
    e o texto secundário fica escuro.
