import { describe, expect, it } from 'vitest';
import {
  calcularNps,
  confirmacaoValida,
  faixaNps,
  nomeArquivoExportacao,
  oQueAExclusaoFaz,
  problemaNoFeedback,
} from '../privacidade';

describe('privacidade', () => {
  it('confirma só com a palavra, sem ligar para caixa e espaço', () => {
    expect(confirmacaoValida(' excluir ')).toBe(true);
    expect(confirmacaoValida('EXCLUI')).toBe(false);
    expect(confirmacaoValida('sim')).toBe(false);
  });

  it('nome do arquivo usa o dia de Brasília (23h de lá ainda é o mesmo dia)', () => {
    expect(nomeArquivoExportacao(new Date('2026-11-17T02:30:00Z'))).toBe('meus-dados-midnight-mentor-2026-11-16.json');
  });

  it('o psicólogo é avisado de que o prontuário sai junto', () => {
    expect(oQueAExclusaoFaz('psychologist').join(' ')).toMatch(/5 anos/);
    expect(oQueAExclusaoFaz('student').join(' ')).toMatch(/ficam com ele/);
  });
});

describe('feedback', () => {
  it('recusa texto vazio, longo demais e nota fora da escala', () => {
    expect(problemaNoFeedback({ tipo: 'ideia', texto: '  ', nota: null })).toMatch(/Escreva/);
    expect(problemaNoFeedback({ tipo: 'ideia', texto: 'x'.repeat(2001), nota: null })).toMatch(/2000/);
    expect(problemaNoFeedback({ tipo: 'ideia', texto: 'ok', nota: 11 })).toMatch(/0 a 10/);
    expect(problemaNoFeedback({ tipo: 'elogio', texto: 'ótimo', nota: 10 })).toBeNull();
  });

  it('NPS: promotores menos detratores', () => {
    expect(faixaNps(9)).toBe('promotor');
    expect(faixaNps(7)).toBe('neutro');
    expect(faixaNps(6)).toBe('detrator');
    expect(calcularNps([10, 9, 8, 3])).toBe(25);
    expect(calcularNps([])).toBeNull();
  });
});
