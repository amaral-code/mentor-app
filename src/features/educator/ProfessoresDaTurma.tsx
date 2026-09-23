import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Plus, Trash2, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { docenteRepository } from '../../shared/storage/DocenteRepository';
import type { DocenteDaEscola, TurmaDoDocente } from '../../shared/storage/DocenteRepository';

/**
 * QUEM LECIONA CADA TURMA (secretaria).
 *
 * Esta tela existe porque o vínculo professor/turma passou a ser o que
 * define o escopo de leitura do papel `teacher` (migration 026). Sem
 * ela, a regra existiria no banco e ninguém teria como cumpri-la: todo
 * professor ficaria sem turma nenhuma para sempre.
 *
 * A tela não protege nada, e não é para isso que ela serve: quem barra é
 * a RLS, que confere de novo se quem chama é da secretaria e se turma e
 * docente são da mesma escola.
 */
export function ProfessoresDaTurma() {
  const setToast = useAppStore((s) => s.setToast);

  const [turmas, setTurmas] = useState<TurmaDoDocente[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [docentes, setDocentes] = useState<DocenteDaEscola[]>([]);
  const [vinculados, setVinculados] = useState<DocenteDaEscola[]>([]);
  const [escolhido, setEscolhido] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void Promise.all([docenteRepository.minhasTurmas(), docenteRepository.docentesDaEscola()])
      .then(([t, d]) => {
        if (!vivo) return;
        setTurmas(t);
        setDocentes(d);
        if (t.length > 0) setTurmaId((atual) => atual || t[0].id);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const carregarVinculados = useCallback(async (id: string) => {
    if (!id) return;
    setVinculados(await docenteRepository.professoresDaTurma(id));
  }, []);

  useEffect(() => {
    void carregarVinculados(turmaId);
  }, [turmaId, carregarVinculados]);

  async function vincular() {
    if (!escolhido || !turmaId || salvando) return;
    setSalvando(true);
    try {
      await docenteRepository.atribuir(escolhido, turmaId);
      setEscolhido('');
      await carregarVinculados(turmaId);
      setToast('Docente vinculado à turma.', 'success');
    } catch (e) {
      setToast(mensagem(e), 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function desvincular(docente: DocenteDaEscola) {
    setSalvando(true);
    try {
      await docenteRepository.remover(docente.id, turmaId);
      await carregarVinculados(turmaId);
      setToast(`${docente.nome} não acompanha mais esta turma.`, 'success');
    } catch (e) {
      setToast(mensagem(e), 'error');
    } finally {
      setSalvando(false);
    }
  }

  const jaVinculados = new Set(vinculados.map((v) => v.id));
  const disponiveis = docentes.filter((d) => !jaVinculados.has(d.id));
  const turmaAtual = turmas.find((t) => t.id === turmaId);

  if (carregando) {
    return <div className="glass rounded-2xl p-6 h-40 animate-pulse" aria-hidden="true" />;
  }

  if (turmas.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-bold text-white">Nenhuma turma cadastrada ainda</h2>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          Cadastre as turmas na aba Onboarding. Depois volte aqui para dizer quem leciona
          em cada uma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-600/10 flex items-center justify-center">
          <GraduationCap size={20} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Quem leciona cada turma</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            O professor só enxerga os dados das turmas em que estiver aqui.
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <div>
          <label htmlFor="turma-escopo" className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Turma
          </label>
          <select
            id="turma-escopo"
            value={turmaId}
            onChange={(e) => setTurmaId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white outline-none focus:border-violet-500/40 min-h-[44px]"
          >
            {turmas.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0d1426]">
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">
            Docentes de {turmaAtual?.nome ?? 'turma'}
          </h3>
          {vinculados.length === 0 ? (
            <p className="text-sm text-gray-500 glass-light rounded-xl px-3 py-4 flex items-center gap-2">
              <Users size={15} className="text-gray-600 shrink-0" />
              Ninguém vinculado. Enquanto estiver assim, nenhum professor vê os dados desta turma.
            </p>
          ) : (
            <ul className="space-y-2">
              {vinculados.map((d) => (
                <li
                  key={d.id}
                  className="glass-light rounded-xl px-3 py-3 flex items-center justify-between gap-3 border border-white/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{d.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{d.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => desvincular(d)}
                    disabled={salvando}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 border border-white/10 hover:border-red-500/40 hover:text-red-300 transition-all min-h-[40px] shrink-0 disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="docente-novo" className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
            Vincular docente
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              id="docente-novo"
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              disabled={disponiveis.length === 0}
              className="flex-1 px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white outline-none focus:border-violet-500/40 min-h-[44px] disabled:opacity-50"
            >
              <option value="" className="bg-[#0d1426]">
                {disponiveis.length === 0 ? 'Todos os docentes já estão nesta turma' : 'Escolha um docente'}
              </option>
              {disponiveis.map((d) => (
                <option key={d.id} value={d.id} className="bg-[#0d1426]">
                  {d.nome} ({d.papel === 'educator' ? 'secretaria' : 'professor'})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={vincular}
              disabled={!escolhido || salvando}
              className="btn-primary px-5 text-sm min-h-[44px] inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Plus size={15} /> Vincular
            </button>
          </div>
          <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
            Vincular dá acesso aos agregados da turma: o que ela erra e como ela está.
            Nunca a dados individuais, em nenhum dos dois casos.
          </p>
        </div>
      </div>
    </div>
  );
}

function mensagem(e: unknown): string {
  const bruto = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (bruto.includes('mesma escola')) return 'Esse docente é de outra escola.';
  if (bruto.includes('so um docente')) return 'Só uma conta de professor ou secretaria pode ser vinculada.';
  if (bruto.includes('sem_permissao')) return 'Só a secretaria pode vincular docentes.';
  return 'Não foi possível salvar agora. Tente de novo.';
}
