# Observabilidade: erros (#65) e dados de uso (#66)

## Erros (Sentry)

- **Sem SDK.** `packages/core/src/monitoramento.ts` monta o envelope do
  Sentry e envia; no worker, `server/monitoramento.js` faz o mesmo. Um
  teste compara as duas limpezas de dado pessoal.
- **O que sai:** tipo e mensagem do erro, pilha, versão, ambiente e
  rótulos curtos (área da tela, aba, papel). Antes de sair, e-mail,
  token JWT, CPF, telefone, UUID e chave em URL viram marcadores.
- **O que nunca sai:** usuário, IP, texto digitado, conversa, caderno.
- **Onde é capturado:** `ErrorBoundary` (tela que quebrou), erros soltos
  e promessas rejeitadas sem dono (`iniciarMonitoramento` no `main.tsx`),
  e qualquer erro que escape de uma rota do worker (que passa a devolver
  500 genérico, sem detalhe interno).
- **Configuração:** `SENTRY_DSN` nas Environment Variables. O mesmo erro
  só é enviado uma vez por minuto.
- **Pilha legível:** o Sentry precisa dos source maps do build. Pendente:
  ligar `build.sourcemap: 'hidden'` no Vite e subir os mapas no deploy
  (`sentry-cli sourcemaps upload`), o que exige um token do Sentry no CI.

## Dados de uso (PostHog)

Regras em `packages/core/src/analytics.ts`:

- desligado por padrão, liga com o consentimento no Perfil ("Dados de uso");
- **menor de 16, ou sem data de nascimento, não liga.** Pela LGPD o
  consentimento seria do responsável, e esse fluxo não existe para
  analytics. Decisão conservadora para revisar com o jurídico;
- identificador = SHA-256 do id da conta; `$process_person_profile: false`
  e `$ip: null` (sem perfil de pessoa, sem IP);
- só os eventos e as propriedades do plano abaixo saem; o resto é cortado.

### Plano de eventos

| Evento | Quando | Propriedades |
| --- | --- | --- |
| `app_aberto` | sessão carregada | nenhuma |
| `onboarding_concluido` | fim do questionário inicial | `pulou_data` |
| `quiz_concluido` | fim do quiz | `materia`, `questoes`, `faixa_acerto`, `offline` |
| `redacao_corrigida` | correção digitada pronta | `origem` |
| `mentor_pergunta` | pergunta enviada ao Mentor | `modo` |
| `convite_compartilhado` | link de liga ou de vínculo enviado | `tipo` |
| `foco_concluido`, `revisao_feita`, `notificacoes_ligadas` | previstos no plano, ainda sem chamada | |

### Funis e retenção (para montar no PostHog)

- **Ativação:** `app_aberto` → `onboarding_concluido` → `quiz_concluido`
  (primeiro quiz) → `redacao_corrigida` (primeira redação).
- **Retenção D1/D7/D30:** evento inicial `onboarding_concluido`, evento de
  retorno `app_aberto`.
- **Uso por funcionalidade:** contagem semanal de cada evento por pessoa.

Como só quem consente (e tem 16 anos ou mais) entra, os números são de
uma amostra. Para a decisão de go/no-go do beta (#74), combine com os
agregados do próprio banco (quiz_resultados, telemetria), que cobrem todos.

**Pendente para o critério de aceite da #66:** criar o projeto no PostHog
(região UE), colar a chave em `POSTHOG_KEY` e montar o dashboard com os
funis acima. Isso é feito no painel do PostHog, fora do código.
