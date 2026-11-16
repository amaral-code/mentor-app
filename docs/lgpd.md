# LGPD e ECA (issue #70)

O público é majoritariamente menor de idade, e o app guarda dado de
saúde mental. Este documento é o inventário que a equipe mantém; não é
parecer jurídico. **Antes do lançamento, um advogado precisa revisar a
política, os termos e este inventário.**

## O que já está no app

| Exigência | Onde |
| --- | --- |
| Exclusão de conta dentro do app (lojas, art. 18, VI) | Perfil (aluno) e "Sua conta, privacidade e sugestões" no fim dos outros painéis. Rota `/api/conta/excluir` |
| Exportação dos dados (art. 18, II e V) | Mesmo lugar, "Baixar meus dados". RPC `exportar_meus_dados` (037) |
| Política de privacidade e termos linkados no app | `/legal/privacidade.html` e `/legal/termos.html` (também `/privacidade` e `/termos` na Vercel). **Rascunhos** |
| Regra dos 16 anos para o psicólogo | Migration 027 (ver CLAUDE.md) |
| Dados de uso só com consentimento, nunca de menor de 16 | `podeRastrear` (`@mentor/core/analytics`) |
| Responsável vê só agregado | Migration 025 |

## Exclusão: o que acontece

1. O servidor confere a sessão e a palavra `EXCLUIR`.
2. `preparar_exclusao_conta` (037): as notas de prontuário de quem foi
   **paciente** perdem a ligação com a conta e guardam só o nome. O
   psicólogo é obrigado a mantê-las por 5 anos (CFP Res. 001/2009), e a
   LGPD (art. 16, I) permite reter para cumprir obrigação legal. Grava
   em `exclusoes_conta` só o papel e a data.
3. Apaga as fotos de redação do Storage (`essay_scans/<uid>/`).
4. Apaga o usuário no Auth; `perfis` e todas as tabelas saem em cascata.

Os dados saem na hora. O critério do issue ("em até 15 dias") depende
também das **cópias de segurança do Supabase**: no plano Pro, 7 dias de
backup diário; com PITR, o prazo configurado. Escreva o prazo real na
política (campo `[PRAZO DAS CÓPIAS DE SEGURANÇA]`).

Psicólogo que exclui a própria conta leva junto as notas que escreveu.
A tela avisa e pede que ele baixe os dados antes.

## Inventário de dados (base do RIPD)

| Categoria | Tabelas | Titular | Sensível? |
| --- | --- | --- | --- |
| Cadastro | `perfis` | todos | não (data de nascimento identifica menor) |
| Estudo | `logs`, `quiz_*`, `telemetria_estudo`, `revisoes_espacadas`, `notas`, `redacoes`, `planos_diarios`, `sessoes_foco` | aluno | não |
| Conversa com IA | `chat_mensagens`, `conversas_chat`, `log_intervencoes_ia` | aluno | pode conter relato de saúde |
| Bem-estar | `humor_historico`, `indice_burnout`, `alertas_saude_mental` | aluno | **sim** (saúde, art. 11) |
| Atendimento | `agendamentos`, `prontuario_notas`, `mensagens_apoio`, `consentimentos_dados` | aluno, responsável, psicólogo | **sim** |
| Vínculos | `vinculos_responsavel`, `turma_professores` | aluno, responsável, professor | não |
| Avisos | `notificacoes`, `push_inscricoes`, `preferencias_notificacao` | todos | não |
| Beta | `feedback_beta` | todos | não |

Operadores (quem recebe dado em nome do app): Supabase, DeepSeek, Google
(Gemini e Text to Speech), Resend, Mercado Pago, Sentry, PostHog (só com
consentimento) e Jitsi. Vários estão fora do Brasil: a política precisa
da base de transferência internacional (art. 33).

## O que falta e é decisão do dono

- [ ] Nomear o **encarregado (DPO)** e o e-mail de contato; preencher os
      campos entre colchetes da política e dos termos.
- [ ] Revisão jurídica da política, dos termos e do RIPD.
- [ ] **Menores de 12** (art. 14, §1º): consentimento específico de um
      dos pais. Hoje o app não pede a idade antes do cadastro; a decisão
      é entre bloquear o cadastro abaixo de 12 ou exigir o vínculo do
      responsável antes de liberar o app.
- [ ] Minimizar dado de saúde: avaliar se `humor_historico` e o texto
      das conversas precisam ficar guardados por tempo indeterminado
      (sugestão: apagar conversa com mais de 12 meses).
- [ ] Sala do psicólogo: o Jitsi público não tem controle de entrada.
