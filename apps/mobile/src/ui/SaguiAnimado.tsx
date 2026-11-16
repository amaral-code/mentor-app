import { useEffect } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { imagemSagui, type PoseSagui } from './sagui';

/**
 * Sagui flutuando devagar (o `animate-float-suave` do web), no thread de
 * UI. Com "reduzir movimento" fica parado: mascote balançando o tempo
 * todo na tela é exatamente o que essa preferência pede para não ter.
 */
export function SaguiAnimado({ pose, tamanho = 140, estilo }: { pose: PoseSagui; tamanho?: number; estilo?: StyleProp<ImageStyle> }) {
  const reduzido = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduzido) {
      cancelAnimation(y);
      y.value = 0;
      return;
    }
    y.value = withRepeat(withTiming(-8, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(y);
  }, [reduzido, y]);

  const animado = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={animado}>
      <Image source={imagemSagui(pose)} style={[{ width: tamanho, height: tamanho, resizeMode: 'contain' }, estilo]} accessible={false} />
    </Animated.View>
  );
}
