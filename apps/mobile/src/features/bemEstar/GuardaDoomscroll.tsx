import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { aiAvailable, gerarIntervencaoDoomscroll } from '@mentor/core/aiService';
import { criarDetectorDeToque, sugestaoLocal } from '@mentor/core/ociosidade';
import { MOOD_LABEL } from '@mentor/core/utils';
import { useAppStore } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { anunciar, useMovimentoReduzido } from '../../ui/acessibilidade';
import { Botao } from '../../ui/Botao';
import { imagemSagui } from '../../ui/sagui';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';

/**
 * Intervenção de doomscroll no celular.
 *
 * O web olha rolagem da janela e clique em botão; aqui o sinal é o dedo:
 * arrastar é navegar, tocar parado é decidir, trocar de tela é decidir.
 * Dois minutos arrastando sem decidir nada, e a tela escurece devagar
 * (400 ms) com uma única tarefa pequena. "Agora não" fecha e não pergunta
 * de novo por 15 minutos. Tocar fora também fecha: é convite, não pedágio.
 *
 * Os toques são só observados (captura que devolve false): nenhum gesto
 * do app deixa de funcionar por causa do guarda.
 */
export function GuardaDoomscroll({ children }: { children: ReactNode }) {
  const detector = useRef(criarDetectorDeToque()).current;
  const caminho = usePathname();
  const intervencao = useBemEstarStore((s) => s.intervencao);
  const reduzido = useMovimentoReduzido();
  const opacidade = useRef(new Animated.Value(0)).current;

  // Trocar de tela é decidir.
  useEffect(() => {
    detector.decidiu();
  }, [caminho, detector]);

  useEffect(() => {
    const t = setInterval(() => {
      const avaliacao = detector.avaliar();
      if (!avaliacao) return;
      const app = useAppStore.getState();
      const materia = app.quizResults.at(-1)?.materia || 'Biologia';
      const local = sugestaoLocal(materia);
      // Texto local na hora; o da IA troca quando chegar (esperar rede em
      // cima de quem está travado seria somar espera à espera).
      void useBemEstarStore.getState().mostrarIntervencao({ ...local, materia, segundosVagando: avaliacao.segundosVagando });
      if (!aiAvailable(app.apiKey)) return;
      void gerarIntervencaoDoomscroll(
        { materiaSugerida: materia, segundosVagando: avaliacao.segundosVagando, horaLocal: new Date().getHours(), humor: MOOD_LABEL[app.currentMood] },
        app.apiKey,
      )
        .then((ia) => useBemEstarStore.setState((s) => (s.intervencao ? { intervencao: { ...s.intervencao, ...ia } } : s)))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [detector]);

  useEffect(() => {
    if (!intervencao) return;
    anunciar(`${intervencao.titulo} ${intervencao.convite}`);
    opacidade.setValue(reduzido ? 1 : 0);
    if (!reduzido) Animated.timing(opacidade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [intervencao, reduzido, opacidade]);

  function aceitar() {
    const materia = intervencao?.materia ?? 'Biologia';
    void useBemEstarStore.getState().responderIntervencao(true);
    detector.decidiu();
    router.push({ pathname: '/quiz', params: { materia, rapido: '3' } });
  }

  function recusar() {
    void useBemEstarStore.getState().responderIntervencao(false);
    detector.decidiu();
  }

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={(e) => {
        detector.tocou(e.nativeEvent.pageX, e.nativeEvent.pageY);
        return false;
      }}
      onMoveShouldSetResponderCapture={(e) => {
        detector.moveu(e.nativeEvent.pageX, e.nativeEvent.pageY);
        return false;
      }}
      onTouchEnd={() => detector.soltou()}
    >
      {children}
      <Modal visible={!!intervencao} transparent animationType="none" onRequestClose={recusar}>
        <Animated.View style={[estilos.fundo, { opacity: opacidade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={recusar} accessibilityLabel="Fechar convite" accessibilityRole="button" />
          <View style={estilos.cartao} accessibilityViewIsModal>
            <Image source={imagemSagui('meditando')} style={estilos.sagui} accessible={false} />
            <Texto variante="subtitulo" centro accessibilityRole="header">
              {intervencao?.titulo}
            </Texto>
            <Texto centro>{intervencao?.convite}</Texto>
            <Botao titulo={intervencao?.acao ?? 'Começar'} variante="ambar" aoTocar={aceitar} />
            <Botao titulo="Agora não" variante="fantasma" aoTocar={recusar} />
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(11,15,25,0.55)', justifyContent: 'center', padding: 24 },
  cartao: { backgroundColor: cor.branco, borderRadius: raio.xl, padding: 20, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
  sagui: { width: 96, height: 96, alignSelf: 'center', resizeMode: 'contain' },
});
