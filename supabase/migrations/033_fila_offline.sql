-- =====================================================================
-- 033 — Fila offline: cada operação vale uma vez só (issue #56, M5)
-- =====================================================================
--
-- O PROBLEMA
--   Sem internet, o app guarda no aparelho o que o aluno fez (resultado
--   do quiz, XP, placar por tópico) e envia quando a conexão volta. Rede
--   instável significa REENVIO: a resposta se perde no caminho, o app
--   não sabe se chegou, e manda de novo. Com as RPCs comuns, cada
--   reenvio somaria XP outra vez.
--
-- A SOLUÇÃO
--   `aplicar_operacao(chave, tipo, dados, feita_em)`: o app gera uma
--   chave única por operação; o banco guarda as chaves já aplicadas e
--   ignora a repetida. Uma porta só para os três tipos, para a regra de
--   "uma vez só" não depender de cada função lembrar dela.
--
-- CONFLITOS (decisão registrada)
--   • XP e ofensiva contam no dia em que a operação CHEGA ao servidor. O
--     relógio do aparelho não decide: daria para adiantar a data e
--     ganhar ofensiva. Quem estuda offline o dia inteiro e sincroniza no
--     dia seguinte perde aquele dia de ofensiva; é o custo de não confiar
--     no relógio do cliente.
--   • O resultado do quiz guarda a hora em que foi FEITO, presa entre 7
--     dias atrás e agora, para o histórico ficar na ordem certa.
--   • Operação com mais de 7 dias é recusada.
--
-- Rode no SQL Editor.
-- =====================================================================

begin;

create table if not exists public.operacoes_sincronizadas (
  user_id     uuid not null references public.perfis(id) on delete cascade,
  chave       text not null check (length(chave) between 8 and 64),
  tipo        text not null,
  aplicada_em timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Ninguém lê nem grava direto: só a função abaixo.
alter table public.operacoes_sincronizadas enable row level security;

create or replace function public.aplicar_operacao(
  p_chave    text,
  p_tipo     text,
  p_dados    jsonb,
  p_feita_em timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user  uuid := (select auth.uid());
  v_feita timestamptz := coalesce(p_feita_em, now());
  v_gam   public.gamificacao;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_chave is null or length(p_chave) not between 8 and 64 then raise exception 'chave invalida'; end if;
  if v_feita < now() - interval '7 days' then raise exception 'operacao antiga demais'; end if;
  v_feita := least(v_feita, now());

  insert into public.operacoes_sincronizadas (user_id, chave, tipo)
  values (v_user, p_chave, p_tipo)
  on conflict (user_id, chave) do nothing;
  if not found then
    return jsonb_build_object('duplicada', true);
  end if;

  if p_tipo = 'xp' then
    v_gam := public.registrar_xp(
      (p_dados ->> 'tipo')::public.log_tipo,
      coalesce(p_dados ->> 'descricao', ''),
      coalesce((p_dados ->> 'xp')::integer, 0)
    );
    return jsonb_build_object('gamificacao', to_jsonb(v_gam));

  elsif p_tipo = 'quiz_resultado' then
    insert into public.quiz_resultados (user_id, materia, acertos, total, xp_ganho, criado_em)
    values (
      v_user,
      left(coalesce(p_dados ->> 'materia', ''), 80),
      (p_dados ->> 'acertos')::integer,
      (p_dados ->> 'total')::integer,
      greatest(0, least(coalesce((p_dados ->> 'xpGanho')::integer, 0), 500)),
      v_feita
    );
    return jsonb_build_object('ok', true);

  elsif p_tipo = 'desempenho_topico' then
    perform public.registrar_desempenho_topico(
      left(coalesce(p_dados ->> 'materia', ''), 80),
      left(coalesce(p_dados ->> 'topico', ''), 120),
      coalesce((p_dados ->> 'acertou')::boolean, false)
    );
    return jsonb_build_object('ok', true);
  end if;

  raise exception 'tipo de operacao desconhecido: %', p_tipo;
end $$;

grant execute on function public.aplicar_operacao(text, text, jsonb, timestamptz) to authenticated;

commit;

-- =====================================================================
-- Verificação: a mesma chave duas vezes credita uma vez.
--   select public.aplicar_operacao('teste-0001', 'xp', '{"tipo":"quiz","descricao":"t","xp":10}');
--   select public.aplicar_operacao('teste-0001', 'xp', '{"tipo":"quiz","descricao":"t","xp":10}');
--   -- a segunda devolve {"duplicada": true}
-- =====================================================================
