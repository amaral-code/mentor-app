import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '@mentor/state/appStore';
import { carregarFlashcards, gerarFlashcards, guardarFlashcards, novoBaralho, paraRevisar, responderCartao, type Baralho, type Flashcard } from '@mentor/core/flashcards';
import { anunciar, useMovimentoReduzido, vibrar } from '../../src/ui/acessibilidade';
import { Vazio } from '../../src/ui/Basicos';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor, LABIO, raio } from '../../src/ui/tema';

/** Distância do arrasto que decide o cartão (abaixo disso, ele volta). */
const LIMIAR = 110;

/**
 * Flashcards do caderno, em baralho: arrastar para a direita é "sabia"
 * (sai do baralho), para a esquerda é "revisar" (volta para o fim, até
 * duas vezes). Tocar vira o cartão.
 *
 * Os botões fazem o mesmo que o gesto e ficam sempre visíveis: quem usa
 * leitor de tela não arrasta cartão, e quem está no notebook usa mouse.
 */
export default function Flashcards() {
  const notas = useAppStore((s) => s.notas);
  const reduzido = useMovimentoReduzido();
  const [cartoes, setCartoes] = useState<Flashcard[]>(() => carregarFlashcards());
  const [baralho, setBaralho] = useState<Baralho>(() => novoBaralho(carregarFlashcards().map((c) => c.id)));
  const [virado, setVirado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const arrasto = useRef(new Animated.ValueXY()).current;

  const porId = useMemo(() => new Map(cartoes.map((c) => [c.id, c])), [cartoes]);
  const idAtual = baralho.fila[0];
  const atual = idAtual ? porId.get(idAtual) : undefined;

  useEffect(() => {
    arrasto.setValue({ x: 0, y: 0 });
    setVirado(false);
  }, [idAtual, arrasto]);

  function decidir(sabia: boolean) {
    void vibrar(sabia ? 'acerto' : 'toque');
    anunciar(sabia ? 'Sabia. Próximo cartão.' : 'Vai voltar no fim do baralho.');
    const fim = () => setBaralho((b) => responderCartao(b, sabia));
    if (reduzido) return fim();
    Animated.timing(arrasto, { toValue: { x: sabia ? 500 : -500, y: 0 }, duration: 180, useNativeDriver: true }).start(fim);
  }

  const gesto = useMemo(
    () =>
      PanResponder.create({
        // Só vira gesto com arrasto de verdade: um toque continua sendo "virar".
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: arrasto.x }], { useNativeDriver: false }),
        onPanResponderRelease: (_e, g) => {
          if (g.dx > LIMIAR) decidir(true);
          else if (g.dx < -LIMIAR) decidir(false);
          else Animated.spring(arrasto, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arrasto, reduzido],
  );

  async function gerar() {
    setGerando(true);
    try {
      const { cartoes: novos, viaIA } = await gerarFlashcards(notas, useAppStore.getState().apiKey);
      if (novos.length === 0) {
        useAppStore.getState().setToast('Escreva algumas anotações no caderno para gerar cartões.', 'info');
        return;
      }
      const todos = guardarFlashcards(novos);
      setCartoes(todos);
      setBaralho(novoBaralho(novos.map((c) => c.id)));
      useAppStore.getState().setToast(viaIA ? `${novos.length} cartões gerados pela IA.` : `${novos.length} cartões de lacuna (sem IA agora).`, 'success');
    } finally {
      setGerando(false);
    }
  }

  const rotacao = arrasto.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const restantes = baralho.fila.length;
  const revisar = paraRevisar(baralho).filter((id) => !baralho.sabia.includes(id));

  return (
    <Tela cabecalho={{ titulo: 'Flashcards', subtitulo: 'Arraste para a direita se sabia, para a esquerda para revisar', cor: 'esmeralda', pose: 'estudando_caderno', voltar: true }}>
      {cartoes.length === 0 ? (
        <Vazio
          titulo="Nenhum cartão ainda."
          texto="Os cartões nascem das suas anotações do caderno."
          acao={<Botao titulo="Gerar do caderno" variante="sucesso" carregando={gerando} aoTocar={() => void gerar()} />}
        />
      ) : atual ? (
        <>
          <Texto variante="legenda" centro>
            {restantes} {restantes === 1 ? 'cartão' : 'cartões'} no baralho · {baralho.sabia.length} já sabia
          </Texto>
          <Animated.View
            {...gesto.panHandlers}
            style={{ transform: [{ translateX: arrasto.x }, { rotate: reduzido ? '0deg' : rotacao }] }}
          >
            <Pressable
              onPress={() => setVirado((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={virado ? `Resposta: ${atual.resposta}` : `Pergunta: ${atual.pergunta}`}
              accessibilityHint="Toque para virar o cartão"
              style={[estilos.cartao, virado ? estilos.cartaoVirado : null]}
            >
              <Texto variante="rotulo" cor={virado ? cor.esmeralda700 : cor.ceu700}>
                {virado ? 'Resposta' : 'Pergunta'}
              </Texto>
              <Texto variante="subtitulo" centro>
                {virado ? atual.resposta : atual.pergunta}
              </Texto>
              <Texto variante="legenda">{virado ? 'Toque para ver a pergunta' : 'Toque para ver a resposta'}</Texto>
            </Pressable>
          </Animated.View>
          <View style={estilos.botoes}>
            <Botao titulo="Revisar" icone="arrow-undo" variante="perigo" estilo={{ flex: 1 }} aoTocar={() => decidir(false)} rotuloAcessivel="Revisar de novo depois" />
            <Botao titulo="Sabia" icone="checkmark" variante="sucesso" estilo={{ flex: 1 }} aoTocar={() => decidir(true)} />
          </View>
        </>
      ) : (
        <Cartao estilo={{ gap: 10, alignItems: 'center' }}>
          <Texto variante="subtitulo" centro accessibilityLiveRegion="polite">
            Baralho concluído!
          </Texto>
          <Texto centro>
            Você sabia {baralho.sabia.length} de {new Set([...baralho.sabia, ...revisar]).size}.
            {revisar.length > 0 ? ` ${revisar.length} ${revisar.length === 1 ? 'ficou' : 'ficaram'} para revisar amanhã.` : ''}
          </Texto>
          <Botao titulo="Recomeçar" variante="secundario" aoTocar={() => setBaralho(novoBaralho(cartoes.map((c) => c.id)))} />
          <Botao titulo="Gerar mais do caderno" variante="sucesso" carregando={gerando} aoTocar={() => void gerar()} />
          <Botao titulo="Fazer um quiz" variante="fantasma" aoTocar={() => router.push('/quiz')} />
        </Cartao>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    minHeight: 280,
    borderRadius: raio.xl,
    borderWidth: 2,
    borderColor: cor.ceu500,
    borderBottomWidth: 2 + LABIO,
    borderBottomColor: cor.ceu600,
    backgroundColor: cor.ceu50,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  cartaoVirado: { borderColor: cor.esmeralda500, borderBottomColor: cor.esmeralda600, backgroundColor: cor.esmeralda50 },
  botoes: { flexDirection: 'row', gap: 12 },
});
