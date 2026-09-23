import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { docenteRepository } from '../../shared/storage/DocenteRepository';

/**
 * CÓDIGOS DE ENTRADA: instituição e turmas.
 *
 * O aluno entra em duas etapas, no Perfil: primeiro o código da escola,
 * depois o da turma. Os dois papéis precisam desses códigos, por razões
 * diferentes:
 *
 *   SECRETARIA  vê todos, e troca quando um vaza. Trocar o da escola
 *               invalida todo convite pendente, por isso pede confirmação.
 *   PROFESSOR   vê o da escola e SÓ os das turmas dele (026), para passar
 *               aos alunos em sala. Não troca nada: se um código vazou, é
 *               a secretaria quem decide, porque trocar afeta a escola.
 *
 * Quem de fato impede o professor de trocar é o servidor
 * (`regenerar_codigo_*` confere o papel). Esconder o botão aqui é só
 * não oferecer o que ele vai recusar.
 */

interface Props {
  modo: 'secretaria' | 'professor';
}

export function CodigosEscola({ modo }: Props) {
  const escolaId = useAppStore((s) => s.session?.escolaId);
  const [escola, setEscola] = useState<{ id: string; nome: string; codigo: string } | null>(null);
  const [turmas, setTurmas] = useState<{ id: string; nome: string; codigo: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const ehSecretaria = modo === 'secretaria';

  useEffect(() => {
    if (!escolaId) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    void Promise.all([
      supabaseRepository.loadEscolas(),
      supabaseRepository.loadTurmas(),
      // O professor só vê as turmas que leciona; a secretaria, todas.
      ehSecretaria ? Promise.resolve(null) : docenteRepository.minhasTurmas(),
    ])
      .then(([escolas, todas, minhas]) => {
        if (!vivo) return;
        const e = (escolas as { id: string; nome: string; codigo_instituicao?: string }[]).find((x) => x.id === escolaId);
        setEscola(e ? { id: e.id, nome: e.nome, codigo: e.codigo_instituicao ?? 'sem código' } : null);
        const permitidas = minhas ? new Set(minhas.map((t) => t.id)) : null;
        setTurmas(
          (todas as { id: string; nome: string; escolaId: string; codigo?: string }[])
            .filter((t) => t.escolaId === escolaId && (!permitidas || permitidas.has(t.id)))
            .map((t) => ({ id: t.id, nome: t.nome, codigo: t.codigo ?? 'sem código' })),
        );
      })
      .catch(() => vivo && setErro('Não foi possível carregar os códigos agora.'))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [escolaId, ehSecretaria]);

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopiado(chave);
    window.setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 2000);
  }

  async function trocarTurma(id: string) {
    if (!confirm('Gerar um novo código para esta turma? O antigo para de funcionar na hora.')) return;
    try {
      const novo = await supabaseRepository.regenerarCodigoTurma(id);
      setTurmas((prev) => prev.map((t) => (t.id === id ? { ...t, codigo: novo } : t)));
      setErro('');
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível gerar um novo código.');
    }
  }

  async function trocarInstituicao() {
    if (!escola || !confirm('Gerar um novo código da escola? Todos os convites com o código antigo param de funcionar.')) return;
    try {
      const novo = await supabaseRepository.regenerarCodigoInstituicao(escola.id);
      setEscola({ ...escola, codigo: novo });
      setErro('');
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível gerar um novo código.');
    }
  }

  return (
    <div className="glass rounded-2xl p-5 border border-amber-500/10">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={15} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white">
          {ehSecretaria ? 'Códigos de entrada' : 'Códigos para passar aos alunos'}
        </h3>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        {ehSecretaria
          ? 'O aluno digita esses códigos no Perfil: primeiro o da escola, depois o da turma. Não poste em grupo aberto, porque quem tiver o código entra.'
          : 'Em sala, passe os dois: primeiro o da escola, depois o da sua turma. O aluno digita no Perfil. Se um código vazar, peça à secretaria para trocar.'}
      </p>

      {carregando ? (
        <div className="h-20 rounded-xl bg-white/5 animate-pulse" aria-hidden="true" />
      ) : !escola ? (
        <p className="text-xs text-amber-300">
          Sua conta ainda não está ligada a uma escola. Fale com a secretaria da escola.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-black/25 border border-white/[0.06] px-3 py-2.5">
            <div className="flex-1 min-w-[140px]">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Escola · {escola.nome}</p>
              <p className="text-base font-mono font-bold text-amber-300 tracking-[0.2em]">{escola.codigo}</p>
            </div>
            <button
              onClick={() => void copiar(escola.codigo, 'inst')}
              aria-label="Copiar código da escola"
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-all min-h-[40px]"
            >
              {copiado === 'inst' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiado === 'inst' ? 'Copiado' : 'Copiar'}
            </button>
            {ehSecretaria && (
              <button
                onClick={() => void trocarInstituicao()}
                title="Gerar um novo código (o antigo para de funcionar)"
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-500 hover:text-amber-300 transition-all min-h-[40px]"
              >
                <RefreshCw size={13} /> Trocar
              </button>
            )}
          </div>

          {turmas.length === 0 ? (
            <p className="text-xs text-gray-500">
              {ehSecretaria
                ? 'Nenhuma turma cadastrada ainda. Elas nascem na aba Matrículas, a partir da coluna Sala.'
                : 'Você ainda não está em nenhuma turma. A secretaria faz esse vínculo na aba Docentes dela.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {turmas.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                  <span className="text-gray-200 flex-1 truncate">{t.nome}</span>
                  <code className="font-mono font-bold text-cyan-300 tracking-[0.15em] text-sm">{t.codigo}</code>
                  <button
                    onClick={() => void copiar(t.codigo, t.id)}
                    aria-label={`Copiar código da turma ${t.nome}`}
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                  >
                    {copiado === t.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                  {ehSecretaria && (
                    <button
                      onClick={() => void trocarTurma(t.id)}
                      title="Gerar novo código (o antigo para de funcionar)"
                      aria-label={`Gerar novo código para a turma ${t.nome}`}
                      className="p-2 rounded-lg text-gray-500 hover:text-amber-300 hover:bg-white/10 transition-all"
                    >
                      <RefreshCw size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {erro && (
            <p role="alert" className="text-xs text-red-400">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
