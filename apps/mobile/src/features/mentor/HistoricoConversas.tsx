import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../../ui/Botao';
import { Vazio } from '../../ui/Basicos';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';

function quando(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Conversas salvas do Mentor (migration 016): abrir, começar outra, apagar. */
export function HistoricoConversas({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const conversas = useAppStore((s) => s.conversas);
  const ativa = useAppStore((s) => s.conversaAtivaId);
  const [apagando, setApagando] = useState<string | null>(null);

  async function nova() {
    await useAppStore.getState().novaConversa();
    aoFechar();
  }

  async function abrir(id: string) {
    await useAppStore.getState().selecionarConversa(id);
    aoFechar();
  }

  function apagar(id: string) {
    // Dois toques: apagar leva as mensagens junto e não tem volta.
    if (apagando !== id) return setApagando(id);
    setApagando(null);
    void useAppStore.getState().apagarConversa(id);
  }

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <View style={estilos.folha}>
          <View style={estilos.topo}>
            <Texto variante="subtitulo" accessibilityRole="header" style={{ flex: 1 }}>
              Conversas
            </Texto>
            <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar conversas" hitSlop={12}>
              <Ionicons name="close" size={26} color={cor.tinta500} />
            </Pressable>
          </View>
          <Botao titulo="Nova conversa" icone="add" variante="ceu" aoTocar={() => void nova()} />
          <FlatList
            data={conversas}
            keyExtractor={(c) => c.id}
            style={{ marginTop: 12 }}
            ListEmptyComponent={<Vazio titulo="Nenhuma conversa salva ainda." texto="A primeira pergunta abre uma." />}
            renderItem={({ item }) => (
              <View style={[estilos.linha, item.id === ativa ? estilos.ativa : null]}>
                <Pressable
                  style={{ flex: 1, paddingVertical: 10 }}
                  onPress={() => void abrir(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir conversa ${item.titulo}`}
                  accessibilityState={{ selected: item.id === ativa }}
                >
                  <Texto negrito numberOfLines={1}>
                    {item.titulo || 'Conversa sem título'}
                  </Texto>
                  <Texto variante="legenda">{quando(item.criadoEm)}</Texto>
                </Pressable>
                <Pressable
                  onPress={() => apagar(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={apagando === item.id ? 'Toque de novo para apagar' : `Apagar conversa ${item.titulo}`}
                  hitSlop={8}
                  style={estilos.lixeira}
                >
                  <Ionicons name={apagando === item.id ? 'trash' : 'trash-outline'} size={20} color={apagando === item.id ? cor.vermelho600 : cor.tinta500} />
                </Pressable>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,15,25,0.4)' },
  folha: {
    backgroundColor: cor.branco,
    borderTopLeftRadius: raio.xl,
    borderTopRightRadius: raio.xl,
    padding: 20,
    height: '75%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: cor.cinza100, paddingHorizontal: 8 },
  ativa: { backgroundColor: cor.ceu50, borderRadius: 12 },
  lixeira: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
