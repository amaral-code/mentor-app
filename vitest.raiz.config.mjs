import { defineConfig } from 'vitest/config';

/*
 * Testes que moram na raiz do monorepo, fora dos workspaces:
 * o back-end unico (server/worker.js) e as migrations do Supabase
 * rodadas num Postgres real com PGlite. Os testes de apps/* e
 * packages/* rodam pelo turbo, cada um no proprio workspace.
 */
export default defineConfig({
  test: {
    include: ['server/**/*.test.mjs', 'supabase/**/*.test.mjs'],
  },
});
