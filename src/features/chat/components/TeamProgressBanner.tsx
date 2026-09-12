/**
 * Efeito Cardume (edital): faixa estatica de colaboracao coletiva no topo
 * do chat. Propositalmente simples - frase fixa, sem fetch, sem grafico:
 * o objetivo e pertencimento ("a turma avanca junta"), nao ranking.
 */
export function TeamProgressBanner() {
  return (
    <p
      role="status"
      aria-label="Progresso coletivo da turma hoje"
      className="relative z-10 mx-4 mt-2 shrink-0 truncate rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1.5 text-center text-[11px] font-medium text-emerald-300"
    >
      🚀 A turma já resolveu 45 desafios hoje. Faltam 5 para a meta diária
    </p>
  );
}
