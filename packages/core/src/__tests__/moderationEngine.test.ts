import { describe, expect, it } from 'vitest';
import { moderar } from '../moderationEngine';

describe('moderar', () => {
  it('perguntas de estudo passam (antes "cu" bloqueava cálculo, cubo, curso)', () => {
    for (const t of [
      'Cálculo da circunferência',
      'Qual o volume do cubo?',
      'Vou fazer o curso de física',
      'A cultura africana no Brasil',
      'Escuta essa dica',
      'Vai estudar a matéria de ontem?',
      'Some os valores e divida por 3',
      'Sou crente e estudo à noite',
      'O problema da questão 3 é feio, mas dá para resolver',
    ]) {
      expect(moderar(t), t).toMatchObject({ aprovado: true });
    }
  });

  it('palavrão e ofensa dirigida são bloqueados antes de publicar', () => {
    expect(moderar('que porra é essa').aprovado).toBe(false);
    expect(moderar('Você é um idiota').aprovado).toBe(false);
    expect(moderar('VC É BURRO DEMAIS').aprovado).toBe(false);
    expect(moderar('cala a boca').aprovado).toBe(false);
    expect(moderar('some daqui').aprovado).toBe(false);
    expect(moderar('Fdp!!').aprovado).toBe(false);
  });

  it('link externo não entra, mensagem vazia também não', () => {
    expect(moderar('olha bit.ly/abc')).toMatchObject({ aprovado: false, razao: 'Links externos não são permitidos' });
    expect(moderar('   ').aprovado).toBe(false);
  });

  it('o texto limpo troca só a palavra, não o pedaço de outra', () => {
    expect(moderar('cálculo de merda').textoLimpio).toBe('cálculo de ***');
  });
});
