import { useEffect, useMemo } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { formatarXp } from '@mentor/core/marcosXp';
import { anunciar, vibrar } from '../../ui/acessibilidade';
import { Botao } from '../../ui/Botao';
import { imagemSagui } from '../../ui/sagui';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';

const CORES = [cor.ambar500, cor.violeta600, cor.esmeralda500, cor.ceu500, '#F472B6'];

/** Um pedaço de confete: anima no thread de UI (Reanimated), sem passar pelo JS a cada quadro. */
function Confete({ i }: { i: number }) {
  const progresso = useSharedValue(0);
  const alvo = useMemo(() => {
    const angulo = (i / 18) * Math.PI * 2 + (i % 3) * 0.3;
    const distancia = 90 + (i % 5) * 22;
    return { x: Math.cos(angulo) * distancia, y: Math.sin(angulo) * distancia - 40, giro: (i % 2 ? 1 : -1) * (180 + i * 20) };
  }, [i]);
  useEffect(() => {
    progresso.value = withDelay((i % 6) * 40, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [i, progresso]);
  const estilo = useAnimatedStyle(() => ({
    opacity: 1 - progresso.value * 0.9,
    transform: [
      { translateX: alvo.x * progresso.value },
      { translateY: alvo.y * progresso.value + 60 * progresso.value * progresso.value },
      { rotate: `${alvo.giro * progresso.value}deg` },
    ],
  }));
  return <Animated.View style={[estilos.confete, { backgroundColor: CORES[i % CORES.length] }, estilo]} />;
}

interface Props {
  /** Nível alcançado (overlay de nível) ou null. */
  nivel: number | null;
  /** Marco de XP cruzado (1.000, 2.000...) ou null. */
  marco?: number | null;
  aoFechar: () => void;
}

/**
 * Comemoração de nível novo e de marco de XP.
 *
 * Reanimated anima no thread de UI, então o sagui e o confete ficam a 60
 * quadros mesmo com o JavaScript ocupado (a gravação do XP acontece no
 * mesmo instante). Com "reduzir movimento" ligado não há confete nem
 * mola: a tela só aparece, com o mesmo texto e a mesma vibração.
 */
export function OverlayNivel({ nivel, marco = null, aoFechar }: Props) {
  const aberto = nivel !== null || marco !== null;
  const reduzido = useReducedMotion();
  const escala = useSharedValue(reduzido ? 1 : 0.4);

  const titulo = nivel !== null ? `Nível ${nivel}!` : `${formatarXp(marco ?? 0)} XP!`;
  const texto = nivel !== null ? 'Você subiu de nível. O sagui está orgulhoso.' : 'Mais um marco no caminho até a prova.';

  useEffect(() => {
    if (!aberto) return;
    void vibrar('acerto');
    anunciar(`${titulo} ${texto}`);
    escala.value = reduzido ? 1 : 0.4;
    if (!reduzido) escala.value = withSpring(1, { damping: 9, stiffness: 140 });
  }, [aberto, reduzido, escala, titulo, texto]);

  const estiloSagui = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <View style={estilos.cartao} accessibilityViewIsModal>
          <View style={estilos.palco}>
            {!reduzido && aberto ? Array.from({ length: 18 }, (_, i) => <Confete key={i} i={i} />) : null}
            <Animated.View style={estiloSagui}>
              <Image source={imagemSagui('pulando')} style={estilos.sagui} accessible={false} />
            </Animated.View>
          </View>
          <Texto variante="titulo" centro cor={cor.ambar700} accessibilityRole="header">
            {titulo}
          </Texto>
          <Texto centro>{texto}</Texto>
          <Botao titulo="Continuar" variante="ambar" aoTocar={aoFechar} />
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(11,15,25,0.55)', justifyContent: 'center', padding: 24 },
  cartao: { backgroundColor: cor.branco, borderRadius: raio.xl, padding: 24, gap: 12, maxWidth: 400, width: '100%', alignSelf: 'center' },
  palco: { height: 170, alignItems: 'center', justifyContent: 'center' },
  sagui: { width: 150, height: 150, resizeMode: 'contain' },
  confete: { position: 'absolute', width: 10, height: 14, borderRadius: 3 },
});
