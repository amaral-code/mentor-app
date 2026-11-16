import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@mentor/state/appStore';
import { Texto } from './Texto';
import { cor } from './tema';

/**
 * Primeiro dos dois toques até o apoio em crise. Fica no cabeçalho de
 * toda tela e abre o overlay; o segundo toque, lá dentro, é "Ligar 188".
 *
 * Texto visível ("Apoio") além do ícone: um coração sozinho pode ser lido
 * como "curtir", e quem está mal não vai adivinhar.
 */
export function BotaoApoio() {
  const abrir = useAppStore((s) => s.setShowCrisisOverlay);
  return (
    <Pressable
      onPress={() => abrir(true)}
      accessibilityRole="button"
      accessibilityLabel="Preciso de apoio agora"
      accessibilityHint="Abre respiração guiada e o contato do CVV, 188"
      hitSlop={8}
      style={({ pressed }) => [estilos.botao, pressed ? { opacity: 0.8 } : null]}
    >
      <View style={estilos.conteudo}>
        <Ionicons name="heart" size={16} color={cor.vermelho600} />
        <Texto style={estilos.texto}>Apoio</Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: cor.branco,
    justifyContent: 'center',
  },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texto: { fontSize: 13, fontWeight: '900', color: cor.vermelho600 },
});
