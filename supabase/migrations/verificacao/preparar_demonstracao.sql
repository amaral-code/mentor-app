-- =====================================================================
-- PREPARAR A DEMONSTRAÇÃO PARA OS ORIENTADORES
-- =====================================================================
--
-- ANTES DE RODAR
--   1. Rode a migration 028 (028_conta_demonstracao.sql), uma vez.
--   2. Crie CINCO contas pelo próprio app, na tela de cadastro, como
--      qualquer usuário. Pode escolher "Aluno" em todas: o comando abaixo
--      dá a cada uma o papel certo.
--   3. Troque os cinco e-mails abaixo pelos que vocês usaram.
--
-- DEPOIS
--   Entre com cada conta. Se alguma estiver aberta no navegador, saia e
--   entre de novo para ela pegar o papel novo.
--
-- O ROTEIRO QUE OS DADOS PERMITEM
--   - ALUNO (15 anos): painel com três meses de estudo, consulta marcada
--     com o psicólogo, uma conversa com ele.
--   - RESPONSÁVEL: acompanha esse aluno, com números reais e matérias.
--     Como o aluno tem menos de 16 anos, é aqui que se libera o acesso
--     do psicólogo, ao vivo: a regra da LGPD funcionando.
--   - PROFESSOR: a turma dele, com o Termômetro e os Insights.
--   - SECRETARIA: a escola, e a aba Docentes com o professor vinculado.
--   - PSICÓLOGO: dois pacientes. O aluno (ainda sem dados liberados,
--     até o responsável liberar) e um fictício de 17 anos com
--     prontuário, retificação e consentimento.
--
-- NADA DISSO ENCOSTA EM ALUNO REAL. A vitrine, as consultas, o
-- consentimento e o vínculo de responsável são separados por trigger
-- entre o mundo de demonstração e o real.
-- =====================================================================

select public.preparar_demonstracao(
  'aluno@SEU-EMAIL.com',        -- conta que será o ALUNO
  'responsavel@SEU-EMAIL.com',  -- conta que será o RESPONSÁVEL
  'professor@SEU-EMAIL.com',    -- conta que será o PROFESSOR
  'secretaria@SEU-EMAIL.com',   -- conta que será a SECRETARIA
  'psicologo@SEU-EMAIL.com'     -- conta que será o PSICÓLOGO
);

-- ---------------------------------------------------------------------
-- PARA DESFAZER TUDO (depois da apresentação, ou para recomeçar do zero)
-- Apaga os alunos fictícios e a escola; as cinco contas continuam
-- existindo e voltam a ser alunos comuns. Tire o "--" da linha abaixo.
-- ---------------------------------------------------------------------
-- select public.limpar_demonstracao();
