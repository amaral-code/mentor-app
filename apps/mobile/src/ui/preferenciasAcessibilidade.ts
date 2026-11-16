import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { create } from 'zustand';
import { coresDeSinal, type CoresSinal, type ModoDaltonismo } from '@mentor/core/acessibilidadeCores';
import { safeGet, safeSet } from '@mentor/core/safeStorage';
import { cor } from './tema';

/*
 * Preferências de acessibilidade do app: alto contraste e daltonismo.
 * Mesma chave do painel do web (`mm_acessibilidade`), com os mesmos
 * nomes de campo. Tamanho de fonte e movimento reduzido NÃO estão aqui:
 * no celular quem manda é o sistema (fonte dinâmica e "reduzir movimento"),
 * e o app já segue os dois.
 */
const CHAVE = 'mm_acessibilidade';

interface Prefs {
  altoContraste: boolean;
  daltonismo: ModoDaltonismo;
}

function ler(): Prefs {
  try {
    const p = JSON.parse(safeGet(CHAVE) ?? '{}');
    return { altoContraste: !!p.altoContraste, daltonismo: (p.daltonismo as ModoDaltonismo) || 'normal' };
  } catch {
    return { altoContraste: false, daltonismo: 'normal' };
  }
}

interface Estado extends Prefs {
  /** Alto contraste ligado no SISTEMA (preenchido uma vez, na raiz do app). */
  contrasteDoSistema: boolean;
  mudar: (p: Partial<Prefs>) => void;
}

// Começa no padrão e lê o aparelho na raiz (useSincronizarContrasteDoSistema):
// no import do módulo o armazenamento da plataforma ainda pode não existir.
export const useAcessibilidadeStore = create<Estado>((set, get) => ({
  altoContraste: false,
  daltonismo: 'normal',
  contrasteDoSistema: false,
  mudar: (p) => {
    set(p);
    let atual: Record<string, unknown> = {};
    try {
      atual = JSON.parse(safeGet(CHAVE) ?? '{}');
    } catch {
      /* chave corrompida: regrava só o que é deste app */
    }
    safeSet(CHAVE, JSON.stringify({ ...atual, altoContraste: get().altoContraste, daltonismo: get().daltonismo }));
  },
}));

/**
 * Ouve o alto contraste do SISTEMA (iOS "Escurecer cores", Android "Texto
 * de alto contraste") uma vez, na raiz. Os componentes só leem a store:
 * um ouvinte por Texto seriam centenas de ouvintes na tela.
 */
export function useSincronizarContrasteDoSistema(): void {
  useEffect(() => {
    useAcessibilidadeStore.setState(ler());
    if (Platform.OS === 'web') return;
    const definir = (v: boolean) => useAcessibilidadeStore.setState({ contrasteDoSistema: !!v });
    const consulta = Platform.OS === 'ios' ? AccessibilityInfo.isDarkerSystemColorsEnabled?.() : AccessibilityInfo.isHighTextContrastEnabled?.();
    void consulta?.then(definir);
    const sub = AccessibilityInfo.addEventListener(
      (Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged') as 'darkerSystemColorsChanged',
      definir,
    );
    return () => sub.remove();
  }, []);
}

/** Contraste alto pedido no app OU no sistema. */
export function useAltoContraste(): boolean {
  return useAcessibilidadeStore((s) => s.altoContraste || s.contrasteDoSistema);
}

/** Cores de acerto, erro e aviso conforme o daltonismo escolhido. */
export function useCoresSinal(): CoresSinal {
  return coresDeSinal(useAcessibilidadeStore((s) => s.daltonismo));
}

/** Tons do texto secundário e das bordas, mais escuros no alto contraste. */
export function useTonsDeContraste() {
  const alto = useAltoContraste();
  return {
    alto,
    textoSecundario: alto ? cor.tinta900 : cor.tinta500,
    textoCorpo: alto ? cor.tinta900 : cor.tinta700,
    borda: alto ? cor.tinta500 : cor.cinza200,
    bordaLabio: alto ? cor.tinta700 : cor.cinza300,
  };
}
