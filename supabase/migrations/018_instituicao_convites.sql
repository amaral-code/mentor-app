-- =====================================================================
-- Codigo da instituicao + convites confidenciais por turma
--
-- Fluxo (pagamento acontece no site, fora do app):
--   1. A secretaria paga no site e recebe o acesso educacional.
--   2. No painel, ela importa CSV/tabela; a IA normaliza e o servidor
--      cria as contas (aluno, responsavel, docente) com senha temporaria
--      de uso unico + link magico de confirmacao por email.
--   3. Cada conta recebe por email: login, senha temporaria, link magico,
--      codigo da INSTITUICAO e codigo da TURMA.
--   4. No primeiro acesso, a troca de senha e obrigatoria
--      (perfis.deve_trocar_senha) e o aluno vincula instituicao + turma
--      pelos codigos no Perfil.
--
-- Seguranca:
--   - Codigo da instituicao (8 letras) identifica a escola; codigo da
--     turma (6 letras, migration 007) identifica a sala. Ambos sao
--     conferidos no SERVIDOR (RPCs); o cliente nunca grava escola/turma
--     direto (trigger trava_campos_perfil continua valendo).
--   - Senha temporaria so existe no email de boas-vindas e morre no
--     primeiro login (deve_trocar_senha). O app nunca exibe senha de
--     ninguem em tela.
--
-- Rode no SQL Editor. Idempotente.
-- =====================================================================

-- Papel docente (professor em sala; diferente de educator/secretaria).
-- FORA da transacao de proposito: ADD VALUE de enum nao roda dentro de
-- bloco transacional em varias versoes do Postgres.
do $$ begin
  alter type public.papel_usuario add value if not exists 'teacher';
exception when duplicate_object then null; end $$;

begin;

-- Codigo confidencial da instituicao: 8 letras, unico por escola.
alter table public.escolas
  add column if not exists codigo_instituicao text unique
  default upper(substr(md5(random()::text), 1, 8));

update public.escolas
   set codigo_instituicao = upper(substr(md5(random()::text || id::text), 1, 8))
 where codigo_instituicao is null;

-- Troca de senha obrigatoria no primeiro acesso (contas importadas).
alter table public.perfis
  add column if not exists deve_trocar_senha boolean not null default false;

-- ---------------------------------------------------------------------
-- vincular_instituicao(p_codigo)
--
-- Vincula o proprio perfil a escola pelo codigo da instituicao, sem
-- tocar na turma (a sala entra depois, pelo codigo da turma no Perfil).
-- Erro generico de proposito: nao revela se o codigo existe.
-- ---------------------------------------------------------------------
create or replace function public.vincular_instituicao(p_codigo text)
returns public.perfis
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_escola public.escolas;
  v_perfil public.perfis;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  select * into v_escola from public.escolas
   where upper(codigo_instituicao) = upper(trim(p_codigo));
  if not found then
    raise exception 'codigo invalido';
  end if;

  perform set_config('app.matricula_em_curso', 'on', true);

  update public.perfis
     set escola_id = v_escola.id
   where id = v_user
   returning * into v_perfil;

  perform set_config('app.matricula_em_curso', 'off', true);

  if v_perfil.id is null then
    raise exception 'perfil nao encontrado';
  end if;
  return v_perfil;
end $$;

grant execute on function public.vincular_instituicao(text) to authenticated;

-- ---------------------------------------------------------------------
-- regenerar_codigo_turma(p_turma_id)
--
-- A secretaria invalida um codigo vazado e gera outro na hora. So quem
-- e educator/admin DAQUELA escola pode regenerar (confere pelo proprio
-- perfil, nao por parametro do cliente).
-- ---------------------------------------------------------------------
create or replace function public.regenerar_codigo_turma(p_turma_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_papel  text;
  v_escola uuid;
  v_novo   text;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  select papel::text, escola_id into v_papel, v_escola
    from public.perfis where id = v_user;
  if v_papel is null or v_papel not in ('educator', 'admin') then
    raise exception 'sem permissao';
  end if;

  v_novo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  update public.turmas
     set codigo = v_novo
   where id = p_turma_id
     and (v_papel = 'admin' or escola_id = v_escola);
  if not found then
    raise exception 'turma nao encontrada';
  end if;
  return v_novo;
end $$;

grant execute on function public.regenerar_codigo_turma(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- regenerar_codigo_instituicao(p_escola_id)
--
-- Mesmo motivo: vazou o codigo da escola, gera outro. Educador da
-- propria escola ou admin.
-- ---------------------------------------------------------------------
create or replace function public.regenerar_codigo_instituicao(p_escola_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := (select auth.uid());
  v_papel  text;
  v_escola uuid;
  v_novo   text;
begin
  if v_user is null then
    raise exception 'nao autenticado';
  end if;

  select papel::text, escola_id into v_papel, v_escola
    from public.perfis where id = v_user;
  if v_papel is null or v_papel not in ('educator', 'admin') then
    raise exception 'sem permissao';
  end if;

  v_novo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  update public.escolas
     set codigo_instituicao = v_novo
   where id = p_escola_id
     and (v_papel = 'admin' or id = v_escola);
  if not found then
    raise exception 'escola nao encontrada';
  end if;
  return v_novo;
end $$;

grant execute on function public.regenerar_codigo_instituicao(uuid) to authenticated;

commit;

-- =====================================================================
-- Verificacao:
--   select id, nome, codigo_instituicao from public.escolas;
--   select public.vincular_instituicao('ABCDEFGH');
-- =====================================================================
