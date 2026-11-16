import { describe, expect, it } from 'vitest';
import { faixaDeAcerto, filtrarPropriedades, idAnonimo, montarCaptura, podeRastrear } from '../analytics';

describe('analytics com privacidade', () => {
  it('só rastreia com chave, consentimento e 16 anos ou mais', () => {
    const adulto = '2000-01-01';
    expect(podeRastrear({ chaveConfigurada: true, consentiu: true, dataNascimento: adulto })).toBe(true);
    expect(podeRastrear({ chaveConfigurada: true, consentiu: false, dataNascimento: adulto })).toBe(false);
    expect(podeRastrear({ chaveConfigurada: false, consentiu: true, dataNascimento: adulto })).toBe(false);
    expect(podeRastrear({ chaveConfigurada: true, consentiu: true, dataNascimento: '2014-01-01' })).toBe(false);
    expect(podeRastrear({ chaveConfigurada: true, consentiu: true, dataNascimento: null })).toBe(false);
  });

  it('só saem as propriedades do plano, com valores permitidos', () => {
    expect(filtrarPropriedades('quiz_concluido', { materia: 'Matemática', questoes: 10.4, faixa_acerto: '70-100', offline: 'talvez', nome: 'Ana', email: 'a@b.c' }))
      .toEqual({ materia: 'Matemática', questoes: 10, faixa_acerto: '70-100' });
    expect(filtrarPropriedades('app_aberto', { qualquer: 'coisa' })).toEqual({});
  });

  it('o id é anônimo e estável', async () => {
    const a = await idAnonimo('11111111-1111-4111-8111-111111111111');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await idAnonimo('11111111-1111-4111-8111-111111111111')).toBe(a);
    expect(a).not.toContain('1111');
  });

  it('a captura não leva perfil de pessoa nem IP', () => {
    const c = montarCaptura({ chave: 'phc_x', host: 'https://eu.i.posthog.com' }, 'quiz_concluido', 'abc', { materia: 'Física', texto: 'minha dúvida' });
    expect(c.properties).toMatchObject({ materia: 'Física', $process_person_profile: false, $ip: null });
    expect(JSON.stringify(c)).not.toContain('dúvida');
  });

  it('faixa de acerto', () => {
    expect([faixaDeAcerto(3, 10), faixaDeAcerto(6, 10), faixaDeAcerto(9, 10), faixaDeAcerto(0, 0)]).toEqual(['0-49', '50-69', '70-100', '0-49']);
  });
});
