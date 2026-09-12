-- =====================================================================
-- Mentor Noturno (HackTudo 2026) - Onboarding inteligente (primeiro acesso)
--
-- Separa "primeiro acesso" de "recorrente" no PERFIL, nao no aparelho:
-- laboratorio compartilhado nao pode herdar o onboarding do aluno anterior.
--
-- Colunas (todas anulaveis com padrao seguro, para linhas antigas):
--   onboarding_completed  boolean default false — roteamento condicional
--   metas_estudo          text[]  default '{}'  — chips do passo 2
--   tempo_diario_estudo   text    default null  — passo 3 ("15 min", "1 hora"...)
--   turno_estudo          text    default null  — passo 3 ("manha", "tarde", "noite")
--
-- RLS: o dono atualiza a propria linha (politica ja existente de perfis).
-- Idempotente. Rode depois da 020.
-- =====================================================================

begin;

alter table public.perfis
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists metas_estudo text[] not null default '{}',
  add column if not exists tempo_diario_estudo text,
  add column if not exists turno_estudo text;

commit;
