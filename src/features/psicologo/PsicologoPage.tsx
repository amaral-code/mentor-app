import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, LogOut, Moon, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { marketplaceRepository } from '../../shared/storage/MarketplaceRepository';
import { getSupabase } from '../../shared/lib/supabase';
import { ListaConsultas } from '../marketplace/ListaConsultas';
import type { JanelaDisponibilidade } from '../../shared/types';
import { PainelPacientes } from './PainelPacientes';
import { ConversasProfissional } from './ConversasProfissional';
import { AvaliacoesRecebidas } from './AvaliacoesRecebidas';
import { useMarketplaceStore } from '../../stores/marketplaceStore';

/**
 * Painel do profissional.
 *
 * Sem esta tela o papel `psychologist` cairia no app do aluno - ele
 * veria quiz e ranking, e nao teria onde declarar horario.
 *
 *   1. AGENDA - as consultas dele, com o link da sala.
 *   2. PACIENTES (027) - o que cada consentimento libera, e o prontuario.
 *   3. MENSAGENS (027) - com estudantes e com responsaveis, separadas.
 *   4. JANELAS SEMANAIS - o insumo de onde os horarios sao derivados.
 *   5. AVALIACOES - sem o nome de quem avaliou.
 *
 * O que continua NAO existindo aqui, de proposito: conversa com o
 * Mentor, caderno e humor escrito pelo aluno. Nenhum consentimento
 * libera isso; nem existe escopo para esse pedido no banco.
 */

const DIAS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

export function PsicologoPage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);
  const setToast = useAppStore((s) => s.setToast);
  const [janelas, setJanelas] = useState<JanelaDisponibilidade[]>([]);
  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState('14:00');
  const [fim, setFim] = useState('20:00');
  const [salvando, setSalvando] = useState(false);
  const agendamentos = useMarketplaceStore((s) => s.agendamentos);
  // Quem e estudante entre os interlocutores: o resto e responsavel.
  const idsPacientes = useMemo(() => new Set(agendamentos.map((a) => a.alunoId)), [agendamentos]);

  useEffect(() => {
    if (!session) return;
    void marketplaceRepository.carregarDisponibilidade(session.uid).then(setJanelas);
  }, [session?.uid]);

  async function adicionar() {
    const sb = getSupabase();
    if (!sb || !session) return;
    if (fim <= inicio) {
      setToast('O fim precisa ser depois do início.', 'error');
      return;
    }

    setSalvando(true);
    const { error } = await sb.from('psicologo_disponibilidade').insert({
      psicologo_id: session.uid,
      dia_semana: dia,
      hora_inicio: inicio,
      hora_fim: fim,
    });
    setSalvando(false);

    if (error) {
      setToast('Não foi possível salvar esta janela.', 'error');
      return;
    }
    setJanelas(await marketplaceRepository.carregarDisponibilidade(session.uid));
    setToast('Janela adicionada. Os horários já aparecem no catálogo.', 'success');
  }

  async function remover(janela: JanelaDisponibilidade) {
    const sb = getSupabase();
    if (!sb || !session) return;

    const { error } = await sb
      .from('psicologo_disponibilidade')
      .delete()
      .eq('psicologo_id', session.uid)
      .eq('dia_semana', janela.diaSemana)
      .eq('hora_inicio', janela.horaInicio);

    if (error) {
      setToast('Não foi possível remover.', 'error');
      return;
    }
    setJanelas(await marketplaceRepository.carregarDisponibilidade(session.uid));
  }

  return (
    <div className="min-h-screen" style={{ background: '#0b1120' }}>
      <header className="glass border-b border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Moon size={20} className="text-gray-900" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white">
                <span className="text-gradient">Midnight Mentor</span>
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wide uppercase">Painel do Profissional</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">{session?.nome}</span>
            <span className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-medium border border-cyan-500/20">
              Psicólogo(a)
            </span>
            <button
              onClick={logout}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-5">
        <ListaConsultas />

        <PainelPacientes />

        {session && <ConversasProfissional meuId={session.uid} idsPacientes={idsPacientes} />}

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <CalendarClock size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-300">Disponibilidade semanal</h2>
              <p className="text-[11px] text-gray-500">
                Os horários oferecidos às famílias saem daqui, já descontando o que estiver ocupado.
              </p>
            </div>
          </div>

          {janelas.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">
              Nenhuma janela declarada. Por enquanto você não aparece com horários no catálogo.
            </p>
          ) : (
            <div className="space-y-1.5 mb-4">
              {janelas.map((j) => (
                <div
                  key={`${j.diaSemana}-${j.horaInicio}`}
                  className="flex items-center justify-between text-sm py-2 px-3 rounded-xl glass-light"
                >
                  <span className="text-gray-300">
                    {DIAS[j.diaSemana]} · {j.horaInicio} às {j.horaFim}
                  </span>
                  <button
                    onClick={() => remover(j)}
                    aria-label={`Remover janela de ${DIAS[j.diaSemana]}`}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-white/[0.04]">
            <label className="text-[11px] text-gray-500">
              Dia
              <select
                value={dia}
                onChange={(e) => setDia(Number(e.target.value))}
                className="block mt-1 bg-transparent text-sm text-white border border-white/[0.06] rounded-lg px-2 py-1.5"
              >
                {DIAS.map((d, i) => (
                  <option key={d} value={i} className="bg-slate-900">
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] text-gray-500">
              Das
              <input
                type="time"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="block mt-1 bg-transparent text-sm text-white border border-white/[0.06] rounded-lg px-2 py-1.5"
              />
            </label>

            <label className="text-[11px] text-gray-500">
              As
              <input
                type="time"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="block mt-1 bg-transparent text-sm text-white border border-white/[0.06] rounded-lg px-2 py-1.5"
              />
            </label>

            <button onClick={adicionar} disabled={salvando} className="btn-primary !px-4 !py-2 text-sm inline-flex items-center gap-1.5">
              <Plus size={15} /> Adicionar
            </button>
          </div>
        </div>

        <AvaliacoesRecebidas />

        <div className="glass-light rounded-xl px-4 py-3 text-xs text-gray-500 leading-relaxed flex gap-2">
          <Stethoscope size={15} className="text-cyan-400 shrink-0 mt-0.5" />
          <span>
            Com consulta marcada, você vê nome e horário. Índice de cansaço e ritmo de estudo só
            aparecem se o paciente (ou o responsável, se ele tiver menos de 16 anos) autorizar, e
            pelo prazo que ele escolher. Conversas com o Mentor, caderno e registros de humor não
            são acessíveis a nenhum perfil além do próprio estudante.
          </span>
        </div>
      </section>
    </div>
  );
}
