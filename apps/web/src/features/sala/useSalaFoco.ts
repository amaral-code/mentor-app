import { useCallback, useEffect, useRef, useState } from 'react';
import { salaFocoRepository } from '../../shared/storage/SalaFocoRepository';
import { PING_INTERVALO_MS, minutosDeFoco, type PresencaSala } from '../../shared/lib/salaFoco';

/** De quanto em quanto tempo a lista de colegas e relida (20s). */
const RECARGA_MS = 20_000;

export interface UseSalaFocoReturn {
  presencas: PresencaSala[];
  dentro: boolean;
  entrando: boolean;
  carregando: boolean;
  /** Segundos de tela VISIVEL desde a entrada (o que vira minutos_foco). */
  segundosFoco: number;
  entrar: (materia: string) => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

/**
 * SALA DE FOCO — ciclo de vida da presenca.
 *
 * Tres relogios, todos limpos no desmonte (nenhum sobrevive a troca de
 * aba, que no app e troca de tela):
 *   1. cronometro de 1s, que so avanca com a aba VISIVEL — deixar o app
 *      aberto no bolso nao vira "foco";
 *   2. heartbeat de 45s, que mantem a pessoa na sala;
 *   3. recarga de 20s da lista dos colegas.
 *
 * Sair da tela = sair da sala. O `sair()` do desmonte e best-effort; se a
 * rede engolir a chamada, a janela de 2 minutos do servidor remove a
 * presenca sozinha.
 */
export function useSalaFoco(): UseSalaFocoReturn {
  const [presencas, setPresencas] = useState<PresencaSala[]>([]);
  const [dentro, setDentro] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [segundosFoco, setSegundosFoco] = useState(0);

  const segundosRef = useRef(0);
  const dentroRef = useRef(false);
  dentroRef.current = dentro;
  /* Guarda contra setState depois do desmonte: as respostas de rede
     chegam bem depois de o aluno trocar de aba. */
  const vivoRef = useRef(true);

  const recarregar = useCallback(async () => {
    const lista = await salaFocoRepository.listar();
    if (!vivoRef.current) return;
    setPresencas(lista);
    setCarregando(false);
  }, []);

  const entrar = useCallback(async (materia: string) => {
    setEntrando(true);
    try {
      await salaFocoRepository.entrar(materia);
      if (!vivoRef.current) return;
      segundosRef.current = 0;
      setSegundosFoco(0);
      setDentro(true);
      await recarregar();
    } finally {
      if (vivoRef.current) setEntrando(false);
    }
  }, [recarregar]);

  const sair = useCallback(async () => {
    setDentro(false);
    segundosRef.current = 0;
    if (vivoRef.current) setSegundosFoco(0);
    await salaFocoRepository.sair();
    await recarregar();
  }, [recarregar]);

  // Primeira carga + recarga periodica da lista.
  useEffect(() => {
    vivoRef.current = true;
    void recarregar();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void recarregar();
    }, RECARGA_MS);
    return () => {
      window.clearInterval(id);
      vivoRef.current = false;
    };
  }, [recarregar]);

  // Cronometro de foco: 1s por vez, so com a aba visivel.
  useEffect(() => {
    if (!dentro) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      segundosRef.current += 1;
      setSegundosFoco(segundosRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [dentro]);

  // Heartbeat: mantem a presenca viva enquanto a pessoa esta na sala.
  useEffect(() => {
    if (!dentro) return;
    const id = window.setInterval(() => {
      void salaFocoRepository.pingar(minutosDeFoco(segundosRef.current));
    }, PING_INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [dentro]);

  /* Trocar de aba do app desmonta a tela — e quem some da tela some da
     sala. Chama o repositorio direto (e nao `sair`, que faria setState
     em componente desmontado) e le o ref, para o efeito rodar uma vez
     so, no desmonte de verdade. */
  useEffect(() => {
    return () => {
      if (dentroRef.current) void salaFocoRepository.sair();
    };
  }, []);

  return { presencas, dentro, entrando, carregando, segundosFoco, entrar, sair, recarregar };
}
