import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PROPORCAO_A4 } from '../../lib/imagem';
import { prepararFoto, type FotoPronta } from '../../lib/foto';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';
import { cor } from '../../ui/tema';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  aoFotografar: (foto: FotoPronta) => void;
  aoPedirGaleria: () => void;
}

/**
 * Câmera com a moldura da folha A4 desenhada por cima.
 *
 * A moldura não é enfeite: ela ensina o enquadramento (folha inteira,
 * reta, sem a mesa em volta) e define o corte. A foto é cortada na
 * proporção da folha antes de subir, então o OCR recebe só a redação.
 * A prévia usa "cover", e o corte é calculado sobre a foto inteira com
 * folga de 4%: as duas áreas não batem ao pixel, e a folga cobre a diferença.
 */
export function CameraComGuia({ aberta, aoFechar, aoFotografar, aoPedirGaleria }: Props) {
  const [permissao, pedirPermissao] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [fotografando, setFotografando] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const area = { w: width - 40, h: height - insets.top - insets.bottom - 220 };
  let guiaW = area.w;
  let guiaH = guiaW / PROPORCAO_A4;
  if (guiaH > area.h) {
    guiaH = area.h;
    guiaW = guiaH * PROPORCAO_A4;
  }

  async function fotografar() {
    if (!camera.current || fotografando) return;
    setFotografando(true);
    try {
      const f = await camera.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (f) aoFotografar(await prepararFoto(f.uri, f.width, f.height, { cortarNaGuia: true }));
    } finally {
      setFotografando(false);
    }
  }

  return (
    <Modal visible={aberta} animationType="slide" onRequestClose={aoFechar} supportedOrientations={['portrait', 'landscape']}>
      <View style={estilos.fundo}>
        {!permissao?.granted ? (
          <View style={estilos.semPermissao}>
            <Texto variante="subtitulo" cor={cor.branco} centro>
              A câmera fotografa a folha da redação.
            </Texto>
            <Texto cor={cor.cinza300} centro>
              A foto vai só para a sua pasta privada e para a correção.
            </Texto>
            <Botao titulo="Permitir câmera" variante="ambar" aoTocar={() => void pedirPermissao()} />
            <Botao titulo="Escolher da galeria" variante="secundario" aoTocar={aoPedirGaleria} />
            <Botao titulo="Voltar" variante="fantasma" aoTocar={aoFechar} />
          </View>
        ) : (
          <>
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
            <View style={[estilos.topo, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar câmera" hitSlop={12} style={estilos.botaoRedondo}>
                <Ionicons name="close" size={26} color={cor.branco} />
              </Pressable>
              <Texto negrito cor={cor.branco} style={{ flex: 1, textAlign: 'center' }}>
                Encaixe a folha inteira na moldura
              </Texto>
              <View style={{ width: 44 }} />
            </View>
            <View pointerEvents="none" style={estilos.centro}>
              <View style={[estilos.guia, { width: guiaW, height: guiaH }]} accessibilityElementsHidden>
                <View style={[estilos.canto, { top: -3, left: -3, borderTopWidth: 6, borderLeftWidth: 6 }]} />
                <View style={[estilos.canto, { top: -3, right: -3, borderTopWidth: 6, borderRightWidth: 6 }]} />
                <View style={[estilos.canto, { bottom: -3, left: -3, borderBottomWidth: 6, borderLeftWidth: 6 }]} />
                <View style={[estilos.canto, { bottom: -3, right: -3, borderBottomWidth: 6, borderRightWidth: 6 }]} />
              </View>
            </View>
            <View style={[estilos.base, { paddingBottom: insets.bottom + 16 }]}>
              <Pressable onPress={aoPedirGaleria} accessibilityRole="button" accessibilityLabel="Escolher da galeria" style={estilos.botaoRedondo}>
                <Ionicons name="images-outline" size={24} color={cor.branco} />
              </Pressable>
              <Pressable
                onPress={() => void fotografar()}
                accessibilityRole="button"
                accessibilityLabel="Fotografar a redação"
                disabled={fotografando}
                style={estilos.disparador}
              >
                {fotografando ? <ActivityIndicator color={cor.azul600} /> : <View style={estilos.disparadorMiolo} />}
              </Pressable>
              <View style={{ width: 52 }} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: '#000' },
  semPermissao: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  topo: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, zIndex: 2 },
  centro: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  guia: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', borderRadius: 8 },
  canto: { position: 'absolute', width: 34, height: 34, borderColor: cor.ambar500 },
  base: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 16 },
  botaoRedondo: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  disparador: { width: 78, height: 78, borderRadius: 39, backgroundColor: cor.branco, alignItems: 'center', justifyContent: 'center' },
  disparadorMiolo: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: cor.azul600 },
});
