import { useEffect, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import {
  faixaDoTopico,
  nomeDoArquivo,
  relatorioParaCsv,
  type LinhaRelatorioTurma,
  type ResumoTurma,
} from '@mentor/core/relatorioTurma';
import { diaDeBrasilia } from '@mentor/core/utils';
import { docenteRepository } from '@mentor/api/DocenteRepository';
import { relatorioTurmaRepository } from '@mentor/api/RelatorioTurmaRepository';

/**
 * Relatório da turma (#60).
 *
 * Critério de aceite: "Coordenador gera relatório da turma em menos de 3
 * cliques". Aba (1), turma (2, já vem a primeira), Baixar ou Imprimir (3).
 * Nenhum nome de aluno: só agregados, com piso de 3 alunos por tópico.
 */
const PERIODOS = [7, 30, 90] as const;

const COR_FAIXA = {
  revisar: 'bg-red-50 text-red-700 border-red-200',
  atencao: 'bg-amber-50 text-amber-800 border-amber-200',
  bem: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'sem dados': 'bg-slate-50 text-slate-500 border-slate-200',
} as const;
const ROTULO_FAIXA = { revisar: 'Revisar', atencao: 'Atenção', bem: 'Bem', 'sem dados': 'Sem dados' } as const;

const pct = (v: number | null) => (v === null ? 'sem dados' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

export function RelatorioTurma() {
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[] | null>(null);
  const [turmaId, setTurmaId] = useState('');
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [dados, setDados] = useState<{ resumo: ResumoTurma | null; linhas: LinhaRelatorioTurma[] } | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    void docenteRepository.minhasTurmas().then((t) => {
      setTurmas(t);
      if (t[0]) setTurmaId((atual) => atual || t[0].id);
    });
  }, []);

  useEffect(() => {
    if (!turmaId) return;
    let vivo = true;
    setDados(null);
    setErro('');
    relatorioTurmaRepository
      .carregar(turmaId, dias)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErro('Não foi possível carregar o relatório agora.'));
    return () => {
      vivo = false;
    };
  }, [turmaId, dias]);

  function baixarCsv() {
    if (!dados?.resumo) return;
    const blob = new Blob([relatorioParaCsv(dados.resumo, dados.linhas, dias)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeDoArquivo(dados.resumo.turmaNome, dias, diaDeBrasilia());
    a.click();
    URL.revokeObjectURL(url);
  }

  /* PDF pela impressão do navegador ("Salvar como PDF"): uma página
     limpa, só com o relatório, sem depender de biblioteca de PDF. */
  function imprimir() {
    if (!dados?.resumo) return;
    const r = dados.resumo;
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    const linhas = dados.linhas
      .map((l) => `<tr><td>${esc(l.materia)}</td><td>${esc(l.topico || 'geral')}</td><td>${l.alunosMedidos}</td><td>${l.alunosComDificuldade}</td><td>${l.respostas}</td><td>${pct(l.taxaAcerto)}</td><td>${ROTULO_FAIXA[faixaDoTopico(l.taxaAcerto)]}</td></tr>`)
      .join('');
    const janela = window.open('', '_blank', 'noopener=no,width=900,height=700');
    if (!janela) return;
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${esc(r.turmaNome)}</title>
      <style>body{font-family:system-ui,sans-serif;color:#1e2a4a;margin:32px}h1{font-size:22px;margin:0}p{margin:4px 0;color:#51607d}
      table{border-collapse:collapse;width:100%;margin-top:18px;font-size:13px}th,td{border:1px solid #dbe3f0;padding:6px 8px;text-align:left}th{background:#f1f5fb}</style></head>
      <body><h1>Relatório da turma ${esc(r.turmaNome)}</h1><p>Midnight Mentor · últimos ${dias} dias · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
      <p>${r.alunosAtivos} de ${r.totalAlunos} alunos praticaram · ${r.respostas} respostas · acerto geral ${pct(r.taxaAcerto)}</p>
      <table><thead><tr><th>Matéria</th><th>Tópico</th><th>Alunos</th><th>Com mais erros</th><th>Respostas</th><th>Acerto</th><th>Situação</th></tr></thead><tbody>${linhas || '<tr><td colspan="7">Nenhum tópico com 3 alunos ou mais no período.</td></tr>'}</tbody></table>
      <p style="margin-top:14px;font-size:12px">Tópicos respondidos por menos de 3 alunos não aparecem, para que nenhum resultado individual possa ser identificado.</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    janela.document.close();
  }

  if (turmas === null) return <div className="glass rounded-2xl h-40 animate-pulse" aria-label="Carregando turmas" />;
  if (turmas.length === 0) {
    return <p className="glass rounded-2xl p-5 text-sm text-slate-600">Nenhuma turma no seu escopo ainda. A secretaria vincula o professor às turmas na aba Docentes.</p>;
  }

  return (
    <section className="space-y-4" aria-labelledby="titulo-relatorio">
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-tinta-700" aria-hidden="true" />
        <h2 id="titulo-relatorio" className="text-base font-bold text-tinta-900">Relatório da turma</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 text-xs text-slate-500 font-medium">
          Turma
          <select className="mt-1 w-full min-h-[44px]" value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 font-medium">
          Período
          <select className="mt-1 w-full min-h-[44px]" value={dias} onChange={(e) => setDias(Number(e.target.value) as (typeof PERIODOS)[number])}>
            {PERIODOS.map((d) => <option key={d} value={d}>últimos {d} dias</option>)}
          </select>
        </label>
      </div>

      {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
      {!dados && !erro && <div className="glass rounded-2xl h-40 animate-pulse" aria-label="Carregando relatório" />}

      {dados?.resumo && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Alunos', String(dados.resumo.totalAlunos)],
              ['Praticaram', String(dados.resumo.alunosAtivos)],
              ['Respostas', dados.resumo.respostas.toLocaleString('pt-BR')],
              ['Acerto geral', pct(dados.resumo.taxaAcerto)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="cartao p-3 text-center">
                <p className="text-lg font-black text-tinta-900 tabular-nums">{valor}</p>
                <p className="text-xs text-slate-500">{rotulo}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={baixarCsv} className="btn-primary"><Download size={16} aria-hidden="true" /> Baixar planilha (CSV)</button>
            <button type="button" onClick={imprimir} className="btn-secondary"><Printer size={16} aria-hidden="true" /> Imprimir ou salvar PDF</button>
          </div>

          {dados.linhas.length === 0 ? (
            <p className="glass rounded-2xl p-5 text-sm text-slate-600">Nenhum tópico com 3 alunos ou mais no período. Tópico respondido por menos gente não aparece, para não expor o resultado de ninguém.</p>
          ) : (
            <div className="cartao overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="p-3">Tópico</th>
                    <th className="p-3 text-right">Alunos</th>
                    <th className="p-3 text-right">Com mais erros</th>
                    <th className="p-3 text-right">Acerto</th>
                    <th className="p-3">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.linhas.map((l) => {
                    const faixa = faixaDoTopico(l.taxaAcerto);
                    return (
                      <tr key={`${l.materia}-${l.topico}`} className="border-b border-slate-100 last:border-0">
                        <td className="p-3"><span className="font-bold text-tinta-900">{l.topico || 'geral'}</span><span className="block text-xs text-slate-500">{l.materia}</span></td>
                        <td className="p-3 text-right tabular-nums">{l.alunosMedidos}</td>
                        <td className="p-3 text-right tabular-nums">{l.alunosComDificuldade}</td>
                        <td className="p-3 text-right tabular-nums font-bold">{pct(l.taxaAcerto)}</td>
                        <td className="p-3"><span className={`inline-block rounded-lg border px-2 py-0.5 text-xs font-bold ${COR_FAIXA[faixa]}`}>{ROTULO_FAIXA[faixa]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">Acerto nos exercícios do app. Não é nota escolar. Tópicos respondidos por menos de 3 alunos ficam de fora.</p>
        </>
      )}
    </section>
  );
}
