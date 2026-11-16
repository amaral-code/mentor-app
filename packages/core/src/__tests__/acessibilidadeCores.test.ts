import { describe, expect, it } from 'vitest';
import { contraste, AA_NORMAL } from '@mentor/ui-tokens/contraste';
import { coresDeSinal, MODOS_DALTONISMO } from '../acessibilidadeCores';

describe('cores de sinal por daltonismo', () => {
  it.each(MODOS_DALTONISMO.map((m) => m.id))('%s: acerto, erro e aviso legíveis como texto (AA)', (modo) => {
    const c = coresDeSinal(modo);
    expect(contraste(c.acerto, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contraste(c.erro, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contraste(c.aviso, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contraste(c.acerto, c.acertoFundo)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contraste(c.erro, c.erroFundo)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('protan e deutan trocam o par verde e vermelho', () => {
    expect(coresDeSinal('deuteranopia').acerto).not.toBe(coresDeSinal('normal').acerto);
    expect(coresDeSinal('valor estranho')).toEqual(coresDeSinal('normal'));
    expect(coresDeSinal('deuteranomaly')).toEqual(coresDeSinal('deuteranopia'));
  });
});
