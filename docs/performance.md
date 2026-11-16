# Performance (issue #67)

Muitos alunos usam Android de entrada, em 4G ruim. O app precisa abrir
rápido nesse aparelho, não no notebook de quem desenvolve.

## Como medir

```bash
npm run build
npm run check:bundle          # o que baixa para abrir, com teto (roda no CI)
npm run preview &             # porta 4184
npm run medir:abertura        # CPU 4x mais lenta + 4G ruim, mediana de 3
```

`medir:abertura` simula o perfil de celular do Lighthouse (CPU 4x, 1,6
Mbit/s, 150 ms) e mede até o botão "Entrar" aparecer, na primeira visita
(sem cache) e na segunda (com o service worker).

## Números de 2026-11-16

| Medida | Valor | Teto |
| --- | --- | --- |
| JS da abertura (gzip) | 235 KB | 270 KB (`check:bundle`) |
| CSS (gzip) | 23 KB | 27 KB |
| Maior imagem de `/assets` | 56 KB (WebP) | 80 KB |
| Login pronto, 1ª visita, celular simulado | 2,2 s | meta < 3 s |
| Login pronto, 2ª visita (service worker) | 0,3 s | |

Simulação não é aparelho. O critério do issue (abrir em menos de 3 s
em Android de entrada) precisa ser conferido num celular real com o
Chrome remoto (`chrome://inspect`) antes do lançamento.

## O que já foi feito

- **Telas pesadas só baixam quando abertas.** Mermaid (com Cytoscape e
  KaTeX, uns 350 KB gzip), gráficos (Recharts), painéis de cada papel,
  cada aba do aluno, e agora o questionário de primeiro acesso e a troca
  de senha. Se alguém importar uma delas no topo de um arquivo da
  abertura, `check:bundle` falha.
- **Imagens do sagui em WebP**: as 7 imagens usadas pelo app caíram de
  1,8 MB para 300 KB, com a mesma resolução (512 px, o dobro do maior
  tamanho exibido).
- O service worker não baixa os 29 MB de imagens que nenhuma tela usa
  (`globIgnores`, ver `vite.config.ts`).
- Listas longas: o ranking traz no máximo 500 linhas do banco. O
  `FlashList` do issue é do app nativo (M2): fica para quando ele existir.

## O que fica para o app nativo (M2)

Hermes, tamanho do AAB (< 40 MB) e `FlashList` só existem no Expo. Os
pacotes `@mentor/core`, `@mentor/api` e `@mentor/state` já estão prontos
para ele; a medição de abertura vira `adb shell am start -W` no aparelho.

## Fontes

Nunito (5 pesos) e JetBrains Mono (3 pesos) vêm do Google Fonts com
`display=swap`: o texto aparece com a fonte do sistema e troca quando a
fonte chega, sem tela em branco. Todos os pesos de Nunito são usados.
