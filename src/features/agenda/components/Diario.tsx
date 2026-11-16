import { useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { safeGet, safeSet } from '../../../shared/lib/safeStorage';

const CHAVE_DIARIO = 'mm_agenda_diario';

/**
 * Diário pré-sessão (protótipo 1:1): contador de caracteres em tempo
 * real e salvamento com feedback. O texto persiste em localStorage —
 * é pessoal e nunca sai do aparelho. Toast pelo sistema global.
 */
export function Diario() {
  const setToast = useAppStore((s) => s.setToast);
  const [texto, setTexto] = useState(() => safeGet(CHAVE_DIARIO) ?? '');
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    if (!texto.trim()) {
      setToast('Escreva uma reflexão antes de salvar o lembrete.', 'error');
      document.getElementById('diary-textarea')?.focus();
      return;
    }
    if (!safeSet(CHAVE_DIARIO, texto)) {
      setToast('Não foi possível salvar neste navegador (armazenamento indisponível).', 'error');
      return;
    }
    setSalvo(true);
    setToast('Reflexão salva só neste navegador, sem criptografia: quem tiver acesso ao aparelho pode ler.', 'success');
    window.setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="bg-gradient-to-r from-white to-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:border-slate-200">
      <h4 className="text-sm font-bold text-tinta-900 flex items-center gap-2 mb-2">
        <NotebookPen size={16} className="text-emerald-600 animate-pulse" />
        Meu Diário Pré-Sessão (Opcional)
      </h4>
      <p className="text-xs text-slate-600 mb-3 leading-relaxed">
        Quer anotar algum tema ou sensação que você gostaria de conversar hoje com a psicóloga? Estas anotações são só suas.
      </p>
      <div className="relative">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-tinta-700 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 transition-all resize-none shadow-none"
          id="diary-textarea"
          placeholder="Ex: Senti ansiedade no simulado de domingo, quero falar sobre isso..."
          rows={2}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-slate-500 font-mono tabular-nums" id="char-counter">
            {texto.length} {texto.length === 1 ? 'caractere' : 'caracteres'}
          </span>
          <button
            onClick={salvar}
            id="btn-save-diary"
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm flex items-center gap-1.5 active:scale-95 ${
              salvo
                ? 'bg-emerald-500 text-midnight-950'
                : 'bg-slate-100 hover:bg-amber-500 hover:text-midnight-950 text-slate-200'
            }`}
          >
            <span id="btn-save-diary-text">{salvo ? '✓ Salvo no seu cofre!' : 'Salvar Lembrete Pessoal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
