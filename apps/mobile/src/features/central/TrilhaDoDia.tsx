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
import { IconeApp } from '../../ui/IconeApp';
import { Texto } from '../../ui/Texto';
import { cor, LABIO, raio } from '../../ui/tema';

/* Mesmo zigue-zague do web (o "caminho" do Duolingo). */
const ZIGUEZAGUE = [0, 48, 72, 48, 0, -48, -72, -48];

/**
 * Comprovação: tocar na bolinha NÃO conclui. Pede uma foto ou um
 * parágrafo de 30 letras contando o que aprendeu; sem prova, sem XP (o
 * "cliquei, ganhei" do web foi fechado e continua fechado aqui).
 */
function Comprovacao({ tarefa, aoFechar }: { tarefa: MicroTask; aoFechar: () => void }) {
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

/**
 * Trilha do dia: as tarefas do Plano do Dia como bolinhas em zigue-zague.
 * Tarefa concluída fica travada: o ciclo marcar/desmarcar dava XP infinito.
 */
export function TrilhaDoDia({ tarefas }: { tarefas: MicroTask[] }) {
  const [alvo, setAlvo] = useState<MicroTask | null>(null);
  const atual = tarefas.find((t) => !t.completed) ?? null;

  return (
    <View style={estilos.trilha} accessibilityRole="list">
      {tarefas.map((t, i) => {
        const ehAtual = t.id === atual?.id;
        const fundo = t.completed ? cor.ambar500 : ehAtual ? cor.azul600 : cor.azul100;
        const labio = t.completed ? cor.ambar600 : ehAtual ? cor.azul700 : cor.cinza300;
        const corIcone = t.completed ? cor.branco : ehAtual ? cor.ambar100 : cor.azul600;
        return (
          <View key={t.id} style={[estilos.item, { transform: [{ translateX: ZIGUEZAGUE[i % ZIGUEZAGUE.length] }] }]}>
            {ehAtual ? (
              <View style={estilos.comecar}>
                <Texto variante="rotulo" cor={cor.azul600}>
                  Começar
                </Texto>
              </View>
            ) : null}
            <Pressable
              onPress={() => !t.completed && setAlvo(t)}
              disabled={t.completed}
              accessibilityRole="button"
              accessibilityLabel={t.completed ? `Concluída: ${t.titulo}` : `Comprovar e concluir: ${t.titulo}`}
              accessibilityHint={t.completed ? undefined : t.descricao}
              accessibilityState={{ disabled: t.completed }}
              style={({ pressed }) => [
                estilos.bolinha,
                { backgroundColor: fundo, borderBottomColor: labio },
                ehAtual ? estilos.anel : null,
                pressed ? { transform: [{ translateY: LABIO }], borderBottomWidth: 0 } : null,
              ]}
            >
              {t.completed ? <Ionicons name="checkmark" size={34} color={cor.branco} /> : <IconeApp nome={t.icon} tamanho={30} cor={corIcone} />}
            </Pressable>
            <Texto
              variante="legenda"
              centro
              style={[estilos.titulo, t.completed ? estilos.feito : null]}
              cor={t.completed ? cor.cinza400 : cor.tinta900}
            >
              {t.titulo}
            </Texto>
          </View>
        );
      })}
      {alvo ? <Comprovacao tarefa={alvo} aoFechar={() => setAlvo(null)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  trilha: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  item: { alignItems: 'center', width: 170 },
  comecar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: cor.cinza200,
    backgroundColor: cor.branco,
    marginBottom: 6,
  },
  bolinha: {
    width: 76,
    height: 70,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: LABIO,
  },
  anel: { borderWidth: 5, borderColor: cor.ceu100, borderBottomWidth: LABIO + 5 },
  titulo: { marginTop: 6, fontWeight: '800' },
  feito: { textDecorationLine: 'line-through' },
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
