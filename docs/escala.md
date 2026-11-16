# Backend preparado para escala (#68)

## Índices

A migration `036_indices_escala.sql` cobre as consultas que varrem
tabela grande: alunos por turma e papel, desempenho por janela de tempo,
fila e limite diário de push, lembretes de ofensiva e de revisão. Em
produção, com tabela já grande, crie um por vez fora de transação para
não travar escrita:

```sql
create index concurrently if not exists perfis_turma_papel_idx on public.perfis (turma_id, papel);
```

Para achar a próxima consulta lenta: Supabase → Reports → Query
Performance, ordenado por tempo total.

## RLS

Políticas que consultam outra tabela por linha ficam caras. O padrão já
adotado no projeto (e a seguir em tabela nova) é:

- `(select auth.uid())` em vez de `auth.uid()`: o Postgres calcula uma vez
  por consulta, não uma vez por linha;
- regra que precisa de outra tabela vai para função `SECURITY DEFINER`
  `stable` (ex.: `minhas_turmas()`, `pode_ver_resumo()`), nunca subconsulta
  na própria política (que também causa recursão, ver 004 e 027).

## Teste de carga

`scripts/carga/k6-aluno.js` simula até 5.000 alunos ao mesmo tempo no
caminho mais quente (abrir o app e responder questões), com a meta da
issue embutida: p95 abaixo de 300 ms e menos de 1% de erro.

**Sempre contra staging**, com um aluno de teste criado lá
(e-mail `.invalid`). Instale o k6 (`brew install k6` ou o pacote da
distribuição) e rode o comando que está no topo do arquivo. Este teste
ainda não foi rodado: depende do projeto de staging com dados.

## Conexões

- O app fala com o banco pela API do Supabase (PostgREST), que já usa
  pool interno. Não abra conexão Postgres direta do navegador nem do
  worker.
- Se algum serviço precisar de conexão direta (script, ETL), use o
  pooler do Supabase (porta 6543, modo transaction), nunca a porta 5432.
- Para a véspera do ENEM, o plano gratuito tem limite baixo de conexões e
  de computação: o plano Pro (com add-on de computação, se o teste de
  carga pedir) é o mínimo para 5.000 simultâneos. Decisão de custo do dono.

## Backup e recuperação

- Plano Pro: backup diário automático com 7 dias de retenção; com o
  add-on PITR, restauração para qualquer minuto.
- **Teste de restauração (critério da issue), uma vez por mês:**
  1. Supabase → Database → Backups: restaurar o backup mais recente num
     projeto NOVO (nunca por cima de produção).
  2. Conferir contagens: `select count(*) from perfis`, `quiz_resultados`,
     `notificacoes`, comparando com produção no mesmo horário.
  3. Rodar `scripts/migrar.sh` apontando para o projeto restaurado e ver
     que não há migration faltando.
  4. Registrar data, tempo de restauração e diferenças.
- Cópia extra fora do Supabase (recomendado): `pg_dump` semanal pelo
  pooler, guardado em armazenamento da organização, cifrado.
