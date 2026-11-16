import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { safeSet } from '@mentor/core/safeStorage';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';
import { useLayout } from '../../ui/layout';

/* Um passo por aba, na ordem da barra. O balão aponta para a aba pelo
   índice: no celular a barra é embaixo; no notebook, na lateral. */
const PASSOS = [
  { aba: 0, rota: '/', titulo: 'Central', texto: 'Seu plano do dia em árvores. Cada uma guarda uma missão de quiz que vale XP.' },
  { aba: 1, rota: '/mentor', titulo: 'Mentor', texto: 'Tire dúvida de qualquer matéria. Dá para mandar foto da questão.' },
  { aba: 2, rota: '/quiz', titulo: 'Quiz', texto: 'Questões no seu nível. Cada quiz marca sozinho quando revisar.' },
  { aba: 3, rota: '/ligas', titulo: 'Ligas', texto: 'Estude com a turma: metas, chat e ranking.' },
  { aba: 4, rota: '/mais', titulo: 'Mais', texto: 'Redação por foto, foco, áudio, caderno e o botão Apoio, sempre no topo.' },
] as const;
const TOTAL_ABAS = 5;

function concluir() {
  useAppStore.getState().setShowTutorial(false);
  safeSet('mm_tour_visto', '1');
  supabaseRepository.savePreferencias({ tutorial_completo: true }).catch(() => {});
  router.navigate('/');
}

/**
 * Tour das abas, adaptado a toque: em vez de destacar elementos pelo
 * mouse, cada passo leva à aba de verdade e aponta para ela na barra.
 * "Pular" está em todos os passos. Aparece uma vez (preferências do
 * banco, com cópia no aparelho para conta nova offline).
 */
export function TourGuiado() {
  const ativo = useAppStore((s) => s.showTutorial);
  const passo = useAppStore((s) => s.tutorialStep);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const lateral = layout.barraLateral;
  const atual = PASSOS[Math.min(passo, PASSOS.length - 1)];

  function proximo() {
    if (passo >= PASSOS.length - 1) return concluir();
    const seguinte = PASSOS[passo + 1];
    useAppStore.getState().setTutorialStep(passo + 1);
    router.navigate(seguinte.rota as never);
  }

  // Posição do balão: acima da aba (celular) ou ao lado dela (notebook).
  const larguraAba = width / TOTAL_ABAS;
  const setaX = Math.min(width - 40, Math.max(24, larguraAba * atual.aba + larguraAba / 2 - 12));
  const balao = lateral
    ? { left: layout.larguraBarra + 16, top: insets.top + 16 + atual.aba * 56 }
    : { left: 16, right: 16, bottom: insets.bottom + 76 };

  return (
    <Modal visible={ativo} transparent animationType="fade" onRequestClose={concluir}>
      <View style={estilos.fundo} pointerEvents="box-none">
        <View style={[estilos.balao, balao, lateral ? { width: Math.min(360, width - layout.larguraBarra - 32) } : null]} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <Texto variante="rotulo" cor={cor.ceu700}>
            {passo + 1} de {PASSOS.length}
          </Texto>
          <Texto variante="subtitulo" accessibilityRole="header">
            {atual.titulo}
          </Texto>
          <Texto>{atual.texto}</Texto>
          <View style={estilos.botoes}>
            <Botao titulo="Pular" variante="fantasma" compacto aoTocar={concluir} />
            <Botao titulo={passo >= PASSOS.length - 1 ? 'Começar' : 'Próximo'} variante="ceu" compacto aoTocar={proximo} />
          </View>
          {!lateral ? <View style={[estilos.seta, { left: setaX - 16 }]} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(11,15,25,0.35)' },
  balao: { position: 'absolute', backgroundColor: cor.branco, borderRadius: raio.lg, padding: 16, gap: 6, borderWidth: 2, borderColor: cor.ceu500 },
  botoes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  seta: {
    position: 'absolute',
    bottom: -10,
    width: 18,
    height: 18,
    backgroundColor: cor.branco,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: cor.ceu500,
    transform: [{ rotate: '45deg' }],
  },
});
