import { useEffect, useMemo, useState } from 'react';
import { Bell, HeartHandshake, ShieldQuestion, UserCheck } from 'lucide-react';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import { useAppStore } from '../../stores/appStore';
import { CatalogoPsicologos } from '../marketplace/CatalogoPsicologos';
import { ListaConsultas } from '../marketplace/ListaConsultas';
import { AcessoPsicologo } from '../psicologia/AcessoPsicologo';
import { CaixaMensagens } from '../psicologia/CaixaMensagens';

/**
 * REDE DE APOIO - tela do aluno.
 *
 * Tres coisas moram aqui, nesta ordem:
 *
 *   1. PEDIDOS DE ACOMPANHAMENTO. Quem aprova o acesso do responsavel e
 *      o estudante, nao o sistema. Sem isso, "painel dos pais" seria
 *      vigilancia com outro nome - e um adolescente que sabe estar sendo
 *      lido para de escrever no Mentor, que e onde os sinais aparecem.
 *
 *   2. CONSULTAS. As mesmas que o responsavel ve, com o link da sala.
 *
 *   3. CATALOGO. O aluno tambem pode marcar por conta propria. Nem todo
 *      mundo tem um adulto disponivel para fazer isso por ele.
 *
 * O que este painel deixa explicito: quando um alerta e enviado, e o que
 * ele contem. Transparencia aqui nao e cortesia, e o que sustenta a
 * confianca no resto do app.
 */
export function CuidadoPage() {
  const session = useAppStore((s) => s.session);
  const vinculos = useMarketplaceStore((s) => s.vinculos);
  const carregarVinculos = useMarketplaceStore((s) => s.carregarVinculos);
  const responderVinculo = useMarketplaceStore((s) => s.responderVinculo);
  const notificacoes = useMarketplaceStore((s) => s.notificacoes);
  const carregarNotificacoes = useMarketplaceStore((s) => s.carregarNotificacoes);
  const marcarNotificacaoLida = useMarketplaceStore((s) => s.marcarNotificacaoLida);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const agendamentos = useMarketplaceStore((s) => s.agendamentos);
  const psicologos = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agendamentos) {
      if (a.alunoId === session?.uid && a.status !== 'cancelado') m.set(a.psicologoId, a.psicologoNome ?? 'Profissional');
    }
    return [...m].map(([id, nome]) => ({ id, nome }));
  }, [agendamentos, session?.uid]);

  useEffect(() => {
    void carregarVinculos();
    void carregarNotificacoes();
  }, []);

  const pendentes = vinculos.filter((v) => v.status === 'pendente' && v.alunoId === session?.uid);
  const ativos = vinculos.filter((v) => v.status === 'ativo' && v.alunoId === session?.uid);
  const naoLidas = notificacoes.filter((n) => !n.lida);

  return (
    <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/15 to-pink-600/10 flex items-center justify-center">
          <HeartHandshake size={20} className="text-rose-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-white">Rede de Apoio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quem acompanha voce, e com quem voce pode conversar</p>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-amber-500/20">
          <h2 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
            <ShieldQuestion size={16} /> Pedido de acompanhamento
          </h2>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Um responsavel pediu para acompanhar seu progresso. Se voce aceitar, ele passa a ver: dias de
            estudo, tempo offline, indice de fadiga e alertas de esgotamento.{' '}
            <strong className="text-gray-300">
              Ele nunca ve suas conversas com o Mentor, suas anotacoes nem seus registros de humor.
            </strong>
          </p>

          <div className="space-y-2 mt-4">
            {pendentes.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl glass-light p-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{v.responsavelNome ?? 'Responsavel'}</p>
                  <p className="text-[11px] text-gray-500">{v.parentesco}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => responderVinculo(v.id, false)} className="btn-ghost !px-3 !py-2 text-xs text-gray-400">
                    Recusar
                  </button>
                  <button onClick={() => responderVinculo(v.id, true)} className="btn-primary !px-3 !py-2 text-xs">
                    Aceitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ativos.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
            <UserCheck size={16} className="text-emerald-400" /> Acompanham voce
          </h2>
          <div className="space-y-2">
            {ativos.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm py-2 px-3 rounded-xl glass-light">
                <span className="text-gray-300">{v.responsavelNome ?? 'Responsavel'}</span>
                <button
                  onClick={() => responderVinculo(v.id, false)}
                  className="text-[11px] text-gray-500 hover:text-red-400"
                >
                  Encerrar acesso
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
            Você pode encerrar esse acesso quando quiser, e o app avisa quem for desligado.
          </p>
        </div>
      )}

      {naoLidas.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2 mb-3">
            <Bell size={16} className="text-amber-400" /> Avisos
          </h2>
          <div className="space-y-2">
            {naoLidas.slice(0, 5).map((n) => (
              <button
                key={n.id}
                onClick={() => marcarNotificacaoLida(n.id)}
                className="w-full text-left rounded-xl glass-light p-3 hover:bg-white/[0.03]"
              >
                <p className="text-sm text-white">{n.titulo}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.corpo}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <ListaConsultas />

      {session && (
        <>
          <AcessoPsicologo aluno={{ id: session.uid, nome: session.nome }} papel="aluno" />
          <CaixaMensagens meuId={session.uid} psicologos={psicologos} />
        </>
      )}

      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300">Falar com um psicologo</h2>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          Atendimento online, por videochamada, com profissional registrado no CRP. Voce pode marcar por
          conta própria: o valor e o horário aparecem antes de qualquer confirmação.
        </p>
        {!mostrarCatalogo ? (
          <button onClick={() => setMostrarCatalogo(true)} className="btn-primary text-sm mt-4">
            Ver profissionais
          </button>
        ) : (
          <div className="mt-4">
            <CatalogoPsicologos
              aluno={session ? { id: session.uid, nome: session.nome } : null}
            />
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-600 leading-relaxed px-4 py-3 glass-light rounded-xl">
        Em caso de crise, ligue 188 (CVV, 24h, gratuito) ou procure o CAPS mais proximo. Este app nao
        substitui atendimento de emergencia.
      </p>
    </div>
  );
}
