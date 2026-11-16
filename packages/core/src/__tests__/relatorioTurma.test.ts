import { describe, expect, it } from 'vitest';
import { faixaDoTopico, nomeDoArquivo, relatorioParaCsv } from '../relatorioTurma';

const resumo = { turmaNome: '3º A; Noite', totalAlunos: 30, alunosAtivos: 22, respostas: 410, taxaAcerto: 61.5 };

describe('relatório da turma', () => {
  it('CSV abre no Excel em português: BOM, ponto e vírgula e vírgula decimal', () => {
    const csv = relatorioParaCsv(resumo, [{ materia: 'Matemática', topico: 'Funções', alunosMedidos: 20, alunosComDificuldade: 12, respostas: 180, taxaAcerto: 42.3 }], 30);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Turma;"3º A; Noite"');
    expect(csv).toContain('Matemática;Funções;20;12;180;42,3;Revisar');
    expect(csv.split('\r\n')).toHaveLength(9);
  });

  it('faixas de revisão', () => {
    expect([10, 55, 80, null].map(faixaDoTopico)).toEqual(['revisar', 'atencao', 'bem', 'sem dados']);
  });

  it('nome de arquivo sem acento nem espaço', () => {
    expect(nomeDoArquivo('3º A Noturno', 30, '2026-11-16')).toBe('relatorio_3_A_Noturno_30d_2026-11-16.csv');
  });
});
