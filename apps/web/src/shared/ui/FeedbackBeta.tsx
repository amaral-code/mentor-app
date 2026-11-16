import { useState } from 'react';
import { MessageSquareHeart } from 'lucide-react';
import { privacidadeRepository } from '@mentor/api/PrivacidadeRepository';
import { problemaNoFeedback, type TipoFeedback } from '@mentor/core/privacidade';
import { useAppStore } from '@mentor/state/appStore';
import { rastrear } from '../lib/observabilidade';

const TIPOS: { id: TipoFeedback; rotulo: string }[] = [
  { id: 'problema', rotulo: 'Algo deu errado' },
  { id: 'ideia', rotulo: 'Tenho uma ideia' },
  { id: 'elogio', rotulo: 'Gostei' },
];

/**
 * Canal de feedback do beta (#74). A tela de onde a pessoa veio vai junto
 * (`activeTab`), porque "o botão não funciona" sem saber qual botão não
 * se resolve. A nota de 0 a 10 é a pergunta do NPS, e é opcional.
 */
export function FeedbackBeta() {
  const tela = useAppStore((s) => s.activeTab);
  const setToast = useAppStore((s) => s.setToast);
  const [tipo, setTipo] = useState<TipoFeedback>('problema');
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const f = { tipo, texto, nota, tela };
    const problema = problemaNoFeedback(f);
    if (problema) {
      setErro(problema);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await privacidadeRepository.enviarFeedback(f, `web ${import.meta.env.MODE}`);
      rastrear('feedback_enviado', { tipo });
      setTexto('');
      setNota(null);
      setToast('Recebido. Obrigado por ajudar a melhorar o app!', 'success');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar agora.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section id="secao-feedback" className="cartao p-5 scroll-mt-24 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
        <MessageSquareHeart className="w-4 h-4 text-ceu-500" aria-hidden />
        Conte para a gente
      </h2>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de mensagem">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tipo === t.id}
            onClick={() => setTipo(t.id)}
            className={`px-3 py-1.5 rounded-full border-2 text-sm font-bold ${tipo === t.id ? 'border-ceu-500 bg-ceu-50 text-ceu-700' : 'border-slate-200 text-slate-600'}`}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
      <textarea
        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm min-h-24"
        placeholder={tipo === 'problema' ? 'O que aconteceu? O que você esperava?' : 'Escreva aqui'}
        maxLength={2000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <fieldset>
        <legend className="text-sm text-slate-600 mb-2">De 0 a 10, quanto você indicaria o app a um amigo? (opcional)</legend>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              aria-pressed={nota === n}
              onClick={() => setNota(nota === n ? null : n)}
              className={`w-9 h-9 rounded-lg border-2 text-sm font-bold tabular-nums ${nota === n ? 'border-ceu-500 bg-ceu-500 text-white' : 'border-slate-200 text-slate-600'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <button type="button" className="btn-primary" onClick={enviar} disabled={enviando}>
        {enviando ? 'Enviando...' : 'Enviar'}
      </button>
    </section>
  );
}
