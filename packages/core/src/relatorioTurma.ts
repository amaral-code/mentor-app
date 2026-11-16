/**
 * Relatório da turma (issue #60): forma das linhas e exportação.
 *
 * Os números vêm do banco (`resumo_turma` e `relatorio_turma`, migration
 * 034), com piso de 3 alunos por tópico. Aqui só se formata.
 */
export interface ResumoTurma {
  turmaNome: string;
  totalAlunos: number;
  alunosAtivos: number;
  respostas: number;
  /** 0 a 100, ou null sem respostas no período. */
  taxaAcerto: number | null;
}

export interface LinhaRelatorioTurma {
  materia: string;
  topico: string;
  alunosMedidos: number;
  alunosComDificuldade: number;
  respostas: number;
  taxaAcerto: number | null;
}

/** Faixa que a tela pinta. Abaixo de 50% de acerto é prioridade de revisão. */
export function faixaDoTopico(taxa: number | null): 'revisar' | 'atencao' | 'bem' | 'sem dados' {
  if (taxa === null) return 'sem dados';
  if (taxa < 50) return 'revisar';
  if (taxa < 70) return 'atencao';
  return 'bem';
}

const ROTULO_FAIXA = { revisar: 'Revisar', atencao: 'Atenção', bem: 'Bem', 'sem dados': 'Sem dados' } as const;

/**
 * CSV que abre certo no Excel em português: ponto e vírgula como
 * separador, vírgula decimal e BOM no início (sem ele o Excel lê os
 * acentos como lixo).
 */
export function relatorioParaCsv(resumo: ResumoTurma, linhas: LinhaRelatorioTurma[], dias: number): string {
  const campo = (v: string | number | null) => {
    const texto = v === null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const cabecalho = [
    `Turma;${campo(resumo.turmaNome)}`,
    `Período;últimos ${dias} dias`,
    `Alunos;${resumo.totalAlunos}`,
    `Alunos que praticaram;${resumo.alunosAtivos}`,
    `Respostas;${resumo.respostas}`,
    `Acerto geral (%);${campo(resumo.taxaAcerto)}`,
    '',
    'Matéria;Tópico;Alunos que responderam;Alunos com mais erros que acertos;Respostas;Acerto (%);Situação',
  ];
  const corpo = linhas.map((l) =>
    [l.materia, l.topico || 'geral', l.alunosMedidos, l.alunosComDificuldade, l.respostas, l.taxaAcerto, ROTULO_FAIXA[faixaDoTopico(l.taxaAcerto)]]
      .map(campo)
      .join(';'),
  );
  return '﻿' + [...cabecalho, ...corpo].join('\r\n');
}

export function nomeDoArquivo(turma: string, dias: number, hoje: string): string {
  const slug = turma.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'turma';
  return `relatorio_${slug}_${dias}d_${hoje}.csv`;
}
