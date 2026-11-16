# @mentor/core

Lógica de negócio do Midnight Mentor, **sem dependência de plataforma**. O mesmo código roda no app web (Vite), no app mobile (Expo/React Native) e nos testes em Node.

## O que tem aqui

| Área | Módulos |
| --- | --- |
| Tipos do domínio | `types` |
| Estudo | `srsEngine`, `quizBank`, `quizLotes`, `quizHistory`, `kbEnem`, `kbSearch`, `plannerEngine`, `challengeBank`, `audioPills` |
| Bem-estar | `sscCalculator`, `emotionEngine`, `burnoutModel`, `decompressionReport`, `focusShield`, `focusLogic`, `frustration`, `dropoutRisk` |
| Comunidade e gamificação | `ligasEngine`, `moderationEngine`, `storeCatalog`, `storeEngine`, `salaFoco`, `termometroCognitivo` |
| Vínculos e consentimento | `vinculoCodigo`, `consentimento`, `bookingEngine` |
| IA | `aiProvider`, `aiService`, `essayCorrector`, `contextMemory` |
| Infra | `plataforma`, `runtimeConfig`, `safeStorage`, `comTimeout`, `utils`, `onboardingLocal` |

## Como importar

Cada módulo é um *subpath*. Não existe um `index` único, para não haver colisão de nomes e para o bundler carregar só o que a tela usa.

```ts
import { somarDias } from '@mentor/core/srsEngine';
import type { QuizQuestion } from '@mentor/core/types';
```

## Regras

1. **Nada de navegador.** `window`, `document`, `localStorage`, `navigator` e `location` são barrados pelo lint (`.oxlintrc.json`). O que muda entre plataformas passa por `@mentor/core/plataforma`.
2. **Nada de `import.meta.env`.** O Metro (bundler do Expo) não entende essa sintaxe. Use `plataforma().envBuild('NOME')` ou, melhor, as funções de `runtimeConfig`.
3. **Ler a plataforma só dentro de funções**, nunca no topo do módulo. O app instala os adaptadores no boot, depois que os imports já rodaram.
4. **Lógica nova vai para cá**, não para dentro de uma tela. Assim web e mobile ganham a mesma regra, com teste.
5. Texto que o usuário lê também segue a regra de escrita do `CLAUDE.md` (sem travessão nem hífen solto). O teste `regraPontuacao` varre este pacote.

## Plataforma

Cada app instala a sua implementação antes de qualquer outra coisa:

```ts
// apps/web/src/plataforma/web.ts (primeiro import de main.tsx)
configurarPlataforma({
  armazenamento: () => localStorage,
  envBuild: (nome) => import.meta.env[nome] ?? '',
  online: () => navigator.onLine,
  dev: () => import.meta.env.DEV,
});
```

No mobile (M2), o armazenamento será o MMKV (síncrono, como o `localStorage`), o env virá de `process.env.EXPO_PUBLIC_*` e o `online` do NetInfo. Em testes, use `criarArmazenamentoEmMemoria()`.

## O que ficou no app web, e por quê

| Módulo | Motivo |
| --- | --- |
| `acessibilidade` | Aplica classes no `<html>`; no mobile será feito com fontScale e o tema nativo |
| `idleTracker`, `scrollLock` | Eventos de DOM (rolagem, foco da aba) |
| `imagePrep` | Usa `<canvas>` para comprimir; no mobile será `expo-image-manipulator` |
| `sfx` | Web Audio e `speechSynthesis`; no mobile será `expo-audio` e `expo-speech` |
| `motionPresets` | Específico do `motion/react` (web) |
| `chatGrounding`, `essayScan` | Importam `server/chatPrompt.js` e `server/essaySchema.js`; vão para cá quando o contrato com o servidor virar um pacote próprio |
| `navegacaoAbas` | Navegação por abas do web; o mobile usa Expo Router |

## Comandos

```bash
npm run typecheck --workspace @mentor/core
npm test --workspace @mentor/core
```
