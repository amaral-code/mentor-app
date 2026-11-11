import { describe, expect, it } from 'vitest';
import { detectarRiscoDeCrise, MENSAGEM_ACOLHIMENTO } from '../riscoCrise';

describe('detectarRiscoDeCrise', () => {
  it.each([
    'não aguento mais, quero me matar',
    'to pensando em sumir pra sempre, ninguem ia sentir falta',
    'Eu queria morrer',
    'tenho vontade de me cortar',
    'penso em suicídio às vezes',
    'não quero mais viver',
    'todo mundo ficaria melhor sem mim',
    'vou acabar com tudo hoje',
    'NÃO VEJO SAÍDA',
    'as vezes eu penso em tirar a minha vida',
  ])('reconhece: %s', (frase) => {
    expect(detectarRiscoDeCrise(frase)).toBe(true);
  });

  it.each([
    'O que é mitose?',
    'essa prova vai me matar',
    'vou me matar de estudar essa semana',
    'quase morri de rir na aula',
    'quem matou Getúlio Vargas?',
    'quero sumir com essa dúvida de logaritmo',
    'como morrer menos de sono estudando à noite',
    'explique a taxa de mortalidade infantil',
    '',
  ])('não dispara em: %s', (frase) => {
    expect(detectarRiscoDeCrise(frase)).toBe(false);
  });

  it('a resposta fixa traz o CVV 188, o SAMU e a Rede de Apoio', () => {
    expect(MENSAGEM_ACOLHIMENTO).toContain('188');
    expect(MENSAGEM_ACOLHIMENTO).toContain('192');
    expect(MENSAGEM_ACOLHIMENTO).toContain('Rede de Apoio');
  });
});
