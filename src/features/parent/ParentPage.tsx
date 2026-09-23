import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { BellRing, GraduationCap, HeartHandshake, LogOut, Moon, UserPlus } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import { ParentsDashboard } from './ParentsDashboard';
import { PainelCuidado } from './PainelCuidado';
import { EntrarPorCodigo } from './EntrarPorCodigo';
import { AcessoPsicologo } from '../psicologia/AcessoPsicologo';
import { CaixaMensagens } from '../psicologia/CaixaMensagens';

/**
 * A escolha de QUAL filho está sendo visto vive aqui, e não dentro de
 * cada painel.
 *
 * Antes cada painel resolvia isso por conta própria, e com dado de
 * verdade isso vira um bug com cara de dado errado: o painel de cuidado
 * mostrando um filho e o de desempenho mostrando outro, sem nada na tela
 * dizendo que são pessoas diferentes.
 */
export function ParentPage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);
  const vinculos = useMarketplaceStore((s) => s.vinculos);
  const carregarVinculos = useMarketplaceStore((s) => s.carregarVinculos);

  const [alunoId, setAlunoId] = useState<string | null>(null);
  /* A pagina empilhava tudo: no celular passava de 5 mil pixels, e o
     "como meu filho esta indo?" ficava depois de consultas, catalogo,
     autorizacao e mensagens. Abas por pergunta.
     `null` ate os alertas carregarem: a aba inicial depende deles. */
  const [aba, setAba] = useState<'estudos' | 'cuidado' | 'vincular' | null>(null);
  const alertas = useMarketplaceStore((s) => s.alertas);
  const carregarAlertas = useMarketplaceStore((s) => s.carregarAlertas);

  useEffect(() => {
    void carregarVinculos();
  }, [carregarVinculos]);

  const alunos = vinculos
    .filter((v) => v.status === 'ativo')
    .map((v) => ({ id: v.alunoId, nome: v.alunoNome ?? 'Estudante' }));

  const aluno = alunos.find((a) => a.id === alunoId) ?? alunos[0] ?? null;

  /* Decisao que ja existia (o cuidado vinha antes dos graficos): quem
     abre o painel DEPOIS DE UM ALERTA precisa do caminho para agir, nao
     de serie historica. Com alerta aberto, a pagina abre em "Bem-estar e
     apoio"; sem alerta, em "Estudos". Escolha do usuario nao e desfeita. */
  const alertasAbertos = aluno
    ? alertas.filter((a) => a.alunoId === aluno.id && (a.status === 'aberto' || a.status === 'visto')).length
    : 0;
  const [alertasProntos, setAlertasProntos] = useState(false);
  const idAluno = aluno?.id;
  useEffect(() => {
    if (!idAluno) return;
    let vivo = true;
    setAlertasProntos(false);
    void carregarAlertas(idAluno).finally(() => vivo && setAlertasProntos(true));
    return () => {
      vivo = false;
    };
  }, [idAluno, carregarAlertas]);
  const abaAtual = aba ?? (alertasProntos ? (alertasAbertos > 0 ? 'cuidado' : 'estudos') : null);

  /* O responsavel conversa com o psicologo do filho numa conversa PROPRIA
     (ele e a ponta "participante"), e nao na do filho. */
  const agendamentos = useMarketplaceStore((s) => s.agendamentos);
  const psicologosDoFilho = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agendamentos) {
      if (aluno && a.alunoId === aluno.id && a.status !== 'cancelado') {
        m.set(a.psicologoId, a.psicologoNome ?? 'Profissional');
      }
    }
    return [...m].map(([id, nome]) => ({ id, nome }));
  }, [agendamentos, aluno]);

  return (
    <div className="min-h-screen" style={{ background: '#0b1120' }}>
      {/* Header */}
      <header className="glass border-b border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <Moon size={20} className="text-gray-900" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white">
                <span className="text-gradient">Midnight Mentor</span>
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wide uppercase">Painel dos Pais</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">{session?.nome}</span>
            <span className="px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-medium border border-violet-500/20">
              Responsável
            </span>
            <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {!aluno ? (
        <section className="max-w-5xl mx-auto px-4 md:px-8 py-6">
          <div className="glass rounded-2xl p-6">
            <EntrarPorCodigo variante="destaque" aoVincular={() => void carregarVinculos()} />
          </div>
        </section>
      ) : (
        <>
          {alunos.length > 1 && (
            <section className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Estudantes acompanhados">
                {alunos.map((a) => (
                  <button
                    key={a.id}
                    role="tab"
                    aria-selected={aluno.id === a.id}
                    onClick={() => setAlunoId(a.id)}
                    className={`shrink-0 px-3 py-2 rounded-xl text-sm border min-h-[44px] ${
                      aluno.id === a.id
                        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                        : 'border-white/[0.04] glass-light text-gray-400'
                    }`}
                  >
                    {a.nome}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
            <div
              role="tablist"
              aria-label="Painel do responsável"
              className="grid grid-cols-3 sm:flex gap-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-1 sm:w-fit"
            >
              {([
                ['estudos', 'Estudos', GraduationCap],
                ['cuidado', 'Bem-estar e apoio', HeartHandshake],
                ['vincular', 'Outro estudante', UserPlus],
              ] as const).map(([id, rotulo, Icone]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={abaAtual === id}
                  onClick={() => setAba(id)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-center leading-tight transition-all min-h-[52px] sm:min-h-[40px] ${
                    abaAtual === id
                      ? 'bg-violet-500/15 text-violet-100 border border-violet-500/30'
                      : 'text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Icone size={15} /> {rotulo}
                  {id === 'cuidado' && alertasAbertos > 0 && (
                    <span className="absolute top-1 right-1 sm:static min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" aria-label={`${alertasAbertos} alerta(s) aberto(s)`}>
                      {alertasAbertos}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Alerta aberto aparece em QUALQUER aba: quem esta olhando
                graficos nao pode deixar de ver que ha algo para agir. */}
            {alertasAbertos > 0 && abaAtual !== 'cuidado' && (
              <button
                type="button"
                onClick={() => setAba('cuidado')}
                className="mt-3 w-full text-left rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3 flex items-center gap-3 min-h-[52px]"
              >
                <BellRing size={16} className="text-red-300 shrink-0" />
                <span className="text-sm text-red-100">
                  {alertasAbertos === 1 ? 'Há 1 alerta' : `Há ${alertasAbertos} alertas`} sobre {aluno.nome}. Toque para ver o que fazer.
                </span>
              </button>
            )}
          </section>

          {abaAtual === null ? (
            <section className="max-w-5xl mx-auto px-4 md:px-8 py-6" aria-hidden="true">
              <div className="glass rounded-2xl h-48 animate-pulse" />
            </section>
          ) : abaAtual === 'estudos' ? (
            <ParentsDashboard aluno={aluno} />
          ) : abaAtual === 'cuidado' ? (
            <>
              <PainelCuidado aluno={aluno} />
              <section className="max-w-5xl mx-auto px-4 md:px-8 pb-10 space-y-5">
                <AcessoPsicologo aluno={aluno} papel="responsavel" />
                {session && <CaixaMensagens meuId={session.uid} psicologos={psicologosDoFilho} />}
              </section>
            </>
          ) : (
            <section className="max-w-5xl mx-auto px-4 md:px-8 py-6 pb-10">
              <div className="glass rounded-2xl p-5">
                {/* O proprio EntrarPorCodigo ja traz o titulo "Vincular
                    outro estudante": um h2 aqui virava titulo em dobro. */}
                <EntrarPorCodigo aoVincular={() => void carregarVinculos()} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
