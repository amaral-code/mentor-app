# @mentor/state

Stores Zustand do Midnight Mentor, compartilhadas entre o app web e o mobile.

| Store | O que guarda |
| --- | --- |
| `appStore` | Sessão, chat, XP e gamificação, plano do dia e aba ativa (só no web) |
| `bemEstarStore` | Telemetria de estudo, foco offline, índice de burnout |
| `marketplaceStore` | Catálogo de psicólogos e consultas |
| `storeStore` | Inventário da Loja do Sagui |
| `mascotStore` | Estado do mascote |

```ts
import { useAppStore } from '@mentor/state/appStore';
```

## Persistência

Nada aqui usa o `persist` do Zustand com `localStorage`. O que precisa durar vai para o Supabase pelos repositórios de `@mentor/api`. O pouco que fica no aparelho, como a chave de IA própria, passa por `safeSet` de `@mentor/core/safeStorage`, e a plataforma decide onde gravar: `localStorage` no web, MMKV no celular.

## O que depende do boot do app

- `registrarDescargaAoSair()` (bemEstarStore) grava a telemetria pendente quando o app vai para segundo plano. Cada app chama no boot; o web faz isso em `main.tsx`.
- O checkout do pagamento sai do app com `plataforma().abrirUrl()`.

## `activeTab`

A navegação do **web** é por estado (`activeTab` no `appStore`), e continua aqui porque o web inteiro depende dela. O app mobile usa Expo Router e ignora esse campo. Ele sai da store quando o web migrar para o Expo Router (M6).
