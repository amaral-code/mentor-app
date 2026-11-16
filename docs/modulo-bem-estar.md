# Módulo de bem-estar, marketplace e foco offline

Documento de referência das 7 funcionalidades adicionadas ao Ampli-IA.
Cobre o que foi construído, onde cada peça vive e — principalmente — por
que as decisões estruturais foram tomadas assim.

Migrações: `supabase/migrations/010_bemestar_marketplace_foco.sql`
(tabelas) e `011_bemestar_funcoes_rls.sql` (funções, RLS, seeds).
Rode nessa ordem, uma vez, no SQL Editor do Supabase.

---

## Nomes das tabelas

O pedido original usava nomes em inglês; o schema do projeto é em
português (`perfis`, `gamificacao`, `sessoes_foco`). Mantivemos o padrão
do projeto para não criar duas convenções no mesmo banco:

| Pedido | Tabela criada | Observação |
|---|---|---|
| `Users` (roles Student/Parent/Psychologist) | `perfis` + enum `papel_usuario` | Já existia. Ganhou o valor `psychologist` e a ficha `psicologos` |
| `MentalHealthAlerts` | `alertas_saude_mental` | |
| `Appointments` | `agendamentos` | `inicio`, `fim`, `meeting_url`, `status_pagamento` |
| `FocusSessions` | `sessoes_offline` | `inicio`, `fim`, `minutos_offline` |
| `UserWallet` | `carteira_foco` + `extrato_foco` | |
| `StudyTelemetry` | `telemetria_estudo` | |
| `BurnoutIndex` | `indice_burnout` | 1 linha por usuário por dia |
| `AudioModules` | `modulos_audio` | |
| `UserAudioProgress` | `progresso_audio` | |
| `SpacedReviews` | `revisoes_espacadas` | |
| `AI_Interventions_Log` | `log_intervencoes_ia` | |
| `WeeklyReports` | `relatorios_semanais` | |

Tabelas de apoio: `vinculos_responsavel`, `psicologo_disponibilidade`,
`notificacoes`, `push_assinaturas`.

---

## Princípio que atravessa tudo

**Nada que valha dinheiro, moeda ou acesso a dado de terceiro é escrito
pelo cliente.** É a mesma regra que a migração 003 aplicou ao XP, agora
estendida:

| Operação | Quem executa | Por quê |
|---|---|---|
| Creditar moeda de foco | `creditar_moedas_foco()` | O servidor recalcula os minutos pelo relógio dele. Aceitar o total do cliente seria saldo infinito por `fetch` no console |
| Confirmar pagamento e criar sala | webhook do provedor → `confirmar_pagamento_consulta()` (revogada de `authenticated`) | Se o navegador pudesse marcar "pago", a consulta seria gratuita |
| Disparar alerta aos pais | `registrar_burnout()` | Garante 1 alerta por dia — uma tarde ruim não pode virar 40 e-mails |
| Reservar horário | `agendar_consulta()` + constraint `EXCLUDE` | Dois cliques simultâneos no mesmo horário só são resolvidos por constraint |
| Enviar e-mail | fila `notificacoes` + worker | O alerta não pode depender de o navegador do responsável estar aberto |

---

## 1. Marketplace de psicólogos e painel dos pais

**Arquitetura de booking.** Não existe tabela de slots. O profissional
declara **janelas semanais** (`psicologo_disponibilidade`: segunda,
14h–20h) e os horários concretos são derivados delas, descontando o
ocupado. Materializar slots geraria centenas de milhares de linhas por
ano cuja única informação é "ninguém marcou aqui", e mudar a agenda
viraria migração de dados.

- previsão na tela: `src/shared/lib/bookingEngine.ts` (`gerarSlots`)
- verdade: `slots_livres()` no banco, revalidada por `agendar_consulta()`
- corrida resolvida por `EXCLUDE USING gist (psicologo_id, tstzrange(inicio, fim))`

**Fluxo completo:** alerta dispara → painel dos pais mostra o card com
botão → catálogo (valor visível antes de qualquer clique) → dia →
horário → `agendar_consulta` cria a consulta `pendente` → worker abre o
checkout → webhook confirma, cria a sala e enfileira e-mails para
aluno, responsável e psicólogo.

**Sala de vídeo.** Google Meet e Zoom exigem OAuth do profissional
(consentimento + refresh token no servidor). Enquanto isso não existe, o
worker cria uma sala **Jitsi**: link https, sem cadastro, abre no
navegador do celular; o nome carrega o id do agendamento mais um sufixo
aleatório para não ser adivinhável. Trocar de provedor mexe em uma única
função (`criarSala` em `server/worker.js`) — o app só lê `meeting_url`.

**Notificação.** `notificacoes` é uma **fila**, não um envio: o banco
insere, o worker (`POST /notify/drain`, cron de 5 min) entrega por e-mail
(Resend) e push. Cada alerta gera três linhas — `email`, `push`,
`in_app`.

**Privacidade.** O responsável vê padrão (índice, constância, tempo
offline, alertas, relatório semanal) e **nunca** conteúdo: não há policy
de leitura para `chat_mensagens`, `notas` ou `humor_historico`. E o
vínculo é aprovado pelo estudante — enquanto está `pendente`, o painel
não mostra nada. Um adolescente que se sabe lido para de escrever no
Mentor, que é justamente de onde vêm os sinais.

Arquivos: `features/marketplace/*`, `features/parent/PainelCuidado.tsx`,
`features/cuidado/CuidadoPage.tsx`, `stores/marketplaceStore.ts`,
`shared/storage/MarketplaceRepository.ts`.

---

## 2. Escudo de dopamina

`src/shared/lib/focusShield.ts` — a mesma fórmula existe em
`creditar_moedas_foco()`, e o teste garante que não divirjam.

```
moedas = floor(minutos × faixa × modo × penalidade)

faixa:      <5min 0 | <15 0,5 | <25 1,0 | <50 1,25 | <90 1,5 | 90+ 1,75
modo:       leve 0,8 | enem 1,0 | maratona 1,2
penalidade: max(0,4 ; 1 − 0,1 × interrupções)
teto:       500 moedas/dia
```

Três decisões: **faixas em vez de linear** (pagar desde o minuto zero
premiaria trancar a tela por 3 minutos, que é o comportamento ansioso que
se quer reduzir); **interrupção pesa mas não zera** (zerar ensina a
desistir depois do primeiro deslize); **teto diário** (senão o celular na
gaveta durante a aula vira farm).

**Web:** Page Visibility API — mede a aba, não a tela; acerta o caso
principal e erra quando o aluno troca para outro app.
**Nativo:** `apps/mobile/modules/focus-shield/` (Expo Module) lê o estado real —
`ACTION_SCREEN_OFF`/`USER_PRESENT` no Android (com serviço em primeiro
plano, porque o Android 8+ mata processos em background em minutos) e
`protectedDataWillBecomeUnavailable` no iOS. Contagem com relógio
monotônico: mudar a hora do aparelho não gera moeda.

---

## 3. Motor de predição de fadiga

`src/shared/lib/burnoutModel.ts` — regressão logística em JS puro, 7
features, treino por gradiente descendente com L2.

**Por que não Random Forest:** floresta acerta mais com dezenas de
milhares de exemplos, e cada aluno gera algumas dezenas de dias
rotulados. Com poucos dados ela decora e, pior, não explica — e a
explicação é o produto: o painel dos pais precisa dizer "pesou madrugada
+ queda de rendimento". Cada peso se lê como contribuição. `treinarLogistica`
devolve pesos no mesmo formato de `PESOS_PADRAO`, então trocar o
estimador depois não muda nada do lado de fora.

Features (o cruzamento pedido, erro × horário):
`taxaErro`, `excessoTempoFacil`, `quedaRendimento`, `fracaoMadrugada`,
`horasEstudoDia`, `diasSemPausa`, `deficitSono`.

`excessoTempoFacil` é o sinal mais precoce: travar numa questão fácil
significa ler três vezes sem processar.

Classes: `saudavel` <35, `alerta` 35–59, `fadiga` 60–79, `esgotamento`
80+. A partir de `fadiga`, `deveBloquearConteudoDenso` encolhe o quiz de
10 para 3 questões e o dashboard oferece pausa, áudio ou escudo — o app
não some com o conteúdo, ele para de exigir duas horas de concentração de
quem hoje não tem duas horas de concentração.

**Os pesos iniciais são sintéticos** (literatura de burnout acadêmico +
o que o app já media) e existem para funcionar no dia 1. Devem ser
substituídos por `treinarLogistica` assim que houver rótulos reais.

Telemetria em lotes de 10 (`bemEstarStore`), com flush no
`visibilitychange` — 90 inserts num simulado travariam a tela em 4G.

---

## 4. Pílulas de áudio

- roteiro: `gerarRoteiroAudio()` com prompt que proíbe o que não funciona
  no ouvido ("observe a figura", fórmula soletrada, tabela);
- voz: `POST /tts` no worker → Google Cloud TTS (`pt-BR-Neural2-*`,
  perfil `headphone-class-device`, −2 dB). A chave cobra por caractere e
  por isso nunca vai ao navegador;
- sem worker configurado, o player cai na `SpeechSynthesis` do sistema —
  pior voz, mas offline e sem custo, e a interface **diz** que o áudio
  para se a tela apagar em vez de deixar o aluno descobrir no ônibus;
- 3 minutos ≈ 450 palavras a 150 ppm (`estimarDuracaoSegundos`);
- progresso salvo a cada 15 s: o ônibus chega antes do fim mais vezes do
  que não chega.

O mp3 **não** é gravado no banco (1,5 MB por pílula; ressintetizar custa
frações de centavo). O roteiro, que é o caro de produzir, fica.

---

## 5. Calendário adaptativo (Ebbinghaus)

`src/shared/lib/srsEngine.ts` + `registrar_revisao()` no banco.

Intervalos base 1, 3, 7, 21, 45, 90 dias; fator de facilidade do SM-2
(`EF' = EF + (0,1 − (5−q)(0,08 + (5−q)·0,02))`, piso 1,3).

A diferença em relação ao SM-2 clássico: **o `q` sai da nota do quiz**
(0–100 ÷ 20), não de uma autoavaliação. Adolescente cansado não se
autoavalia com honestidade, e um passo a mais na interface é um passo a
mais para abandonar.

- nota ≥ 80 → sobe um nível
- 60–79 → mantém, com intervalo ajustado pela facilidade
- < 60 → volta ao nível 0 com revisão amanhã (empurrar para 3 dias o que
  a pessoa não sabe garante que ela não saiba dali a 3 dias também)

Teto de 8 revisões por dia: depois de uma semana parado a fila acumula, e
uma lista de 30 itens vermelhos é um convite a fechar o app.

---

## 6. Intervenção de doomscrolling

`src/shared/lib/idleTracker.ts` + `src/shared/ui/DoomscrollGuard.tsx`.

Dispara quando as três condições valem juntas:

1. 2 minutos desde o início da janela;
2. rolagem contínua (≥ 8 eventos) — exclui quem largou o celular;
3. **nenhuma ação de compromisso** (clique em botão/link, digitação) —
   exclui quem está lendo com atenção.

Cooldown de 15 minutos. A interface escurece em 400 ms (fade, sem susto),
clicar fora fecha, e a proposta é **uma só** — oferecer opções a alguém
em paralisia por análise é repetir o problema. O prompt do Gemini está em
`gerarIntervencaoDoomscroll()` e devolve JSON de três campos (título ≤ 6
palavras, convite ≤ 20 palavras terminando em pergunta, botão ≤ 4
palavras), com um fallback local que aparece imediatamente enquanto a IA
responde.

Aceitar leva direto a 3 questões prontas. A resposta (sim/não) vai para
`log_intervencoes_ia` — é assim que se descobre se a intervenção ajuda ou
irrita.

---

## 7. Relatório de descompressão semanal

`src/shared/lib/decompressionReport.ts` + `WeeklyReportModal`.

Gerado na sexta (e ainda no sábado/domingo para quem não abriu), uma vez
por semana — a checagem usa a última semana já gravada, não um flag
local.

O prompt de sistema (`SYSTEM_PROMPT_DESCOMPRESSAO`) fica separado do
prompt de dados de propósito: o system carrega a **postura** (o que nunca
fazer) e o user carrega os números. Misturados, o modelo trata as regras
como sugestão justamente quando os números são ruins — o caso em que elas
mais importam.

Regras: um parágrafo, no máximo 4 frases, pelo menos um número concreto,
sem cobrança, sem comparação, sem "parabéns!!", sem promessa de
aprovação. Métricas: dias ativos, minutos offline, minutos de foco, sono
médio, questões, revisões no prazo, noites de madrugada, streak.

Existe uma versão **local** escrita sob as mesmas regras: uma promessa
semanal não pode quebrar por falta de rede justamente na semana em que a
pessoa mais precisa dela. O mesmo texto chega ao responsável.

---

## Testes

```bash
npm test        # 224 testes: engines, cliente de IA, worker e migrações
```

Três camadas, porque cada uma pega um tipo diferente de defeito:

**1. Engines puros** (`src/shared/lib/__tests__/`) — `focusShield` (fórmula
e teto), `srsEngine` (curva e reinício), `bookingEngine` (slots,
sobreposição, antecedência, cancelamento), `burnoutModel` (separação de
classes, extração de features, treino), `idleTracker` (as três condições e
o cooldown), `decompressionReport` (janela de 7 dias, gatilho de sexta) e
`aiService.bemestar` (o que cada prompt exige, com `fetch` simulado).

**2. Worker** (`server/__tests__/worker.test.mjs`) — o handler roda de
verdade com `env` de mentira e todo fetch de saída interceptado. Cobre
quem pode pagar, quem pode confirmar pagamento, sanitização do TTS,
whitelist de modelo e a fila de e-mail. Foi ele que pegou o texto só com
espaços indo para a API paga de TTS.

**3. Migrações num Postgres real** (`supabase/__tests__/migracoes.test.mjs`,
via PGlite/WASM) — aplica os 9 arquivos SQL, cria aluno, responsável,
psicólogo e um estranho, e exercita o fluxo inteiro com RLS ligada:
agendamento e bloqueio de horário duplicado, confirmação de pagamento
restrita ao webhook, teto de moedas, alerta único por dia, curva de SRS e
a fronteira de privacidade (o responsável não lê chat, notas nem humor).

Essa terceira camada pegou três defeitos que passariam pelo build e só
apareceriam ao colar o SQL no Supabase:

| Defeito | Sintoma que teria dado |
|---|---|
| valor de enum novo usado na mesma transação | `unsafe use of new value "psychologist"` — a migração 010 inteira abortava |
| função `language sql` declarada antes da tabela que consulta | `relation "public.agendamentos" does not exist` |
| `CASE` devolvendo `text` para coluna enum | `solicitar_vinculo` quebrava no segundo pedido do mesmo responsável |

Também há verificação de alcance real das APIs do Google (endpoint e
formato aceitos, recusando apenas a credencial) — feita manualmente, não
no `npm test`, para não depender de rede.

`focusShield` (fórmula e teto), `srsEngine` (curva e reinício),
`bookingEngine` (slots, sobreposição, antecedência, política de
cancelamento), `burnoutModel` (separação de classes, extração de
features, treino), `idleTracker` (as três condições e o cooldown),
`decompressionReport` (janela de 7 dias, gatilho de sexta, texto).

---

## Personas: o professor de matéria fica na matéria

`ChatPersona` ganhou o campo `escopo`, e `montarInstrucaoDaPersona()`
(em `aiService.ts`) monta o system instruction em blocos: **PAPEL**,
**ESCOPO** e **PRECEDÊNCIA**. Antes o limite era uma frase solta
("responda apenas sobre matemática") no meio de um parágrafo, sem dizer
o desfecho para pergunta de fora — e disputando espaço com um pedido de
tom oposto ("estilo analítico de pesquisador" contra "frases curtas,
linguagem acessível"). Instrução contraditória não é cumprida pela
metade: o modelo escolhe uma.

Agora o bloco de escopo diz o que fazer: nomear a área, indicar o
professor certo do app, não responder o conteúdo — e traz a exceção que
o produto exige: **cansaço, ansiedade e medo da prova nunca são fora de
escopo**. Um professor que responde "isso não é comigo" para quem disse
que não está aguentando quebraria o propósito do app.

Persona criada pelo usuário continua sem escopo: inventar um limite que
ele não pediu faria a persona dele recusar as próprias perguntas.

Migração `012_persona_ativa_texto.sql` corrige o efeito colateral que
existia junto: `preferencias.persona_ativa_id` era `bigint`, e os
professores embutidos têm id em texto (`prof_matematica`), então a
escolha era gravada como `NULL` e o app voltava ao Mentor geral depois
de um F5.

Coberto por `src/shared/lib/__tests__/personaEscopo.test.ts`.

---

## Estado da implantação

O código está completo e verificado; o que falta é ato de operação, não
de desenvolvimento:

| Item | Estado |
|---|---|
| Migrações 010/011/012 | **pendente no projeto Supabase** — validadas em Postgres real, mas ainda não aplicadas (as tabelas retornam `PGRST205` na API) |
| Psicólogos cadastrados | nenhum — depende de `registrar_psicologo()` após a migração |
| Worker publicado | não — sem `VITE_AI_BASE_URL` no `.env`, o app usa a chave Gemini pessoal do aluno e o player de áudio cai na voz do sistema |
| Pagamento | modo demonstração enquanto `MP_ACCESS_TOKEN` não existir |

Para aplicar: SQL Editor do Supabase, `010`, `011` e `012`, nessa ordem, uma vez cada.
