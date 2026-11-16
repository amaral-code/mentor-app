import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MicroTask } from '@mentor/core/types';
import { MIN_PARAGRAFO_COMPROVACAO, registrarComprovacao } from '@mentor/core/painelAluno';
import { safeGet, safeSet } from '@mentor/core/safeStorage';
import { useAppStore } from '@mentor/state/appStore';
import { anunciar, vibrar } from '../../ui/acessibilidade';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Basicos';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';

/**
 * Comprovação: entrar na toca NÃO conclui. Pede uma foto ou um
 * parágrafo de 30 letras contando o que aprendeu; sem prova, sem XP (o
 * "cliquei, ganhei" do web foi fechado e continua fechado aqui).
 */
export function Comprovacao({ tarefa, aoFechar }: { tarefa: MicroTask; aoFechar: () => void }) {
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const pronto = !!foto || texto.trim().length >= MIN_PARAGRAFO_COMPROVACAO;

  async function tirarFoto() {
    const ImagePicker = await import('expo-image-picker');
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    const r = permissao.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.4 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.4, mediaTypes: ['images'] });
    if (!r.canceled && r.assets[0]) setFoto(r.assets[0].uri);
  }

  function confirmar() {
    registrarComprovacao(tarefa.id, { texto: texto.trim(), temFoto: !!foto }, (k) => safeGet(k), (k, v) => void safeSet(k, v));
    useAppStore.getState().completeTask(tarefa.id);
    void vibrar('acerto');
    anunciar(`${tarefa.titulo} concluída. Mais 20 XP.`);
    aoFechar();
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={aoFechar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={estilos.fundoModal}>
        <View style={estilos.folha}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Texto variante="rotulo" cor={cor.ambar600}>
                  Comprovação
                </Texto>
                <Texto variante="subtitulo" accessibilityRole="header">
                  {tarefa.titulo}
                </Texto>
              </View>
              <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar comprovação" hitSlop={12}>
                <Ionicons name="close" size={26} color={cor.tinta500} />
              </Pressable>
            </View>
            <Texto variante="legenda">
              Tocar não basta: mostre que fez. Envie uma foto ou escreva o que aprendeu (pelo menos {MIN_PARAGRAFO_COMPROVACAO} letras).
            </Texto>
            {foto ? (
              <View>
                <Image source={{ uri: foto }} style={estilos.foto} accessibilityLabel="Foto da comprovação" />
                <Botao titulo="Trocar foto" variante="secundario" compacto aoTocar={() => setFoto(null)} />
              </View>
            ) : (
              <Botao titulo="Tirar foto" variante="secundario" icone="camera" aoTocar={() => void tirarFoto()} />
            )}
            <Campo
              rotulo="O que você aprendeu"
              value={texto}
              onChangeText={setTexto}
              multiline
              placeholder="Ex.: razão é divisão entre grandezas, usei regra de três em 3 questões"
            />
            <Texto variante="legenda" cor={texto.trim().length >= MIN_PARAGRAFO_COMPROVACAO ? cor.esmeralda600 : cor.cinza400}>
              {texto.trim().length}/{MIN_PARAGRAFO_COMPROVACAO} letras
            </Texto>
            <Botao titulo="Confirmar conclusão · +20 XP" variante="ambar" aoTocar={confirmar} desabilitado={!pronto} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundoModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,15,25,0.4)' },
  folha: {
    backgroundColor: cor.branco,
    borderTopLeftRadius: raio.xl,
    borderTopRightRadius: raio.xl,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  foto: { width: '100%', height: 180, borderRadius: raio.md, marginBottom: 8 },
});
