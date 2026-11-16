# FocusShield (Escudo de Dopamina), módulo Expo

Mede quanto tempo o aluno ficou **com o celular bloqueado** durante uma
sessão de foco. Substitui o código que ficava em `mobile/react-native/`
(que exigia copiar arquivos para o Xcode e mexer no `MainApplication`):
agora é um módulo local da Expo Modules API, ligado sozinho pelo
autolinking em qualquer *development build* ou build de loja.

```
modules/focus-shield/
  index.ts                     API em TypeScript (+ plano B por AppState)
  expo-module.config.json
  android/  FocusShieldModule.kt, ScreenStateService.kt, AndroidManifest.xml
  ios/      FocusShieldModule.swift, FocusShield.podspec
```

## O que cada sistema deixa medir

| | Android | iOS | Web / Expo Go |
| --- | --- | --- | --- |
| Sinal | `SCREEN_OFF` até `USER_PRESENT` | ida ao fundo + aviso de bloqueio | app em segundo plano |
| Acender sem desbloquear | "espiada", não para a contagem | n/a | n/a |
| Trocar de app sem bloquear | não conta | "saída", não conta | **conta** (aproximação) |
| Relógio | `SystemClock.elapsedRealtime` | `CLOCK_MONOTONIC` | `Date.now` |
| Sobrevive à tela apagada | serviço em primeiro plano (`specialUse`) | o iOS suspende o app; a soma é feita na volta | sim, pela diferença de horários |

No iOS o app é suspenso logo depois de bloquear, e o aviso de bloqueio
pode chegar só na volta. Por isso a decisão "bloqueou ou trocou de app"
é tomada quando o app volta a ficar ativo, e não na ida ao fundo.

## Quem paga é o servidor

O número medido aqui é um **teto**. Desde a migration 031 o servidor
carimba o início (`iniciar_sessao_foco`) e o fim (`encerrar_sessao_foco`)
com o próprio relógio e paga o menor entre o que o aparelho mediu e o que
ele viu passar. Mudar a hora do celular não gera moeda; chamar a função
antiga com início e fim inventados deixou de ser permitido.

## Testar

- **Lógica:** `npm test --workspace @mentor/mobile` (medição por AppState)
  e `npm run test:raiz` (as regras da 031 no Postgres).
- **No aparelho:** precisa de um *development build* (`npx expo run:android`
  ou `npx expo run:ios`, ou EAS Build). No Expo Go o módulo não existe e a
  tela avisa que a medição é aproximada.
- Roteiro manual: ativar o escudo, bloquear o celular por 6 minutos,
  desbloquear (abre a pausa consciente), encerrar. Repetir mudando a hora
  do aparelho para 2 horas depois antes de encerrar: o crédito tem que
  ser o mesmo.
