-- =====================================================================
-- CONFERÊNCIA: o banco tem mesmo a 024, a 025 e a 026?
-- =====================================================================
-- Cole no SQL Editor do Supabase e rode. Não altera nada: só lê o
-- catálogo do Postgres e diz, item por item, "OK" ou "FALTANDO".
--
-- Se qualquer linha vier FALTANDO, é só rodar de novo a migration
-- correspondente: as três são idempotentes.
-- =====================================================================

with esperado (migration, item, tipo) as (
  values
    ('024', 'perfis.data_nascimento',      'coluna'),
    ('024', 'perfis.codigo_vinculo',       'coluna'),
    ('024', 'vincular_por_codigo',         'funcao'),
    ('024', 'regenerar_codigo_vinculo',    'funcao'),
    ('024', 'revogar_vinculo',             'funcao'),
    ('024', 'meus_responsaveis',           'funcao'),
    ('024', 'e_menor_de_16',               'funcao'),

    ('025', 'pode_ver_resumo',             'funcao'),
    ('025', 'resumo_mensal_aluno',         'funcao'),
    ('025', 'resumo_semanal_aluno',        'funcao'),
    ('025', 'materias_aluno',              'funcao'),
    ('025', 'ficha_aluno',                 'funcao'),

    ('026', 'turma_professores',           'tabela'),
    ('026', 'minhas_turmas',               'funcao'),
    ('026', 'leciona_na_turma',            'funcao'),
    ('026', 'atribuir_professor_turma',    'funcao'),
    ('026', 'remover_professor_turma',     'funcao'),
    ('026', 'docentes_da_escola',          'funcao'),
    ('026', 'professores_da_turma',        'funcao')
)
select e.migration,
       e.tipo,
       e.item,
       case
         when e.tipo = 'funcao' and exists (
           select 1 from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = e.item
         ) then 'OK'
         when e.tipo = 'tabela' and exists (
           select 1 from information_schema.tables
            where table_schema = 'public' and table_name = e.item
         ) then 'OK'
         when e.tipo = 'coluna' and exists (
           select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name  = split_part(e.item, '.', 1)
              and column_name = split_part(e.item, '.', 2)
         ) then 'OK'
         else 'FALTANDO'
       end as situacao
from esperado e

union all

-- As duas funções que a 026 REESCREVE já existiam antes dela. Existir
-- não prova nada aqui: o que prova é o corpo novo chamar minhas_turmas().
-- Sem esta checagem, um banco com a 022 antiga passaria como atualizado.
select '026', 'reescrita', 'termometro_cognitivo usa minhas_turmas()',
       case when exists (
         select 1 from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'termometro_cognitivo'
            and p.prosrc like '%minhas_turmas%'
       ) then 'OK' else 'FALTANDO' end

union all

select '026', 'reescrita', 'insights_turma_24h usa minhas_turmas()',
       case when exists (
         select 1 from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'insights_turma_24h'
            and p.prosrc like '%minhas_turmas%'
       ) then 'OK' else 'FALTANDO' end

order by 1, 2, 3;
