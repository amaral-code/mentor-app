import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@mentor/state/appStore';
import { transmitirChat } from '@mentor/core/chatStream';
import { DEEPSEEK_TIMEOUT_MS, isCancelamentoUsuario, modeloAtual, provedorAtual, sinalComTimeout } from '@mentor/core/aiProvider';
import { aiProxyToken, temBackendIA, urlBackendIA } from '@mentor/core/runtimeConfig';
import { getBotReply } from '@mentor/core/mentorLocal';
import { heuristicaFrustracao } from '@mentor/core/frustration';
import type { ChatMessage } from '@mentor/core/types';
import { fetchComStream } from '../../lib/fetchComStream';
import { anunciar } from '../../ui/acessibilidade';

export type ModoResposta = 'explicativo' | 'comunicativo';

const novoId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

interface Opcoes {
  modo: string;
  personaId: string;
  modoResposta: ModoResposta;
  materiaRecente: string | null;
}

/**
 * Envio de mensagens ao Mentor, com a resposta chegando em pedaços.
 *
 * `parcial` é o texto da resposta enquanto ela é escrita; vira mensagem
 * de verdade (store e banco) só no fim. Se o aluno trocar de conversa no
 * meio, a resposta é salva na conversa de origem, como no web.
 */
export function useConversaMentor({ modo, personaId, modoResposta, materiaRecente }: Opcoes) {
  const [parcial, setParcial] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [pedirPausa, setPedirPausa] = useState(false);
  const controle = useRef<AbortController | null>(null);

  useEffect(() => () => controle.current?.abort(), []);

  const cancelar = useCallback(() => controle.current?.abort(), []);

  const enviar = useCallback(
    async (texto: string) => {
      const limpo = texto.trim();
      if (!limpo) return;
      const app = useAppStore.getState();
      if (gerando) {
        app.setToast('Aguarde a resposta atual terminar.', 'info');
        return;
      }
      setGerando(true);
      setParcial('');
      const conversaId = app.conversaAtivaId;
      app.addChatMessage({ id: novoId(), role: 'user', text: limpo, timestamp: Date.now() }, conversaId);
      const humor = await app.detectAndSetMood(limpo);

      const historico = useAppStore
        .getState()
        .chatMessages.filter((m) => m.text.trim())
        .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('model' as const), text: m.text }));

      const salvar = (msg: ChatMessage) => {
        useAppStore.getState().addChatMessage(msg, conversaId);
        setParcial(null);
        setGerando(false);
        anunciar('Resposta do Mentor pronta.');
      };

      const planoB = (motivo: string) => {
        useAppStore.getState().setToast(motivo, 'error');
        const persona = useAppStore.getState().personas.find((p) => p.id === personaId) ?? null;
        salvar({ id: novoId(), role: 'assistant', text: getBotReply(limpo, humor, persona), timestamp: Date.now(), mood: humor, modoResposta });
      };

      if (!temBackendIA()) {
        planoB('Sem conexão com o servidor do Mentor. Respondendo com a base local.');
        return;
      }

      controle.current = new AbortController();
      const headers: Record<string, string> = {};
      const token = aiProxyToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const fim = await transmitirChat({
          url: urlBackendIA('/api/chat/completions'),
          headers,
          fetch: fetchComStream,
          signal: sinalComTimeout(controle.current.signal, DEEPSEEK_TIMEOUT_MS),
          corpo: {
            provider: provedorAtual(),
            model: modeloAtual(),
            modo,
            // O servidor corta em 10; mandar mais só gastaria rede.
            mensagens: historico.slice(-10),
            horaLocal: new Date().getHours(),
            materiaRecente: materiaRecente ?? undefined,
            modoResposta,
          },
          aoParcial: setParcial,
        });
        const falasAluno = historico.filter((h) => h.role === 'user').map((h) => h.text);
        if (fim.frustrationDetected || heuristicaFrustracao(falasAluno)) setPedirPausa(true);
        salvar({
          id: novoId(),
          role: 'assistant',
          text: fim.texto,
          timestamp: Date.now(),
          mood: humor,
          modoResposta,
          fontes: fim.fontes,
          groundingUsado: fim.groundingUsado,
          citouProva: fim.citouProva,
          modoChat: fim.modo,
        });
      } catch (erro) {
        if (isCancelamentoUsuario(erro, controle.current?.signal)) {
          // O aluno parou de propósito: o que já chegou fica, sem toast de erro.
          setParcial((atual) => {
            if (atual?.trim()) {
              useAppStore.getState().addChatMessage({ id: novoId(), role: 'assistant', text: `${atual.trim()}\n\n*(resposta interrompida)*`, timestamp: Date.now() }, conversaId);
            }
            return null;
          });
          setGerando(false);
          return;
        }
        planoB(erro instanceof Error ? erro.message : 'Erro ao conectar com a IA. Usando a base local.');
      }
    },
    [gerando, modo, modoResposta, materiaRecente, personaId],
  );

  return { enviar, cancelar, parcial, gerando, pedirPausa, fecharPausa: () => setPedirPausa(false) };
}
