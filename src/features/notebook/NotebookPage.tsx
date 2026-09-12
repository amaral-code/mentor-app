import { useState, useEffect } from 'react';
import { useAppStore, persistir } from '../../stores/appStore';
import { Nota } from '../../shared/types';
import { playClick } from '../../shared/lib/sfx';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { NotebookPen, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { atrasoDoItem } from '../../shared/lib/motionPresets';
import { Mascot } from '../../shared/ui/Mascot';

export function NotebookPage() {
  const reduzir = useReducedMotion();
  const notas = useAppStore((s) => s.notas);
  const setNotas = useAppStore((s) => s.setNotas);
  const addNota = useAppStore((s) => s.addNota);
  const setShowNotebookStudio = useAppStore((s) => s.setShowNotebookStudio);
  const [newText, setNewText] = useState('');
  const [newTag, setNewTag] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // As notas ja vem do banco no boot (App.tsx) e o store persiste cada
  // alteracao. Nao ha mais copia em localStorage para sincronizar.

  function handleAdd() {
    if (!newText.trim()) return;
    playClick();
    const nota: Nota = {
      id: `tmp_${Date.now()}`, // provisorio: o store troca pelo id do banco
      text: newText.trim(),
      data: new Date().toISOString(),
      tag: newTag.trim() || undefined,
    };
    addNota(nota);
    setNewText(''); setNewTag('');
  }

  function handleDelete(id: string) {
    // Guarda o estado anterior ANTES de mexer na tela: se o banco recusar,
    // e ele que volta. Sem isso a anotacao sumia da tela, a exclusao
    // falhava, e ela reaparecia sozinha no proximo carregamento.
    const anterior = notas;
    setNotas(notas.filter(n => n.id !== id));
    persistir(supabaseRepository.deleteNota(id), {
      aoFalhar: () => setNotas(anterior),
      mensagem: 'Não foi possível apagar a anotação. Ela continua no seu caderno.',
    });
  }

  function handleEdit(id: string) { const nota = notas.find(n => n.id === id); if (nota) { setEditingId(id); setEditText(nota.text); } }

  function handleSaveEdit(id: string) {
    if (!editText.trim()) return;
    const anterior = notas;
    setNotas(notas.map(n => n.id === id ? { ...n, text: editText.trim() } : n));
    persistir(supabaseRepository.updateNota(id, editText.trim()), {
      aoFalhar: () => setNotas(anterior),
      mensagem: 'Não foi possível salvar a edição. O texto anterior foi mantido.',
    });
    setEditingId(null); setEditText('');
  }

  const tagColors: Record<string, string> = {
    chat: 'border-l-blue-500/40', erro: 'border-l-red-500/40', resumo: 'border-l-emerald-500/40',
    revisao: 'border-l-purple-500/40', redacao: 'border-l-amber-500/40',
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-600/10 flex items-center justify-center">
            <NotebookPen size={19} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Caderno de Estudos</h1>
            <p className="text-sm text-gray-500 mt-0.5">{notas.length} anotações</p>
          </div>
        </div>
        <button onClick={() => setShowNotebookStudio(true)} className="btn-secondary text-sm px-4 py-2 min-h-[44px] press inline-flex items-center gap-1.5">
          <Sparkles size={15} className="text-amber-400" />
          Studio
        </button>
      </div>

      {/* Add note */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Nova Anotação</h2>
        <textarea
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Digite sua anotação..."
          rows={3}
          className="w-full resize-none text-sm mb-3"
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Tag (opcional) - chat, erro, resumo, revisão..."
              className="w-full text-sm pr-8"
            />
            {newTag && (
              <button
                onClick={() => setNewTag('')}
                aria-label="Limpar tag"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button onClick={handleAdd} disabled={!newText.trim()} className="btn-primary shrink-0">
            + Adicionar
          </button>
        </div>
      </div>

      {/* Notes grid */}
      {notas.length === 0 ? (
        <div className="text-center py-14 flex flex-col items-center">
          {/* Estado vazio com o mascote: uma caixa vazia nao convida a nada */}
          <img
            src="/assets/sagui_estudando_caderno_2.png"
            alt=""
            width={128}
            height={128}
            loading="lazy"
            className="w-32 h-32 object-contain mb-3 opacity-90 motion-safe:animate-float-suave"
          />
          <p className="text-gray-300 font-medium">O caderno está em branco</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Salve uma resposta do Mentor ou escreva o primeiro resumo. O sagui guarda para você.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notas.map((nota, i) => {
            const borderColor = tagColors[nota.tag?.toLowerCase() || ''] || 'border-l-gray-500/30';
            return (
              <m.div
                key={nota.id}
                layout={reduzir ? false : 'position'}
                initial={reduzir ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduzir ? { duration: 0 } : { delay: atrasoDoItem(i), duration: 0.25 }}
                className={`glass rounded-2xl p-5 flex flex-col border-l-4 ${borderColor}`}
              >
                {editingId === nota.id ? (
                  <div className="space-y-3">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4} className="w-full resize-none text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(nota.id)} className="btn-primary text-xs py-1.5">Salvar</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1.5">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed flex-1">{nota.text}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.03]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-600 tabular-nums">{new Date(nota.data).toLocaleDateString()}</span>
                        {nota.tag && <span className="badge badge-amber">{nota.tag}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(nota.id)}
                          aria-label="Editar nota"
                          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all press"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(nota.id)}
                          aria-label="Excluir nota"
                          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all press"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </m.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
