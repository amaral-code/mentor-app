import { describe, expect, it } from 'vitest';
import { formatarXp, marcoCruzado } from '../marcosXp';

describe('marcos de XP', () => {
  it('cruzar 1.000 comemora; ficar abaixo, não', () => {
    expect(marcoCruzado(980, 1010)).toBe(1000);
    expect(marcoCruzado(1010, 1990)).toBeNull();
    expect(marcoCruzado(1990, 3050)).toBe(3000);
  });
  it('perder XP ou ficar igual não comemora', () => {
    expect(marcoCruzado(1200, 900)).toBeNull();
    expect(marcoCruzado(1000, 1000)).toBeNull();
  });
  it('separador de milhar brasileiro', () => {
    expect(formatarXp(1000)).toBe('1.000');
    expect(formatarXp(1234567)).toBe('1.234.567');
    expect(formatarXp(950)).toBe('950');
  });
});
