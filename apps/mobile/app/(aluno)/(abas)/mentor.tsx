import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@mentor/state/appStore';
import { buildContextGreeting, ultimaMateria } from '@mentor/core/contextMemory';
import { safeGet, safeSet } from '@mentor/core/safeStorage';
import { transcreverManuscrito } from '@mentor/api/ocrService';
import type { ChatMessage } from '@mentor/core/types';
import { HistoricoConversas } from '../../../src/features/mentor/HistoricoConversas';
import { TextoRico } from '../../../src/features/mentor/TextoRico';
import { useConversaMentor, type ModoResposta } from '../../../src/features/mentor/useConversaMentor';
import { escolherFoto } from '../../../src/lib/foto';
import { BotaoApoio } from '../../../src/ui/BotaoApoio';
import { Botao } from '../../../src/ui/Botao';
import { Texto } from '../../../src/ui/Texto';
import { ALVO_TOQUE, cor, raio } from '../../../src/ui/tema';

/* As mesmas abas do web: cada uma fixa o modo do servidor e o professor. */
const ABAS = [
  { id: 'geral', rotulo: 'Geral', modo: 'enem_geral', persona: 'mentor_enem' },
  { id: 'exatas', rotulo: 'Exatas', modo: 'exatas', persona: 'prof_matematica' },
  { id: 'linguagens', rotulo: 'Linguagens', modo: 'humanas', persona: 'prof_portugues' },
  { id: 'natureza', rotulo: 'Natureza', modo: 'natureza', persona: 'prof_ciencias' },
] as const;

const CHAVE_ABA = 'mm_aba_mentor';
const CHAVE_MODO_RESPOSTA = 'mm_modo_resposta';

function Bolha({ msg }: { msg: ChatMessage }) {
  const doAluno = msg.role === 'user';
  const fontes = (msg.fontes ?? []).filter((f) => f.uri.startsWith('https://'));
  return (
    <View style={[estilos.linhaBolha, doAluno ? { justifyContent: 'flex-end' } : null]}>
      <View
        style={[estilos.bolha, doAluno ? estilos.bolhaAluno : estilos.bolhaMentor]}
        accessible
        accessibilityLabel={`${doAluno ? 'Você' : 'Mentor'}: ${msg.text}`}
      >
        {doAluno ? <Texto cor={cor.branco}>{msg.text}</Texto> : <TextoRico texto={msg.text} />}
        {msg.citouProva ? (
          <Texto variante="legenda" cor={cor.esmeralda600} style={{ marginTop: 6 }}>
            Cita questão de prova oficial
          </Texto>
        ) : null}
        {fontes.length > 0 ? (
          <View style={estilos.fontes}>
            {fontes.slice(0, 3).map((f) => (
              <Pressable key={f.uri} onPress={() => void Linking.openURL(f.uri)} accessibilityRole="link" style={estilos.fonte}>
                <Texto variante="legenda" cor={cor.ceu700} numberOfLines={1}>
                  {f.dominio || f.titulo}
                </Texto>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Mentor IA: chat com os modos temáticos, resposta em streaming,
 * histórico de conversas e foto da questão.
 */
export default function Mentor() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mensagens = useAppStore((s) => s.chatMessages);
  const quizzes = useAppStore((s) => s.quizResults);
  const logs = useAppStore((s) => s.logs);
  const personas = useAppStore((s) => s.personas);
  const [abaId, setAbaId] = useState<string>(() => safeGet(CHAVE_ABA) ?? 'geral');
  const [modoResposta, setModoResposta] = useState<ModoResposta>(() => (safeGet(CHAVE_MODO_RESPOSTA) === 'comunicativo' ? 'comunicativo' : 'explicativo'));
  const [texto, setTexto] = useState('');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [lendoFoto, setLendoFoto] = useState(false);
  const lista = useRef<FlatList<ChatMessage>>(null);

  const aba = ABAS.find((a) => a.id === abaId) ?? ABAS[0];
  const persona = personas.find((p) => p.id === aba.persona) ?? null;
  const materia = useMemo(() => ultimaMateria({ quizResults: quizzes, logs, persona }), [quizzes, logs, persona]);
  const { enviar, cancelar, parcial, gerando, pedirPausa, fecharPausa } = useConversaMentor({
    modo: aba.modo,
    personaId: aba.persona,
    modoResposta,
    materiaRecente: materia,
  });

  /* Conversa vazia ganha a saudação com a matéria que o aluno estava
     estudando (como no web): "Vi que você estava em Química". */
  const saudou = useRef(false);
  useEffect(() => {
    if (mensagens.length > 0 || saudou.current) return;
    saudou.current = true;
    useAppStore.getState().addChatMessage({ id: `saudacao_${Date.now()}`, role: 'assistant', text: buildContextGreeting(materia), timestamp: Date.now() });
  }, [mensagens.length, materia]);

  const itens = useMemo<ChatMessage[]>(
    () => (parcial !== null ? [...mensagens, { id: 'parcial', role: 'assistant', text: parcial, timestamp: Date.now() }] : mensagens),
    [mensagens, parcial],
  );

  const rolarParaFim = useCallback(() => lista.current?.scrollToEnd({ animated: false }), []);

  function trocarAba(id: string) {
    setAbaId(id);
    safeSet(CHAVE_ABA, id);
  }

  function trocarModoResposta() {
    const novo: ModoResposta = modoResposta === 'explicativo' ? 'comunicativo' : 'explicativo';
    setModoResposta(novo);
    safeSet(CHAVE_MODO_RESPOSTA, novo);
  }

  function mandar() {
    const t = texto;
    setTexto('');
    void enviar(t);
  }

  async function fotoDaQuestao() {
    const foto = await escolherFoto('camera').catch(() => null);
    if (!foto) return;
    setLendoFoto(true);
    try {
      const r = await transcreverManuscrito(foto.base64);
      if (!r.textoParaChat.trim()) {
        useAppStore.getState().setToast('Não deu para ler a foto. Tente com mais luz e a folha reta.', 'error');
        return;
      }
      // Vai para a caixa, não direto para a IA: o aluno confere o que foi lido.
      setTexto(r.textoParaChat);
      useAppStore.getState().setToast('Confira o texto lido da foto e envie.', 'info');
    } catch (e) {
      useAppStore.getState().setToast(e instanceof Error ? e.message : 'Falha ao ler a foto.', 'error');
    } finally {
      setLendoFoto(false);
    }
  }

  const largura = Math.min(width, 900);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cor.branco }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[estilos.topo, { paddingTop: insets.top + 8 }]}>
        <View style={[estilos.coluna, { width: largura }]}>
          <View style={estilos.linhaTopo}>
            <Texto variante="titulo" accessibilityRole="header" style={{ flex: 1 }}>
              Mentor
            </Texto>
            <Pressable onPress={() => setHistoricoAberto(true)} accessibilityRole="button" accessibilityLabel="Conversas salvas" style={estilos.iconeTopo}>
              <Ionicons name="time-outline" size={22} color={cor.azul600} />
            </Pressable>
            <BotaoApoio />
          </View>
          <View style={estilos.abas} accessibilityRole="tablist">
            {ABAS.map((a) => {
              const ativa = a.id === aba.id;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => trocarAba(a.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  style={[estilos.aba, ativa ? estilos.abaAtiva : null]}
                >
                  <Texto negrito cor={ativa ? cor.branco : cor.tinta700} style={{ fontSize: 13 }}>
                    {a.rotulo}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <FlatList
        ref={lista}
        data={itens}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bolha msg={item} />}
        contentContainerStyle={[estilos.conversa, { width: largura }]}
        style={{ flex: 1 }}
        onContentSizeChange={rolarParaFim}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        ListFooterComponent={
          gerando && !parcial ? (
            <View style={estilos.digitando} accessibilityLiveRegion="polite">
              <ActivityIndicator color={cor.azul600} />
              <Texto variante="legenda">Sagui está pensando…</Texto>
            </View>
          ) : undefined
        }
      />

      {pedirPausa ? (
        <View style={[estilos.pausa, { width: largura - 32 }]}>
          <Texto negrito style={{ flex: 1 }}>
            Travou? Um minuto de respiração ajuda a destravar.
          </Texto>
          <Botao titulo="Respirar" compacto variante="sucesso" aoTocar={() => { fecharPausa(); useAppStore.getState().setShowCrisisOverlay(true); }} />
          <Pressable onPress={fecharPausa} accessibilityRole="button" accessibilityLabel="Agora não" hitSlop={10}>
            <Ionicons name="close" size={22} color={cor.tinta500} />
          </Pressable>
        </View>
      ) : null}

      <View style={[estilos.barraEntrada, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={[estilos.coluna, { width: largura, gap: 8 }]}>
          <Pressable onPress={trocarModoResposta} accessibilityRole="switch" accessibilityState={{ checked: modoResposta === 'comunicativo' }} accessibilityLabel={`Modo de resposta: ${modoResposta === 'explicativo' ? 'didático, passo a passo' : 'macete, direto ao ponto'}`} style={estilos.modoResposta}>
            <Ionicons name={modoResposta === 'explicativo' ? 'school-outline' : 'flash-outline'} size={16} color={cor.azul600} />
            <Texto variante="legenda" cor={cor.azul600}>
              {modoResposta === 'explicativo' ? 'Didático: passo a passo' : 'Macete: direto ao ponto'}
            </Texto>
          </Pressable>
          <View style={estilos.linhaEntrada}>
            <Pressable
              onPress={() => void fotoDaQuestao()}
              disabled={lendoFoto}
              accessibilityRole="button"
              accessibilityLabel="Fotografar a questão"
              style={estilos.iconeEntrada}
            >
              {lendoFoto ? <ActivityIndicator color={cor.azul600} /> : <Ionicons name="camera-outline" size={24} color={cor.azul600} />}
            </Pressable>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Pergunte ao Mentor"
              placeholderTextColor={cor.cinza400}
              multiline
              accessibilityLabel="Sua pergunta"
              style={estilos.entrada}
              maxLength={4000}
              onKeyPress={(e) => {
                // Notebook: Ctrl ou Cmd + Enter envia (Enter sozinho quebra linha).
                const n = e.nativeEvent as { key: string; ctrlKey?: boolean; metaKey?: boolean };
                if (Platform.OS === 'web' && n.key === 'Enter' && (n.ctrlKey || n.metaKey)) mandar();
              }}
            />
            {gerando ? (
              <Pressable onPress={cancelar} accessibilityRole="button" accessibilityLabel="Parar resposta" style={[estilos.enviar, { backgroundColor: cor.vermelho500 }]}>
                <Ionicons name="stop" size={20} color={cor.branco} />
              </Pressable>
            ) : (
              <Pressable
                onPress={mandar}
                disabled={!texto.trim()}
                accessibilityRole="button"
                accessibilityLabel="Enviar pergunta"
                accessibilityState={{ disabled: !texto.trim() }}
                style={[estilos.enviar, { opacity: texto.trim() ? 1 : 0.4 }]}
              >
                <Ionicons name="arrow-up" size={22} color={cor.branco} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <HistoricoConversas aberto={historicoAberto} aoFechar={() => setHistoricoAberto(false)} />
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  topo: { borderBottomWidth: 2, borderBottomColor: cor.cinza100, paddingBottom: 10, alignItems: 'center' },
  coluna: { alignSelf: 'center', paddingHorizontal: 16 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconeTopo: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  abas: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  aba: { minHeight: 40, paddingHorizontal: 14, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, justifyContent: 'center' },
  abaAtiva: { backgroundColor: cor.ceu600, borderColor: cor.ceu600 },
  conversa: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  linhaBolha: { flexDirection: 'row' },
  bolha: { maxWidth: '88%', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bolhaAluno: { backgroundColor: cor.azul600, borderBottomRightRadius: 6 },
  bolhaMentor: { backgroundColor: cor.branco, borderWidth: 2, borderColor: cor.cinza200, borderBottomLeftRadius: 6 },
  fontes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  fonte: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: raio.pilula, backgroundColor: cor.ceu50, maxWidth: 200 },
  digitando: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  pausa: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 8,
    borderRadius: raio.md,
    backgroundColor: cor.esmeralda50,
    borderWidth: 2,
    borderColor: cor.esmeralda500,
  },
  barraEntrada: { borderTopWidth: 2, borderTopColor: cor.cinza100, paddingTop: 8, backgroundColor: cor.branco },
  modoResposta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  linhaEntrada: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconeEntrada: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: cor.azul50 },
  entrada: {
    flex: 1,
    minHeight: ALVO_TOQUE,
    maxHeight: 140,
    borderWidth: 2,
    borderColor: cor.cinza200,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: cor.tinta900,
    backgroundColor: cor.superficie,
  },
  enviar: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: 24, backgroundColor: cor.azul600, alignItems: 'center', justifyContent: 'center' },
});
