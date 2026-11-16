-- =====================================================================
-- 036 — Índices para a véspera do ENEM (#68, M7)
-- =====================================================================
--
-- Revisão das consultas mais frequentes e das funções que varrem tabelas
-- grandes. Cada índice abaixo responde a uma consulta que hoje faz
-- leitura sequencial quando a tabela cresce:
--
--   perfis (turma_id, papel)         relatórios, insights e termômetro filtram
--                                    alunos da turma por papel (020, 022, 034)
--   perfis (escola_id, papel)        limite de alunos por plano (034) e escopo
--                                    da secretaria
--   quiz_desempenho_topicos
--     (user_id, atualizado_em)       janelas de 24h a 365 dias (020, 034)
--   quiz_questoes_exibidas
--     (user_id, criado_em)           volume de perguntas por janela (020)
--   notificacoes (user_id, canal,
--     enviada_em)                    limite diário de push (032), contado a
--                                    cada envio
--   notificacoes (canal, criado_em)
--     where pendente                 a fila de push lida a cada cron (032)
--   gamificacao (ultimo_acesso)
--     where streak >= 2              lembrete de ofensiva (032)
--   revisoes_espacadas
--     (proxima_revisao)              lembrete de revisão do dia (032)
--
-- Todos com `if not exists`: rodar de novo não faz mal. Em tabela grande
-- de produção, prefira criar um por vez com CONCURRENTLY fora de
-- transação (ver docs/escala.md).
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

create index if not exists perfis_turma_papel_idx on public.perfis (turma_id, papel);
create index if not exists perfis_escola_papel_idx on public.perfis (escola_id, papel);
create index if not exists quiz_desemp_user_atualizado_idx on public.quiz_desempenho_topicos (user_id, atualizado_em desc);
create index if not exists quiz_exibidas_user_criado_idx on public.quiz_questoes_exibidas (user_id, criado_em desc);
create index if not exists notif_user_canal_enviada_idx on public.notificacoes (user_id, canal, enviada_em);
create index if not exists notif_push_pendente_idx on public.notificacoes (canal, criado_em)
  where enviada_em is null and descartada is null;
create index if not exists gamificacao_ofensiva_idx on public.gamificacao (ultimo_acesso) where streak >= 2;
create index if not exists revisoes_vencendo_idx on public.revisoes_espacadas (proxima_revisao);

commit;
