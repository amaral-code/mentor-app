import { describe, expect, it } from 'vitest';
import { ehErroDeConfiguracao, explicarErroIA } from '../erroIA';

describe('explicarErroIA', () => {
  const cru = '{"error":"misconfigured","message":"Defina o secret DEEPSEEK_API_KEY."}';

  it('nunca repassa JSON nem nome de variável ao aluno', () => {
    for (const [status, corpo] of [[500, cru], [401, '{"error":"sem_sessao"}'], [429, ''], [502, '<html>'], [400, 'x']] as const) {
      const frase = explicarErroIA(status, corpo);
      expect(frase).not.toMatch(/[{}"]|API_KEY|secret/i);
      expect(frase.length).toBeGreaterThan(10);
    }
  });

  it('separa configuração, sessão, limite e queda', () => {
    expect(explicarErroIA(500, cru)).toContain('configurada');
    expect(explicarErroIA(401, '')).toContain('sessão');
    expect(explicarErroIA(429, '')).toContain('minuto');
    expect(explicarErroIA(503, 'qualquer')).toContain('fora do ar');
  });

  it('reconhece erro de configuração para não repetir a chamada', () => {
    expect(ehErroDeConfiguracao(cru)).toBe(true);
    expect(ehErroDeConfiguracao('{"error":"upstream_failed"}')).toBe(false);
    expect(ehErroDeConfiguracao(null)).toBe(false);
  });
});
