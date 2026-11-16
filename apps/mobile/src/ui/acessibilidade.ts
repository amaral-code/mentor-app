import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * "Reduzir movimento" do sistema (iOS, Android e navegador).
 *
 * Animação que o aluno pediu para não ver não é detalhe: para quem tem
 * enjoo vestibular, um mascote pulando na tela é motivo para fechar o app.
 */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(false);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => vivo && setReduzido(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return reduzido;
}

/** Leitor de tela ligado (VoiceOver/TalkBack): troca gesto por botão. */
export function useLeitorDeTela(): boolean {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((v) => vivo && setLigado(v));
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setLigado);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return ligado;
}

/** Fala uma mudança para o leitor de tela (acerto, erro, resposta pronta). */
export function anunciar(texto: string): void {
  AccessibilityInfo.announceForAccessibility(texto);
}

/**
 * Vibração curta de acerto/erro. No web não há motor de vibração: não
 * faz nada, em vez de quebrar.
 */
export async function vibrar(tipo: 'acerto' | 'erro' | 'toque'): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    if (tipo === 'toque') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else
      await Haptics.notificationAsync(
        tipo === 'acerto' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
  } catch {
    /* Aparelho sem motor de vibração: o retorno visual já basta. */
  }
}
