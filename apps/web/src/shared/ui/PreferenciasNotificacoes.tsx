import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  TIPOS_NOTIFICACAO,
  PREFERENCIAS_PADRAO,
  emSilencio,
  horaDeBrasilia,
  type PreferenciasNotificacao,
  type TipoNotificacao,
} from '@mentor/core/notificacoes';
import { notificacoesRepository } from '@mentor/api/NotificacoesRepository';
import { useAppStore } from '@mentor/state/appStore';
import { desligarPush, estadoPush, ligarPush, type EstadoPush } from '../lib/pushNavegador';

/**
 * Notificações: o aparelho e cada tipo (#55).
 *
 * Critério de aceite da issue: "Aluno controla cada tipo de notificação
 * no Perfil". Serve também ao responsável, que vê só os tipos dele.
 */
const AVISO_ESTADO: Record<EstadoPush, string> = {
  'sem-suporte': 'Este navegador não recebe notificações. No celular, instale o app pela opção "Adicionar à tela inicial".',
  'sem-servidor': 'As notificações ainda não foram ligadas neste site.',
  bloqueado: 'As notificações estão bloqueadas para este site. Libere nas configurações do navegador.',
  desligado: 'Este aparelho não recebe notificações.',
  ligado: 'Este aparelho recebe notificações.',
};

const HORAS = Array.from({ length: 24 }, (_, h) => h);

export function PreferenciasNotificacoes({ perfil }: { perfil: 'aluno' | 'responsavel' }) {
  const setToast = useAppStore((s) => s.setToast);
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasNotificacao>(PREFERENCIAS_PADRAO);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void estadoPush().then((e) => vivo && setEstado(e));
    void notificacoesRepository.carregarPreferencias().then((p) => vivo && setPrefs(p));
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(novas: PreferenciasNotificacao) {
    setPrefs(novas);
    const ok = await notificacoesRepository.salvarPreferencias(novas);
    if (!ok) setToast('Não foi possível salvar a preferência agora.', 'error');
  }

  async function alternarAparelho() {
    setOcupado(true);
    try {
      setEstado(estado === 'ligado' ? await desligarPush() : await ligarPush());
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Não foi possível ligar as notificações.', 'error');
    } finally {
      setOcupado(false);
    }
  }

  const tipos = TIPOS_NOTIFICACAO.filter((t) => t.perfil === 'todos' || t.perfil === perfil);
  const silencioAgora = emSilencio(horaDeBrasilia(), prefs.silencioInicio, prefs.silencioFim);

  return (
    <section id="secao-notificacoes" className="cartao p-5 scroll-mt-24 space-y-4" aria-labelledby="titulo-notificacoes">
      <h2 id="titulo-notificacoes" className="text-sm font-semibold text-slate-700">Notificações</h2>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-slate-600 flex-1" role="status">
          {estado ? AVISO_ESTADO[estado] : 'Verificando este aparelho...'}
        </p>
        {(estado === 'ligado' || estado === 'desligado') && (
          <button type="button" onClick={alternarAparelho} disabled={ocupado} className={estado === 'ligado' ? 'btn-secondary' : 'btn-primary'}>
            {estado === 'ligado' ? <BellOff size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}{' '}
            {estado === 'ligado' ? 'Desligar neste aparelho' : 'Ligar neste aparelho'}
          </button>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">O que avisar</legend>
        {tipos.map((t) => (
          <label key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-5 h-5 accent-ceu-500"
              checked={prefs.tipos[t.id as TipoNotificacao]}
              onChange={(e) => void salvar({ ...prefs, tipos: { ...prefs.tipos, [t.id]: e.target.checked } })}
            />
            <span>
              <span className="block text-sm font-bold text-tinta-900">{t.rotulo}</span>
              <span className="block text-xs text-slate-500">{t.descricao}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-slate-500 font-medium">
          Silêncio a partir de
          <select
            className="mt-1 w-full min-h-[44px]"
            value={prefs.silencioInicio}
            onChange={(e) => void salvar({ ...prefs, silencioInicio: Number(e.target.value) })}
          >
            {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 font-medium">
          Até
          <select
            className="mt-1 w-full min-h-[44px]"
            value={prefs.silencioFim}
            onChange={(e) => void salvar({ ...prefs, silencioFim: Number(e.target.value) })}
          >
            {HORAS.map((h) => <option key={h} value={h}>{h}h</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500 font-medium">
          No máximo por dia
          <select
            className="mt-1 w-full min-h-[44px]"
            value={prefs.limiteDiario}
            onChange={(e) => void salvar({ ...prefs, limiteDiario: Number(e.target.value) })}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        No horário de silêncio nada chega; o aviso espera e sai depois. Horário de Brasília.
        {silencioAgora && ' Agora está em silêncio.'}
        {perfil === 'responsavel' && ' Alertas de bem-estar não contam no limite do dia.'}
      </p>
    </section>
  );
}
