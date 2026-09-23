import { useCallback, useEffect, useState } from 'react';
import { FileLock2, HeartPulse, Lock, NotebookPen, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import type { NotaProntuario, Paciente, PontoBemEstar } from '../../shared/storage/PsicologiaRepository';
import { acompanhamentoRepository } from '../../shared/storage/AcompanhamentoRepository';
import { totaisDoPeriodo } from '../../shared/lib/acompanhamentoAluno';
import { diasRestantes, rotuloEscopo } from '../../shared/lib/consentimento';
import { COR_CLASSE } from '../../shared/lib/burnoutModel';
import { formatarDataHora } from '../../shared/lib/bookingEngine';

/**
 * PACIENTES — o que o profissional vê de cada um.
 *
 * Três camadas, cada uma com a sua regra no banco:
 *
 *   RESUMO      só o que o consentimento vigente libera. Sem escopo, a
 *               tela diz "não liberado" em vez de esconder: o psicólogo
 *               precisa saber que o dado existe e que a decisão de
 *               compartilhar é do paciente.
 *   PRONTUÁRIO  só ele lê, e só acrescenta. Não há botão de editar nem
 *               de apagar porque não há policy para isso: corrigir é
 *               escrever uma retificação que aponta para a original.
 *
 * Revogar o consentimento NÃO some com o prontuário: a guarda do
 * registro é obrigação do profissional. Some a possibilidade de escrever
 * nota nova sem vínculo.
 */

type Aba = 'resumo' | 'prontuario';

export function PainelPacientes() {
  const session = useAppStore((s) => s.session);
  const setToast = useAppStore((s) => s.setToast);

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [selecionado, setSelecionado] = useState<Paciente | null>(null);
  const [aba, setAba] = useState<Aba>('resumo');
  const [carregando, setCarregando] = useState(true);

  const [bemEstar, setBemEstar] = useState<PontoBemEstar[] | null>(null);
  const [estudo, setEstudo] = useState<{ minutos: number; taxa: number; dias: number } | null>(null);
  const [notas, setNotas] = useState<NotaProntuario[]>([]);
  const [texto, setTexto] = useState('');
  const [retificando, setRetificando] = useState<NotaProntuario | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void psicologiaRepository
      .pacientes()
      .then((p) => {
        if (!vivo) return;
        setPacientes(p);
        setSelecionado((atual) => atual ?? p[0] ?? null);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  const carregarDoPaciente = useCallback(async (p: Paciente) => {
    const escopo = p.escopo ?? [];
    setBemEstar(null);
    setEstudo(null);
    const [b, e, n] = await Promise.all([
      escopo.includes('bem_estar')
        ? psicologiaRepository.bemEstarPaciente(p.alunoId, 30).catch(() => [])
        : Promise.resolve(null),
      escopo.includes('estudo') ? acompanhamentoRepository.resumoMensal(p.alunoId, 3) : Promise.resolve(null),
      psicologiaRepository.notas(p.alunoId),
    ]);
    setBemEstar(b);
    if (e) {
      const t = totaisDoPeriodo(e);
      setEstudo({ minutos: t.minutos, taxa: t.taxaAcerto, dias: t.diasAtivos });
    }
    setNotas(n);
  }, []);

  useEffect(() => {
    if (selecionado) void carregarDoPaciente(selecionado);
  }, [selecionado, carregarDoPaciente]);

  async function salvarNota() {
    if (!selecionado || !session || !texto.trim() || salvando) return;
    setSalvando(true);
    try {
      await psicologiaRepository.anotar(session.uid, selecionado.alunoId, texto, retificando?.id);
      setTexto('');
      setRetificando(null);
      setNotas(await psicologiaRepository.notas(selecionado.alunoId));
      setToast(retificando ? 'Retificação registrada.' : 'Anotação registrada.', 'success');
    } catch {
      setToast('Sem consulta ou consentimento vigente, não dá para anotar sobre este paciente.', 'error');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="glass rounded-2xl h-48 animate-pulse" aria-hidden="true" />;

  if (pacientes.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Users size={16} className="text-cyan-400" /> Pacientes
        </h2>
        <p className="text-sm text-gray-500 mt-3">
          Ninguém ainda. Um estudante aparece aqui depois de marcar uma consulta ou de
          autorizar o acesso aos dados dele.
        </p>
      </div>
    );
  }

  const escopo = selecionado?.escopo ?? [];
  /* Menor de 16: quem libera é o responsável, não o paciente (LGPD,
     027). Dizer "não liberado pelo paciente" mandava a psicóloga pedir
     à pessoa que nem pode autorizar. */
  const naoLiberado = selecionado?.menorDe16
    ? 'Não liberado. Como tem menos de 16 anos, quem libera é o responsável.'
    : 'Não liberado pelo paciente.';
  const idNotas = new Map(notas.map((n) => [n.id, n]));

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
        <Users size={16} className="text-cyan-400" /> Pacientes
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pacientes">
        {pacientes.map((p) => (
          <button
            key={p.alunoId}
            type="button"
            role="tab"
            aria-selected={selecionado?.alunoId === p.alunoId}
            onClick={() => {
              setSelecionado(p);
              setRetificando(null);
            }}
            className={`shrink-0 px-3 py-2 rounded-xl text-sm border min-h-[44px] ${
              selecionado?.alunoId === p.alunoId
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                : 'border-white/[0.05] glass-light text-gray-400'
            }`}
          >
            {p.nome}
            {p.menorDe16 && <span className="ml-1.5 text-[10px] text-violet-300">menor de 16</span>}
          </button>
        ))}
      </div>

      {selecionado && (
        <>
          <div className="glass-light rounded-xl px-3.5 py-3 border border-white/[0.04] text-xs text-gray-400 leading-relaxed">
            {selecionado.escopo ? (
              <>
                Liberado: <strong className="text-gray-200">{rotuloEscopo(selecionado.escopo)}</strong>,
                por mais {diasRestantes(selecionado.validoAte ?? '')} dia(s).
              </>
            ) : (
              'Nenhum dado liberado. Só a consulta marcada, com nome e horário.'
            )}
            {selecionado.proxima && <> Próxima consulta: {formatarDataHora(selecionado.proxima)}.</>}
          </div>

          <div className="inline-flex rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 gap-1" role="tablist">
            {(['resumo', 'prontuario'] as const).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={aba === a}
                onClick={() => setAba(a)}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold min-h-[40px] ${
                  aba === a ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'text-gray-400 border border-transparent'
                }`}
              >
                {a === 'resumo' ? 'Resumo' : 'Prontuário'}
              </button>
            ))}
          </div>

          {aba === 'resumo' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="glass-light rounded-xl p-4 border border-white/[0.04]">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1.5 mb-3">
                  <HeartPulse size={13} className="text-rose-400" /> Índice de cansaço (30 dias)
                </h3>
                {!escopo.includes('bem_estar') ? (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Lock size={13} /> {naoLiberado}
                  </p>
                ) : !bemEstar || bemEstar.length === 0 ? (
                  <p className="text-sm text-gray-500">Liberado, mas ainda sem medições.</p>
                ) : (
                  <div className="flex items-end gap-[3px] h-20" aria-label="Índice diário de cansaço">
                    {bemEstar.map((d) => (
                      <div
                        key={d.data}
                        className="flex-1 rounded-t-sm min-h-[3px]"
                        style={{
                          height: `${Math.max(5, d.score)}%`,
                          background: COR_CLASSE[d.classe as keyof typeof COR_CLASSE] ?? '#64748b',
                          opacity: 0.85,
                        }}
                        title={`${new Date(`${d.data}T12:00:00`).toLocaleDateString('pt-BR')}: ${d.score}/100`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-light rounded-xl p-4 border border-white/[0.04]">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Ritmo de estudo (3 meses)</h3>
                {!escopo.includes('estudo') ? (
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Lock size={13} /> {naoLiberado}
                  </p>
                ) : !estudo ? (
                  <div className="h-12 rounded bg-white/5 animate-pulse" />
                ) : (
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dt className="text-[10px] text-gray-500">minutos</dt>
                      <dd className="text-lg font-bold text-white tabular-nums">{estudo.minutos}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-gray-500">dias ativos</dt>
                      <dd className="text-lg font-bold text-white tabular-nums">{estudo.dias}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-gray-500">acerto</dt>
                      <dd className="text-lg font-bold text-white tabular-nums">{estudo.taxa}%</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-cyan-500/[0.05] border border-cyan-500/15 px-3.5 py-3 flex gap-2.5">
                <FileLock2 size={15} className="text-cyan-300 shrink-0 mt-0.5" />
                <p className="text-xs text-cyan-100/80 leading-relaxed">
                  Só você lê. Nem o paciente, nem a família, nem a escola, nem outro profissional.
                  Anotação não é editada nem apagada: para corrigir, registre uma retificação.
                </p>
              </div>

              <div>
                <label htmlFor="nota-prontuario" className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
                  {retificando ? 'Retificação' : 'Nova anotação'}
                </label>
                {retificando && (
                  <p className="text-[11px] text-amber-300/90 mb-2">
                    Corrigindo a anotação de {new Date(retificando.criadoEm).toLocaleDateString('pt-BR')}. A original continua registrada.{' '}
                    <button type="button" className="underline" onClick={() => setRetificando(null)}>
                      Cancelar
                    </button>
                  </p>
                )}
                <textarea
                  id="nota-prontuario"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value.slice(0, 20000))}
                  rows={4}
                  placeholder="Evolução da sessão"
                  className="w-full px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/40"
                />
                <button
                  type="button"
                  onClick={salvarNota}
                  disabled={!texto.trim() || salvando}
                  className="btn-primary mt-2 px-5 h-11 text-sm inline-flex items-center gap-2 disabled:opacity-40"
                >
                  <NotebookPen size={15} /> {salvando ? 'Registrando…' : retificando ? 'Registrar retificação' : 'Registrar anotação'}
                </button>
              </div>

              {notas.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma anotação sobre este paciente.</p>
              ) : (
                <ol className="space-y-2">
                  {notas.map((n) => {
                    const original = n.retificaId ? idNotas.get(n.retificaId) : null;
                    return (
                      <li
                        key={n.id}
                        className={`rounded-xl px-3.5 py-3 border ${
                          n.tipo === 'retificacao'
                            ? 'border-amber-500/20 bg-amber-500/[0.04]'
                            : 'border-white/[0.05] glass-light'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] text-gray-500 tabular-nums">
                            {new Date(n.criadoEm).toLocaleString('pt-BR')}
                            {n.tipo === 'retificacao' && (
                              <span className="ml-2 text-amber-300">
                                retifica a de {original ? new Date(original.criadoEm).toLocaleDateString('pt-BR') : 'outra data'}
                              </span>
                            )}
                          </span>
                          {n.tipo === 'evolucao' && (
                            <button
                              type="button"
                              onClick={() => {
                                setRetificando(n);
                                document.getElementById('nota-prontuario')?.focus();
                              }}
                              className="text-[11px] text-gray-500 hover:text-amber-300 min-h-[32px]"
                            >
                              Retificar
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{n.texto}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
