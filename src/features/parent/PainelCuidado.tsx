import { useEffect, useMemo, useState } from 'react';
import { Activity, BellRing, HeartPulse, Link2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import { bemEstarRepository } from '../../shared/storage/BemEstarRepository';
import { focoOfflineRepository } from '../../shared/storage/FocoOfflineRepository';
import { COR_CLASSE, ROTULO_CLASSE, FADIGA_ZERADA } from '../../shared/lib/burnoutModel';
import { EntrarPorCodigo } from './EntrarPorCodigo';
import { CatalogoPsicologos } from '../marketplace/CatalogoPsicologos';
import { ListaConsultas } from '../marketplace/ListaConsultas';
import type { IndiceBurnout, RelatorioSemanal, SessaoOffline, SeveridadeAlerta } from '../../shared/types';

/**
 * PAINEL DE CUIDADO DO RESPONSAVEL.
 *
 * E a metade "acionavel" do painel dos pais: a curva de estresse do
 * filho, os alertas que ela disparou e o caminho direto para agendar um
 * atendimento - catalogo, valor, horario e pagamento na mesma tela.
 *
 * O QUE ESTE PAINEL NAO MOSTRA, DE PROPOSITO
 * Conversas com o Mentor, anotacoes do caderno e registros de humor
 * escritos pelo estudante. A RLS nem sequer devolve esses dados para
 * este papel (migracao 011). O responsavel ve PADRAO - horario, ritmo,
 * constancia, indice - e nao conteudo. Isso e o que permite ao aluno
 * continuar escrevendo com honestidade no app, que e de onde os sinais
 * vem.
 *
 * ALERTA SEM ACAO E SO SUSTO: por isso todo alerta de severidade alta
 * abre, no proprio card, o botao que leva ao catalogo com aquele alerta
 * amarrado ao agendamento.
 */

const CORES_SEVERIDADE: Record<SeveridadeAlerta, { borda: string; texto: string; fundo: string }> = {
  info: { borda: 'border-sky-500/20', texto: 'text-sky-300', fundo: 'bg-sky-500/[0.07]' },
  atencao: { borda: 'border-amber-500/20', texto: 'text-amber-300', fundo: 'bg-amber-500/[0.07]' },
  alto: { borda: 'border-orange-500/25', texto: 'text-orange-300', fundo: 'bg-orange-500/[0.08]' },
  critico: { borda: 'border-red-500/30', texto: 'text-red-300', fundo: 'bg-red-500/[0.09]' },
};

export function PainelCuidado() {
  const { alertas, carregarAlertas, marcarAlertaVisto, vinculos, carregarVinculos, solicitarVinculo } =
    useMarketplaceStore();

  const [alunos, setAlunos] = useState<{ id: string; nome: string }[]>([]);
  const [alunoAtivo, setAlunoAtivo] = useState<{ id: string; nome: string } | null>(null);
  const [burnout, setBurnout] = useState<IndiceBurnout[]>([]);
  const [offline, setOffline] = useState<SessaoOffline[]>([]);
  const [relatorios, setRelatorios] = useState<RelatorioSemanal[]>([]);
  const [emailAluno, setEmailAluno] = useState('');
  const [alertaEmFoco, setAlertaEmFoco] = useState<string | null>(null);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

  useEffect(() => {
    void carregarVinculos();
  }, []);

  useEffect(() => {
    const ativos = vinculos
      .filter((v) => v.status === 'ativo')
      .map((v) => ({ id: v.alunoId, nome: v.alunoNome ?? 'Estudante' }));
    setAlunos(ativos);
    if (!alunoAtivo && ativos.length > 0) setAlunoAtivo(ativos[0]);
  }, [vinculos]);

  useEffect(() => {
    if (!alunoAtivo) return;
    void carregarAlertas(alunoAtivo.id);
    // Fadiga zerada (ver burnoutModel.FADIGA_ZERADA): a curva nasce e fica
    // em 0/saudável em vez de refletir o histórico antigo do servidor.
    void bemEstarRepository.carregarBurnout(30, alunoAtivo.id).then((lista) =>
      setBurnout(FADIGA_ZERADA ? lista.map((d) => ({ ...d, score: 0, classe: 'saudavel' as const })) : lista),
    );
    void focoOfflineRepository.listarSessoes(30, alunoAtivo.id).then(setOffline);
    void bemEstarRepository.listarRelatorios(3, alunoAtivo.id).then(setRelatorios);
  }, [alunoAtivo?.id]);

  const atual = burnout.at(-1);
  const abertos = alertas.filter((a) => a.status === 'aberto' || a.status === 'visto');

  const minutosOfflineSemana = useMemo(() => {
    const corte = Date.now() - 7 * 86400000;
    return offline
      .filter((s) => new Date(s.inicio).getTime() >= corte)
      .reduce((a, s) => a + s.minutosOffline, 0);
  }, [offline]);

  const pendentes = vinculos.filter((v) => v.status === 'pendente');

  async function pedirVinculo() {
    const email = emailAluno.trim();
    if (!email) return;
    const ok = await solicitarVinculo(email, 'responsavel');
    if (ok) setEmailAluno('');
  }

  // Sem nenhum filho vinculado, o painel e a tela de vinculo.
  if (alunos.length === 0) {
    return (
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <div className="glass rounded-2xl p-6">
          <EntrarPorCodigo variante="destaque" aoVincular={() => void carregarVinculos()} />

          {/* O pedido por e-mail continua aqui, recolhido: e o caminho de
              quem nao tem o estudante por perto na hora. Fica em segundo
              plano porque nele quem comeca e o adulto, e o estudante so
              reage a um pedido que nao escolheu receber. */}
          <details className="mt-5 group">
            <summary className="text-xs text-gray-500 hover:text-violet-300 cursor-pointer list-none inline-flex items-center gap-1.5 min-h-[40px]">
              <Link2 size={13} /> Não tem o código? Pedir por e-mail
            </summary>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              O estudante recebe o pedido e decide se aceita — e só então os dados
              aparecem aqui. Nem antes, nem sem que ele saiba.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input
                type="email"
                value={emailAluno}
                onChange={(e) => setEmailAluno(e.target.value)}
                placeholder="email-do-estudante@exemplo.com"
                aria-label="E-mail do estudante"
                className="flex-1 px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white placeholder:text-gray-600 outline-none focus:border-violet-500/40 min-h-[44px]"
              />
              <button onClick={pedirVinculo} className="btn-secondary px-5 text-sm min-h-[44px]">
                Enviar pedido
              </button>
            </div>
            {pendentes.length > 0 && (
              <p className="text-xs text-amber-400/80 mt-3">
                {pendentes.length} pedido(s) aguardando resposta do estudante.
              </p>
            )}
          </details>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-5">
      {alunos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {alunos.map((a) => (
            <button
              key={a.id}
              onClick={() => setAlunoAtivo(a)}
              className={`shrink-0 px-3 py-2 rounded-xl text-sm border ${
                alunoAtivo?.id === a.id
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                  : 'border-white/[0.04] glass-light text-gray-400'
              }`}
            >
              {a.nome}
            </button>
          ))}
        </div>
      )}

      {/* Curva de estresse */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <HeartPulse size={18} className="text-rose-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-300">Curva de estresse de {alunoAtivo?.nome}</h2>
            <p className="text-[11px] text-gray-500">Indice diario de fadiga dos ultimos 30 dias</p>
          </div>
          {atual && (
            <div className="text-right">
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: COR_CLASSE[atual.classe] }}>
                {atual.score}
              </p>
              <p className="text-[10px]" style={{ color: COR_CLASSE[atual.classe] }}>
                {ROTULO_CLASSE[atual.classe]}
              </p>
            </div>
          )}
        </div>

        {burnout.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            Ainda nao ha dados suficientes. O indice aparece depois de algumas sessoes de estudo no app.
          </p>
        ) : (
          <div className="flex items-end gap-[3px] h-20">
            {burnout.map((d) => (
              <div
                key={d.data}
                className="flex-1 rounded-t-sm min-h-[3px]"
                style={{ height: `${Math.max(5, d.score)}%`, background: COR_CLASSE[d.classe], opacity: 0.8 }}
                title={`${new Date(`${d.data}T12:00:00`).toLocaleDateString('pt-BR')}: ${d.score}/100`}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="glass-light rounded-xl py-2.5">
            <ShieldCheck size={14} className="text-cyan-400 mx-auto" />
            <p className="text-sm font-bold text-white tabular-nums mt-1">{minutosOfflineSemana}</p>
            <p className="text-[10px] text-gray-500">min offline (7d)</p>
          </div>
          <div className="glass-light rounded-xl py-2.5">
            <Activity size={14} className="text-violet-400 mx-auto" />
            <p className="text-sm font-bold text-white tabular-nums mt-1">{burnout.length}</p>
            <p className="text-[10px] text-gray-500">dias medidos</p>
          </div>
          <div className="glass-light rounded-xl py-2.5">
            <BellRing size={14} className="text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-white tabular-nums mt-1">{abertos.length}</p>
            <p className="text-[10px] text-gray-500">alertas abertos</p>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {abertos.length > 0 && (
        <div className="space-y-3">
          {abertos.map((a) => {
            const cor = CORES_SEVERIDADE[a.severidade];
            return (
              <div key={a.id} className={`rounded-2xl border p-4 ${cor.borda} ${cor.fundo}`} role="alert">
                <div className="flex items-start gap-3">
                  <TriangleAlert size={18} className={`${cor.texto} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${cor.texto}`}>
                      {a.severidade === 'critico' ? 'Alerta critico' : 'Sinal de esgotamento'} - indice {a.score}/100
                    </p>
                    <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{a.mensagem}</p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      {new Date(a.criadoEm).toLocaleString('pt-BR')}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => {
                          setAlertaEmFoco(a.id);
                          setMostrarCatalogo(true);
                        }}
                        className="btn-primary !px-3 !py-2 text-xs"
                      >
                        Agendar atendimento
                      </button>
                      {a.status === 'aberto' && (
                        <button
                          onClick={() => marcarAlertaVisto(a.id)}
                          className="btn-ghost !px-3 !py-2 text-xs text-gray-400"
                        >
                          Marcar como visto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Relatorio de descompressao (versao do responsavel) */}
      {relatorios.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Resumo da semana</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{relatorios[0].textoGerado}</p>
          <p className="text-[11px] text-gray-600 mt-3">
            Mesmo texto que o estudante recebe. Ele fala do que sustentou a semana - sono, constancia,
            tempo offline - e nao de notas.
          </p>
        </div>
      )}

      <ListaConsultas />

      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300">Rede de psicologos</h2>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          Profissionais com CRP ativo, atendimento online. Voce escolhe o valor e o horario; o link da
          videochamada e criado automaticamente e entra na agenda do estudante e do profissional.
        </p>

        {!mostrarCatalogo ? (
          <button onClick={() => setMostrarCatalogo(true)} className="btn-primary text-sm mt-4">
            Ver profissionais
          </button>
        ) : (
          <div className="mt-4">
            <CatalogoPsicologos aluno={alunoAtivo} alertaId={alertaEmFoco} />
          </div>
        )}
      </div>

      {/* Vincular outro filho */}
      <div className="glass rounded-2xl p-5">
        <EntrarPorCodigo aoVincular={() => void carregarVinculos()} />

        <details className="mt-4">
          <summary className="text-xs text-gray-500 hover:text-violet-300 cursor-pointer list-none inline-flex items-center gap-1.5 min-h-[40px]">
            <Link2 size={13} /> Não tem o código? Pedir por e-mail
          </summary>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <input
              type="email"
              value={emailAluno}
              onChange={(e) => setEmailAluno(e.target.value)}
              placeholder="email-do-estudante@exemplo.com"
              aria-label="E-mail do estudante"
              className="flex-1 px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white placeholder:text-gray-600 outline-none focus:border-violet-500/40 min-h-[44px]"
            />
            <button onClick={pedirVinculo} className="btn-secondary px-5 text-sm min-h-[44px]">
              Enviar pedido
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}
