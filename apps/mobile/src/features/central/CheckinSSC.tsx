import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@mentor/state/appStore';
import { getSSCColor, getSSCLabel } from '@mentor/core/sscCalculator';
import { MOOD_LABEL } from '@mentor/core/utils';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { ALVO_TOQUE, cor } from '../../ui/tema';

interface PassoProps {
  rotulo: string;
  valor: number;
  unidade: string;
  min: number;
  max: number;
  passo: number;
  icone: keyof typeof Ionicons.glyphMap;
  corIcone: string;
  aoMudar: (v: number) => void;
}

/**
 * Ajuste por botões, e não por controle deslizante: o React Native não
 * tem slider nativo, e os de terceiros são difíceis de usar com o dedo
 * suado e com leitor de tela. Aqui o VoiceOver anuncia "Sono, 7 horas,
 * ajustável" e aceita o gesto de subir/descer.
 */
function Passo({ rotulo, valor, unidade, min, max, passo, icone, corIcone, aoMudar }: PassoProps) {
  const mudar = (delta: number) => aoMudar(Math.max(min, Math.min(max, +(valor + delta).toFixed(1))));
  return (
    <View
      style={estilos.passo}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: `${valor} ${unidade}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => mudar(e.nativeEvent.actionName === 'increment' ? passo : -passo)}
    >
      <Ionicons name={icone} size={20} color={corIcone} />
      <Texto negrito style={{ flex: 1 }}>
        {rotulo}
      </Texto>
      <Pressable onPress={() => mudar(-passo)} style={estilos.botao} accessibilityElementsHidden importantForAccessibility="no" hitSlop={4}>
        <Ionicons name="remove" size={20} color={cor.azul600} />
      </Pressable>
      <Texto variante="subtitulo" style={estilos.valor}>
        {valor}
        {unidade === 'horas' ? 'h' : `/${max}`}
      </Texto>
      <Pressable onPress={() => mudar(passo)} style={estilos.botao} accessibilityElementsHidden importantForAccessibility="no" hitSlop={4}>
        <Ionicons name="add" size={20} color={cor.azul600} />
      </Pressable>
    </View>
  );
}

/** "Como você está": humor das conversas, prontidão (SSC), sono e cansaço. */
export function CheckinSSC() {
  const humor = useAppStore((s) => s.currentMood);
  const corHumor = useAppStore((s) => s.moodColor);
  const ssc = useAppStore((s) => s.sscScore);
  const sono = useAppStore((s) => s.sono);
  const cansaco = useAppStore((s) => s.cansaco);
  const corSsc = getSSCColor(ssc);

  function mudarSono(v: number) {
    useAppStore.getState().setSono(v);
    useAppStore.getState().recalcSSC();
  }
  function mudarCansaco(v: number) {
    useAppStore.getState().setCansaco(v);
    useAppStore.getState().recalcSSC();
  }

  return (
    <Cartao estilo={{ gap: 12 }}>
      <View style={estilos.topo}>
        <View style={[estilos.humor, { backgroundColor: `${corHumor}22` }]}>
          <Ionicons name="happy-outline" size={26} color={corHumor} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto variante="subtitulo">{MOOD_LABEL[humor] || 'Tranquilo'}</Texto>
          <Texto variante="legenda">Humor baseado nas conversas</Texto>
        </View>
        <View
          style={[estilos.ssc, { backgroundColor: `${corSsc}1F` }]}
          accessible
          accessibilityLabel={`Prontidão para estudar: ${ssc} por cento, ${getSSCLabel(ssc)}`}
        >
          <Texto variante="subtitulo" cor={corSsc}>
            {ssc}%
          </Texto>
          <Texto style={{ fontSize: 11, fontWeight: '800' }} cor={corSsc}>
            {getSSCLabel(ssc)}
          </Texto>
        </View>
      </View>
      <Passo rotulo="Sono" valor={sono} unidade="horas" min={0} max={12} passo={0.5} icone="moon" corIcone={cor.ceu500} aoMudar={mudarSono} />
      <Passo rotulo="Cansaço" valor={cansaco} unidade="de 10" min={0} max={10} passo={1} icone="sad-outline" corIcone={cor.ambar500} aoMudar={mudarCansaco} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  humor: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ssc: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignItems: 'center' },
  passo: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: ALVO_TOQUE },
  botao: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: cor.cinza200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valor: { minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
