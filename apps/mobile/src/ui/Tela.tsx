import type { ReactNode } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { BotaoApoio } from './BotaoApoio';
import { imagemSagui, type PoseSagui } from './sagui';
import { Texto } from './Texto';
import { cor, FAIXA, LABIO, raio, type CorFaixa } from './tema';
import { COLUNA_MAXIMA } from '@mentor/core/layoutResponsivo';

interface CabecalhoProps {
  titulo: string;
  subtitulo?: string;
  cor: CorFaixa;
  pose: PoseSagui;
  acao?: ReactNode;
  /** Mostra a seta de voltar (telas empilhadas, fora das abas). */
  voltar?: boolean;
}

/**
 * Faixa colorida com o sagui, uma cor por seção (como no web). O botão
 * de apoio fica SEMPRE aqui: o overlay de crise precisa estar a no
 * máximo dois toques de qualquer tela (#46), e o cabeçalho é a única
 * peça que toda tela do aluno tem.
 */
export function Cabecalho({ titulo, subtitulo, cor: corFaixa, pose, acao, voltar }: CabecalhoProps) {
  const f = FAIXA[corFaixa];
  return (
    <View style={[estilos.faixa, { backgroundColor: f.fundo, borderBottomColor: f.labio }]}>
      <View style={[estilos.bolha, { right: -40, top: -50 }]} />
      <View style={estilos.linhaTopo}>
        {voltar ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={12}
            style={estilos.botaoTopo}
          >
            <Ionicons name="arrow-back" size={22} color={cor.branco} />
          </Pressable>
        ) : (
          <View />
        )}
        <BotaoApoio />
      </View>
      <View style={estilos.textos}>
        <Texto variante="titulo" cor={cor.branco} accessibilityRole="header">
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto style={estilos.subtitulo} cor="rgba(255,255,255,0.92)">
            {subtitulo}
          </Texto>
        ) : null}
        {acao ? <View style={estilos.acao}>{acao}</View> : null}
      </View>
      <Image
        source={imagemSagui(pose)}
        style={estilos.sagui}
        accessibilityIgnoresInvertColors
        accessible={false}
        importantForAccessibility="no"
      />
    </View>
  );
}

interface TelaProps {
  children: ReactNode;
  cabecalho?: CabecalhoProps;
  /** Puxar para atualizar. Sem a função, a tela não oferece o gesto. */
  aoAtualizar?: () => void;
  atualizando?: boolean;
  /** Conteúdo que rola sozinho (FlatList): desliga o ScrollView externo. */
  semRolagem?: boolean;
  estiloConteudo?: StyleProp<ViewStyle>;
}

/**
 * Moldura de toda tela do aluno: área segura, cabeçalho e rolagem.
 *
 * Em tela larga a coluna para em COLUNA_MAXIMA e centraliza; esticada até 1920px a
 * leitura de uma linha de texto vira exercício de pescoço.
 */
export function Tela({ children, cabecalho, aoAtualizar, atualizando = false, semRolagem, estiloConteudo }: TelaProps) {
  const insets = useSafeAreaInsets();
  const conteudo = (
    <View style={[estilos.coluna, estiloConteudo]}>
      {cabecalho ? <Cabecalho {...cabecalho} /> : null}
      {children}
    </View>
  );

  if (semRolagem) {
    return <View style={[estilos.fundo, { paddingTop: insets.top + 8 }]}>{conteudo}</View>;
  }
  return (
    <ScrollView
      style={estilos.fundo}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, alignItems: 'center' }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        aoAtualizar ? (
          <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cor.azul600} colors={[cor.azul600]} />
        ) : undefined
      }
    >
      {conteudo}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cor.branco },
  // Largura pela coluna, não pela janela: a janela não desconta a barra lateral.
  coluna: { alignSelf: 'center', width: '100%', maxWidth: COLUNA_MAXIMA, paddingHorizontal: 16, gap: 14, flex: 1 },
  faixa: {
    borderRadius: raio.xl,
    borderBottomWidth: LABIO,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    overflow: 'hidden',
    minHeight: 120,
  },
  bolha: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 },
  botaoTopo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  textos: { paddingRight: 84, marginTop: 2, zIndex: 2 },
  subtitulo: { fontWeight: '700', marginTop: 4 },
  acao: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sagui: { position: 'absolute', right: 4, bottom: 0, width: 88, height: 88, resizeMode: 'contain' },
});
