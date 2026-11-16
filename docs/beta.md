# Beta fechado com escolas parceiras (issue #74)

## Canal de feedback

No Perfil do aluno ("Conte para a gente") e no fim dos outros painéis.
Tipo (problema, ideia, elogio), texto e a nota de 0 a 10 do NPS,
opcional. A aba de onde a pessoa veio vai junto. Dez envios por dia por
pessoa. Fica em `feedback_beta` (migration 037); o app não mostra o
feedback de ninguém a ninguém, a equipe lê no SQL Editor.

## Métricas de sucesso

`supabase/migrations/verificacao/metricas_beta.sql` devolve, numa linha:

| Métrica | Definição |
| --- | --- |
| Retenção D1 e D7 | Dos alunos com cadastro há 1 (ou 7) dias ou mais, quantos estudaram exatamente 1 (ou 7) dias depois |
| Ativos em 7 dias | Alunos com qualquer atividade de estudo na última semana |
| Dias ativos por aluno | Média de dias com estudo, entre os ativos da semana |
| NPS | % de notas 9 e 10 menos % de 0 a 6 |

Troque a lista `escolas_beta` no topo pelos ids das escolas parceiras.

**Metas sugeridas para o go** (ajustar com o dono): retenção D7 acima de
25%, 3 ou mais dias ativos por semana, NPS acima de 30, e nenhum
problema aberto de perda de dado ou de privacidade.

## Rodada quinzenal

1. Rodar `metricas_beta.sql` e guardar o resultado na planilha do beta.
2. Ler o feedback das duas semanas (consulta no fim do mesmo arquivo).
3. Problemas viram issue com o rótulo `beta`; o que for de privacidade
   ou de perda de progresso passa na frente de tudo.
4. Publicar as correções e avisar as escolas do que mudou.

## Recrutamento (fora do código)

2 a 3 escolas, cerca de 200 alunos. Para cada escola: criar a escola e
as turmas, cadastrar a secretaria, importar a planilha (a secretaria faz
pelo painel), e combinar uma pessoa de contato. Definir `limite_alunos`
(migration 034) com folga.
