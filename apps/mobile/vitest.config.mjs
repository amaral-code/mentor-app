import { defineConfig } from 'vitest/config';

// Só a lógica pura do app (src/lib). Tela de React Native não roda no Node.
export default defineConfig({
  test: { include: ['src/lib/__tests__/**/*.test.ts'] },
});
