import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { psicologiaRepository } from '../../shared/storage/PsicologiaRepository';

/**
 * "VOCÊ TEM MENSAGEM" — a porta de entrada do aluno para a conversa.
 *
 * A Rede de Apoio (onde a conversa mora) não tem entrada no menu do
 * aluno, por decisão anterior: só abre pelo "Buscar psicólogo" da
 * Agenda. Até a Etapa 4 isso bastava. Com mensagens, não: a psicóloga
 * escrevia, a notificação chegava, e o aluno não tinha por onde
 * responder.
 *
 * Em vez de reabrir o menu, este aviso aparece SÓ quando há mensagem não
 * lida, e leva direto até ela. Sem mensagem nova, não ocupa espaço.
 */
export function AvisoMensagens() {
  const uid = useAppStore((s) => s.session?.uid);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [naoLidas, setNaoLidas] = useState(0);
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    void psicologiaRepository.conversas().then((lista) => {
      if (!vivo) return;
      const minhas = lista.filter((c) => c.participanteId === uid && c.naoLidas > 0);
      setNaoLidas(minhas.reduce((a, c) => a + c.naoLidas, 0));
      setNome(minhas.length === 1 ? minhas[0].outroNome : '');
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  if (naoLidas === 0) return null;

  return (
    <button
      type="button"
      onClick={() => setActiveTab('cuidado')}
      className="w-full text-left rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.07] px-4 py-3 flex items-center gap-3 min-h-[56px] hover:border-cyan-400/40 transition-all"
    >
      <span className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
        <MessageCircle size={17} className="text-cyan-300" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-cyan-100">
          {naoLidas === 1 ? '1 mensagem nova' : `${naoLidas} mensagens novas`}
          {nome ? ` de ${nome}` : ' do seu psicólogo'}
        </span>
        <span className="block text-xs text-cyan-200/70">Toque para ler e responder.</span>
      </span>
    </button>
  );
}
