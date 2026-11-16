-- =====================================================================
-- 033 — Objetivo do aluno no primeiro acesso: curso, universidade e data
-- da prova (#33)
-- =====================================================================
--
-- O primeiro acesso do app nativo pergunta para onde o aluno vai: o
-- curso, a universidade e quando é a prova. É o que dá sentido à
-- contagem regressiva da Central e, no futuro, ao plano de estudos.
--
-- Colunas soltas em `perfis`, todas opcionais (quem pula segue no app).
-- O dono já edita o próprio perfil (policy perfis_upd_proprio, 003) e a
-- trava de campos (007) não as cobre: não há policy nova. A data aceita
-- só o intervalo que faz sentido (de hoje a 3 anos), o que barra o ano
-- digitado errado sem decidir a prova pelo aluno.
-- =====================================================================

begin;

alter table public.perfis
  add column if not exists curso_desejado        text check (curso_desejado is null or char_length(curso_desejado) <= 80),
  add column if not exists universidade_desejada text check (universidade_desejada is null or char_length(universidade_desejada) <= 80),
  add column if not exists data_prova            date;

-- Validação em gatilho (e não CHECK): CHECK com current_date ficaria
-- falso para linhas antigas assim que a data passasse.
create or replace function public.valida_data_prova()
returns trigger
language plpgsql as $$
begin
  if new.data_prova is distinct from old.data_prova and new.data_prova is not null
     and (new.data_prova < current_date - 1 or new.data_prova > current_date + interval '3 years') then
    raise exception 'data da prova fora do intervalo';
  end if;
  return new;
end $$;

drop trigger if exists perfis_valida_data_prova on public.perfis;
create trigger perfis_valida_data_prova
  before update on public.perfis
  for each row execute function public.valida_data_prova();

commit;
