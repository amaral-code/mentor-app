import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

/*
 * Mesmos plugins e env do Vite, mais o setup que instala os adaptadores
 * web do @mentor/core. Sem ele, os testes que fazem `vi.stubEnv` ou
 * `vi.stubGlobal('localStorage', ...)` nao chegariam ao core: o padrao
 * da plataforma e "sem armazenamento, sem env".
 */
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      setupFiles: ['./src/plataforma/web.ts'],
    },
  }),
)
