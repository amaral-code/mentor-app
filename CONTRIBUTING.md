# Como contribuir com o Midnight Mentor

Guia rápido para a equipe trabalhar do mesmo jeito.

## 1. Preparar o ambiente

```bash
nvm use            # Node da versão em .nvmrc
npm install
cp .env.example .env
npm run dev
```

Peça os valores do `.env` no **cofre de senhas da equipe**. Nunca mande chaves por chat, e-mail ou issue.
Use o ambiente de **dev/staging** para desenvolver; veja [docs/ambientes.md](docs/ambientes.md).

## 2. Pegar uma tarefa

1. Escolha uma issue do milestone atual no [quadro do projeto](../../milestones).
2. Atribua a issue a você (*Assignees*) antes de começar, para ninguém fazer em dobro.
3. Dúvida sobre o escopo? Comente na própria issue.

## 3. Branch

Sempre a partir da `main` atualizada. Ninguém faz push direto na `main`.

| Tipo de trabalho | Nome da branch |
| --- | --- |
| Funcionalidade | `feat/<numero-da-issue>-descricao-curta` |
| Correção | `fix/<numero>-descricao` |
| Infra, CI, configuração | `chore/<numero>-descricao` |
| Documentação | `docs/<numero>-descricao` |

Exemplo: `feat/27-chat-streaming`.

## 4. Commits (Conventional Commits)

```
<tipo>(<escopo opcional>): <resumo no imperativo, em português>
```

Tipos: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`.

```
feat(quiz): grava desempenho por tópico
fix(auth): evita loop de login após troca de senha
```

## 5. Pull Request

- Use o template: ele já tem o checklist.
- Escreva `Closes #<numero>` na descrição para a issue fechar no merge.
- PRs pequenos (até ~400 linhas) são revisados mais rápido.
- Precisa de **CI verde** e **1 aprovação** para o merge.
- Faça o merge com **Squash and merge**.

Antes de abrir o PR, rode localmente:

```bash
npm run lint
npm run typecheck
npm test
npm run check:secrets
```

## 6. Revisão de código

- Revise em até 1 dia útil quando for marcado.
- Comente o código, não a pessoa. Sugira, explique o porquê.
- Bloqueie o merge só por bug, risco de segurança ou quebra de padrão combinado.

## 7. Segurança e privacidade

O público do app é **adolescente**. Por isso:

- Nada de segredos no código: chaves vão no `.env` (local) ou em `wrangler secret put` (worker).
  O CI falha se encontrar uma chave `service_role` ou de API em arquivo versionado.
- A chave `service_role` do Supabase **nunca** vai para o app nem para variáveis `VITE_*`.
- Toda tabela nova precisa de RLS e de teste em `supabase/__tests__`.
- Não use dados reais de alunos em testes, prints ou issues.
- Achou uma vulnerabilidade? Siga o [SECURITY.md](SECURITY.md); não abra issue pública.

## 8. Decisões de arquitetura

Mudanças grandes de arquitetura viram um ADR em [docs/adr/](docs/adr/).
Copie o formato do ADR mais recente e abra um PR para a equipe discutir.
