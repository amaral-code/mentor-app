import { useEffect, useRef, useState } from 'react';
import { useAppStore, persistir } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { userRepository } from '@mentor/api/UserRepository';
import { hidratarCache } from '@mentor/api/rankingEngine';
import { getToday, proximoStreak } from '@mentor/core/utils';
import { deveGerarRelatorio } from '@mentor/core/decompressionReport';
import { iniciarCarga } from './carga';

const AVISO_LENTO = 'Conexão lenta: mostrando o que já carregou. Puxe a tela para completar.';

/**
 * Sessão e dados do usuário: o mesmo ciclo do `App.tsx` do web.
 *
 * Devolve `true` quando a primeira leitura da sessão terminou. Antes
 * disso a tela não sabe se mostra login ou a Central, e escolher errado
 * pisca o login para quem já estava logado.
 */
export function useSessaoDoApp(): boolean {
  const [sessaoLida, setSessaoLida] = useState(false);
  /* Qual usuário já teve os dados carregados. O Supabase avisa também em
     TOKEN_REFRESHED, que no celular acontece a cada volta do segundo
     plano; sem o guarda, cada volta refaria as 11 consultas do boot. */
  const uidCarregado = useRef<string | null>(null);

  useEffect(() => {
    const { setSession } = useAppStore.getState();

    void userRepository.getSession().then((s) => {
      if (s) {
        uidCarregado.current = s.uid;
        setSession(s);
        persistir(iniciarCarga(), { mensagem: AVISO_LENTO });
      }
      setSessaoLida(true);
    });

    return userRepository.onAuthChange((s) => {
      const uidNovo = s?.uid ?? null;
      if (uidNovo !== null && uidNovo === uidCarregado.current) return;
      uidCarregado.current = uidNovo;
      setSession(s);
      if (s) {
        hidratarCache({ perfil: { uid: s.uid, nome: s.nome, email: s.email, escolaId: s.escolaId ?? undefined, turmaId: s.turmaId ?? undefined } });
        persistir(iniciarCarga(), { mensagem: AVISO_LENTO });
      }
    });
  }, []);

  return sessaoLida;
}

/**
 * Efeitos do aluno que o web roda no `App.tsx`: ofensiva diária, nível
 * novo e relatório de sexta. Devolve o nível recém-alcançado (para o
 * overlay de comemoração) e a função que o fecha.
 */
export function useEfeitosDoAluno(): { nivelNovo: number | null; fecharNivel: () => void } {
  const ativo = useAppStore((s) => s.isAuthenticated && s.userRole === 'student');
  const ultimoAcesso = useAppStore((s) => s.gamification.lastAccessDate);
  const ofensiva = useAppStore((s) => s.gamification.streak);
  const nivel = useAppStore((s) => s.gamification.level);
  const relatoriosCarregados = useBemEstarStore((s) => s.carregado);
  const nivelAnterior = useRef(nivel);
  const [nivelNovo, setNivelNovo] = useState<number | null>(null);

  /* Deps com os campos LIDOS: o valor real chega do servidor depois do
     login, e o efeito precisa rodar de novo para fazer a conta certa
     (bug já corrigido no web, onde a ofensiva nunca avançava). */
  useEffect(() => {
    if (!ativo) return;
    const hoje = getToday();
    if (ultimoAcesso === hoje) return;
    useAppStore.getState().updateGamification({ lastAccessDate: hoje, streak: proximoStreak(ultimoAcesso, ofensiva) });
  }, [ativo, ultimoAcesso, ofensiva]);

  useEffect(() => {
    if (!ativo) return;
    if (nivel > nivelAnterior.current) setNivelNovo(nivel);
    nivelAnterior.current = nivel;
  }, [ativo, nivel]);

  useEffect(() => {
    if (!ativo || !relatoriosCarregados) return;
    const { relatorios } = useBemEstarStore.getState();
    if (deveGerarRelatorio(relatorios[0]?.semanaInicio ?? null)) {
      useAppStore.getState().setShowWeeklyReport(true);
    }
  }, [ativo, relatoriosCarregados]);

  return { nivelNovo, fecharNivel: () => setNivelNovo(null) };
}
