import { useState } from 'react';
import { Star } from 'lucide-react';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';

/**
 * Avaliação de uma consulta que já aconteceu. O banco confere de novo
 * (quem participou, depois do fim, uma vez só); aqui a tela só evita
 * oferecer o que ele vai recusar.
 *
 * O aviso de anonimato vem ANTES das estrelas: é ele que decide se a
 * nota vai ser sincera.
 */
export function AvaliarConsulta({ agendamentoId, aoAvaliar }: { agendamentoId: string; aoAvaliar: () => void }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar() {
    if (nota < 1 || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      await psicologiaRepository.avaliar(agendamentoId, nota, comentario);
      aoAvaliar();
    } catch (e) {
      const bruto = (e instanceof Error ? e.message : '').toLowerCase();
      setErro(bruto.includes('ja foi avaliada') ? 'Esta consulta já foi avaliada.' : 'Não foi possível enviar agora.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.05]">
      <p className="text-[11px] text-gray-500 mb-2">
        Como foi? O profissional vê a nota e o comentário, mas não quem escreveu.
      </p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nota === n}
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            onClick={() => setNota(n)}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Star size={20} className={n <= nota ? 'text-amber-400' : 'text-gray-600'} fill={n <= nota ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      {nota > 0 && (
        <div className="mt-2 space-y-2">
          <label htmlFor={`coment-${agendamentoId}`} className="sr-only">
            Comentário opcional
          </label>
          <textarea
            id={`coment-${agendamentoId}`}
            value={comentario}
            onChange={(e) => setComentario(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Comentário (opcional)"
            className="w-full px-3 py-2 rounded-xl glass-light border border-white/[0.05] text-sm text-white placeholder:text-gray-600 outline-none focus:border-amber-500/40"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="btn-primary !px-4 !py-2 text-xs disabled:opacity-40"
          >
            {enviando ? 'Enviando…' : 'Enviar avaliação'}
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-xs text-red-400 mt-2">
          {erro}
        </p>
      )}
    </div>
  );
}
