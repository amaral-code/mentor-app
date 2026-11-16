import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatLigaRepository, type MensagemAoVivo, type OrigemChat } from '@mentor/api/ChatLigaRepository';
import { moderar } from '@mentor/core/moderationEngine';
import { useAppStore } from '@mentor/state/appStore';
import { anunciar } from '../../ui/acessibilidade';
import { Botao } from '../../ui/Botao';
import { Vazio } from '../../ui/Basicos';
import { Texto } from '../../ui/Texto';
import { ALVO_TOQUE, cor, raio } from '../../ui/tema';

const MOTIVOS = [
  { id: 'ofensiva', rotulo: 'Ofensiva' },
  { id: 'bullying', rotulo: 'Bullying' },
  { id: 'spam', rotulo: 'Spam' },
  { id: 'outro', rotulo: 'Outro motivo' },
] as const;

function hora(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Chat ao vivo da liga ou da turma.
 *
 * A mensagem nova chega pelo Realtime; a do próprio aluno entra na lista
 * na hora (e o eco do Realtime é ignorado pelo id). A moderação roda
 * ANTES de enviar: texto ofensivo nem sai do aparelho, e o servidor (032)
 * barra quem pular o app. Segurar uma mensagem alheia abre a denúncia.
 */
export function ChatAoVivo({ origem, alvoId }: { origem: OrigemChat; alvoId: string | null }) {
  const [mensagens, setMensagens] = useState<MensagemAoVivo[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [denunciando, setDenunciando] = useState<MensagemAoVivo | null>(null);
  const lista = useRef<FlatList<MensagemAoVivo>>(null);

  useEffect(() => {
    let vivo = true;
    void chatLigaRepository.listar(origem, alvoId).then((m) => {
      if (!vivo) return;
      setMensagens(m);
      setCarregado(true);
    });
    const cancelar = chatLigaRepository.assinar(origem, alvoId, (nova) => {
      setMensagens((atual) => (atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]));
      if (nova.autor !== 'Você') anunciar(`Nova mensagem de ${nova.autor}.`);
    });
    return () => {
      vivo = false;
      cancelar();
    };
  }, [origem, alvoId]);

  async function enviar() {
    const m = moderar(texto);
    if (!m.aprovado) {
      // Diz o motivo e não apaga o que o aluno escreveu: ele pode reescrever.
      setAviso(`${m.razao ?? 'Mensagem bloqueada'}. Reescreva antes de enviar.`);
      return;
    }
    setAviso('');
    setEnviando(true);
    try {
      const nova = await chatLigaRepository.enviar(origem, alvoId, m.textoLimpio);
      setMensagens((atual) => (atual.some((x) => x.id === nova.id) ? atual : [...atual, nova]));
      setTexto('');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  async function denunciar(motivo: (typeof MOTIVOS)[number]['id']) {
    const alvo = denunciando;
    setDenunciando(null);
    if (!alvo) return;
    try {
      await chatLigaRepository.denunciar(origem, alvo.id, motivo);
      useAppStore.getState().setToast('Denúncia enviada. Com três denúncias a mensagem sai do chat.', 'success');
    } catch {
      useAppStore.getState().setToast('Não foi possível denunciar agora.', 'error');
    }
  }

  const visiveis = mensagens.filter((m) => !m.oculta || m.autor === 'Você');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 8 }}>
      <View style={estilos.caixa}>
        {carregado && visiveis.length === 0 ? (
          <Vazio titulo="Ninguém falou ainda." texto="Puxe o assunto: qual questão travou hoje?" pose="acenando" />
        ) : (
          <FlatList
            ref={lista}
            data={visiveis}
            keyExtractor={(m) => m.id}
            style={{ maxHeight: 420 }}
            nestedScrollEnabled
            onContentSizeChange={() => lista.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const minha = item.autor === 'Você';
              return (
                <Pressable
                  onLongPress={minha ? undefined : () => setDenunciando(item)}
                  accessibilityLabel={`${item.autor}, ${hora(item.criadoEm)}: ${item.texto}`}
                  accessibilityActions={minha ? undefined : [{ name: 'denunciar', label: 'Denunciar mensagem' }]}
                  onAccessibilityAction={() => setDenunciando(item)}
                  style={[estilos.linha, minha ? { justifyContent: 'flex-end' } : null]}
                >
                  <View style={[estilos.bolha, minha ? estilos.minha : estilos.alheia, item.oculta ? { opacity: 0.5 } : null]}>
                    {!minha ? (
                      <Texto variante="legenda" negrito cor={cor.ceu700}>
                        {item.autor}
                      </Texto>
                    ) : null}
                    <Texto cor={minha ? cor.branco : cor.tinta900}>{item.texto}</Texto>
                    <Texto variante="legenda" cor={minha ? 'rgba(255,255,255,0.8)' : cor.tinta500}>
                      {hora(item.criadoEm)}
                      {item.oculta ? ' · escondida por denúncias' : ''}
                    </Texto>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
      {aviso ? (
        <Texto variante="legenda" cor={cor.vermelho600} accessibilityLiveRegion="assertive">
          {aviso}
        </Texto>
      ) : null}
      <View style={estilos.entrada}>
        <TextInput
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            if (aviso) setAviso('');
          }}
          placeholder="Mensagem para o grupo"
          placeholderTextColor={cor.cinza400}
          accessibilityLabel="Mensagem para o grupo"
          maxLength={500}
          multiline
          style={estilos.campo}
        />
        <Pressable
          onPress={() => void enviar()}
          disabled={!texto.trim() || enviando}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          style={[estilos.enviar, { opacity: texto.trim() && !enviando ? 1 : 0.4 }]}
        >
          <Ionicons name="send" size={20} color={cor.branco} />
        </Pressable>
      </View>
      <Texto variante="legenda">Segure uma mensagem para denunciar. Seu nome aparece só para você: os colegas veem um apelido.</Texto>

      <Modal visible={!!denunciando} transparent animationType="fade" onRequestClose={() => setDenunciando(null)}>
        <View style={estilos.fundoModal}>
          <View style={estilos.modal}>
            <Texto variante="subtitulo" accessibilityRole="header">
              Denunciar mensagem
            </Texto>
            <Texto variante="legenda" numberOfLines={3}>
              “{denunciando?.texto}”
            </Texto>
            {MOTIVOS.map((m) => (
              <Botao key={m.id} titulo={m.rotulo} variante="secundario" compacto aoTocar={() => void denunciar(m.id)} />
            ))}
            <Botao titulo="Cancelar" variante="fantasma" compacto aoTocar={() => setDenunciando(null)} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  caixa: { borderRadius: raio.lg, borderWidth: 2, borderColor: cor.cinza200, backgroundColor: cor.superficie, padding: 8, minHeight: 160 },
  linha: { flexDirection: 'row', marginVertical: 3 },
  bolha: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  minha: { backgroundColor: cor.azul600, borderBottomRightRadius: 4 },
  alheia: { backgroundColor: cor.branco, borderWidth: 2, borderColor: cor.cinza200, borderBottomLeftRadius: 4 },
  entrada: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  campo: {
    flex: 1,
    minHeight: ALVO_TOQUE,
    maxHeight: 120,
    borderWidth: 2,
    borderColor: cor.cinza200,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: cor.tinta900,
    backgroundColor: cor.branco,
  },
  enviar: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: 24, backgroundColor: cor.azul600, alignItems: 'center', justifyContent: 'center' },
  fundoModal: { flex: 1, backgroundColor: 'rgba(11,15,25,0.5)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: cor.branco, borderRadius: raio.xl, padding: 20, gap: 10, maxWidth: 420, width: '100%', alignSelf: 'center' },
});
