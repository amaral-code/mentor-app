import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useAppStore } from '@mentor/state/appStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMovimentoReduzido, anunciar } from './acessibilidade';
import { imagemSagui, type PoseSagui } from './sagui';
import { Texto } from './Texto';
import { cor, raio } from './tema';

/* ------------------------------------------------------------------ */

interface CampoProps extends TextInputProps {
  rotulo: string;
  erro?: string;
  estilo?: StyleProp<ViewStyle>;
}

/** Campo com rótulo visível (placeholder não é rótulo: some ao digitar). */
export function Campo({ rotulo, erro, estilo, ...resto }: CampoProps) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={estilo}>
      <Texto variante="rotulo" style={{ marginBottom: 6 }}>
        {rotulo}
      </Texto>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cor.cinza400}
        {...resto}
        onFocus={(e) => {
          setFoco(true);
          resto.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          resto.onBlur?.(e);
        }}
        style={[
          estilos.campo,
          { borderColor: erro ? cor.vermelho500 : foco ? cor.ceu500 : cor.cinza200 },
          resto.multiline ? estilos.campoMultilinha : null,
          resto.style,
        ]}
      />
      {erro ? (
        <Texto variante="legenda" cor={cor.vermelho600} style={{ marginTop: 4 }} accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */

/** Bloco cinza pulsando enquanto carrega. Com movimento reduzido, fica parado. */
export function Esqueleto({ altura = 16, largura = '100%', estilo }: { altura?: number; largura?: number | `${number}%`; estilo?: StyleProp<ViewStyle> }) {
  const reduzido = useMovimentoReduzido();
  const opacidade = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, opacidade]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height: altura, width: largura, borderRadius: raio.sm, backgroundColor: cor.cinza100, opacity: opacidade }, estilo]}
    />
  );
}

/* ------------------------------------------------------------------ */

export function Vazio({ titulo, texto, pose = 'meditando', acao }: { titulo: string; texto?: string; pose?: PoseSagui; acao?: ReactNode }) {
  return (
    <View style={estilos.vazio}>
      <Image source={imagemSagui(pose)} style={estilos.vazioSagui} accessible={false} />
      <Texto variante="subtitulo" centro>
        {titulo}
      </Texto>
      {texto ? (
        <Texto centro cor={cor.tinta500}>
          {texto}
        </Texto>
      ) : null}
      {acao}
    </View>
  );
}

/* ------------------------------------------------------------------ */

/** Barra de progresso fina (XP, meta do dia, índice de fadiga). */
export function Barra({ valor, corBarra = cor.ambar500, altura = 8, rotulo }: { valor: number; corBarra?: string; altura?: number; rotulo?: string }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height: altura, borderRadius: altura, backgroundColor: cor.cinza100, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: altura, backgroundColor: corBarra }} />
    </View>
  );
}

/* ------------------------------------------------------------------ */

/** Selo pequeno e arredondado (matéria, status). */
export function Selo({ texto, corFundo = cor.ceu100, corTexto = cor.ceu700 }: { texto: string; corFundo?: string; corTexto?: string }) {
  return (
    <View style={[estilos.selo, { backgroundColor: corFundo }]}>
      <Texto style={[estilos.seloTexto, { color: corTexto }]}>{texto}</Texto>
    </View>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Aviso do appStore (`setToast`). Também é falado pelo leitor de tela:
 * um toast só visual some antes de quem usa VoiceOver saber que existiu.
 */
export function Toast() {
  const mensagem = useAppStore((s) => s.toastMessage);
  const tipo = useAppStore((s) => s.toastType);
  const limpar = useAppStore((s) => s.clearToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!mensagem) return;
    anunciar(mensagem);
    const t = setTimeout(limpar, 4000);
    return () => clearTimeout(t);
  }, [mensagem, limpar]);

  if (!mensagem) return null;
  const fundo = tipo === 'error' ? cor.vermelho600 : tipo === 'success' ? cor.esmeralda600 : cor.azul600;
  return (
    <View pointerEvents="none" style={[estilos.toast, { bottom: insets.bottom + 84, backgroundColor: fundo }]}>
      <Texto cor={cor.branco} negrito accessibilityLiveRegion="polite">
        {mensagem}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    minHeight: 50,
    borderWidth: 2,
    borderRadius: raio.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: cor.tinta900,
    backgroundColor: cor.superficie,
  },
  campoMultilinha: { minHeight: 110, textAlignVertical: 'top' },
  vazio: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 16 },
  vazioSagui: { width: 96, height: 96, resizeMode: 'contain' },
  selo: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pilula, alignSelf: 'flex-start' },
  seloTexto: { fontSize: 12, fontWeight: '800' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: raio.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignSelf: 'center',
    maxWidth: 560,
  },
});
