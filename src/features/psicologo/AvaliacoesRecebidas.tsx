import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';
import type { AvaliacaoRecebida } from '../../shared/storage/PsicologiaRepository';

/**
 * O que os atendidos disseram. Sem nome, de propósito: o banco nem
 * entrega o autor para esta tela. Um adolescente não avalia com
 * sinceridade quem vai saber que foi ele.
 */
export function AvaliacoesRecebidas() {
  const [lista, setLista] = useState<AvaliacaoRecebida[] | null>(null);

  useEffect(() => {
    void psicologiaRepository.avaliacoesRecebidas().then(setLista);
  }, []);

  if (!lista) return null;

  const media = lista.length ? lista.reduce((a, b) => a + b.nota, 0) / lista.length : 0;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <Star size={16} className="text-amber-400" /> Avaliações
        </h2>
        {lista.length > 0 && (
          <span className="text-sm text-amber-300 font-bold tabular-nums">
            {media.toFixed(1)} <span className="text-gray-500 font-normal">({lista.length})</span>
          </span>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma ainda. Na vitrine aparece "sem avaliações" até a primeira chegar.
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.slice(0, 10).map((a, i) => (
            <li key={i} className="glass-light rounded-xl px-3.5 py-3 border border-white/[0.04]">
              <div className="flex items-center gap-0.5" aria-label={`${a.nota} de 5 estrelas`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={13}
                    className={n <= a.nota ? 'text-amber-400' : 'text-gray-700'}
                    fill={n <= a.nota ? 'currentColor' : 'none'}
                  />
                ))}
                <span className="text-[11px] text-gray-500 ml-2">
                  {new Date(a.criadoEm).toLocaleDateString('pt-BR')}
                </span>
              </div>
              {a.comentario && <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{a.comentario}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
