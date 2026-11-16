import { CloudOff, RefreshCw } from 'lucide-react';
import { useSincronizacaoStore } from '@mentor/state/sincronizacaoStore';

/**
 * Indicador de conectividade (#56).
 *
 * Só aparece quando há algo a dizer: sem internet, ou com operações
 * esperando no aparelho. Online e em dia, não ocupa espaço.
 */
export function IndicadorConexao() {
  const online = useSincronizacaoStore((s) => s.online);
  const pendentes = useSincronizacaoStore((s) => s.pendentes);
  const sincronizando = useSincronizacaoStore((s) => s.sincronizando);

  if (online && pendentes === 0) return null;

  const texto = !online
    ? pendentes > 0
      ? `Sem internet. ${pendentes === 1 ? '1 atividade guardada' : `${pendentes} atividades guardadas`} no aparelho.`
      : 'Sem internet. O que você fizer fica guardado e sincroniza depois.'
    : sincronizando
      ? 'Sincronizando o que ficou guardado...'
      : `${pendentes === 1 ? '1 atividade esperando' : `${pendentes} atividades esperando`} para sincronizar.`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${online ? 'bg-ceu-50 text-ceu-700 border border-ceu-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}
    >
      {online ? <RefreshCw size={14} className={sincronizando ? 'motion-safe:animate-spin' : ''} aria-hidden="true" /> : <CloudOff size={14} aria-hidden="true" />}
      <span>{texto}</span>
    </div>
  );
}
