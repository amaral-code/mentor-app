import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { dimensoesParaEnvio, recorteDaGuia } from './imagem';

export interface FotoPronta {
  uri: string;
  /** JPEG em base64, sem o prefixo `data:`. */
  base64: string;
  largura: number;
  altura: number;
}

/**
 * Câmera (ou galeria, se a câmera for negada) e devolve a imagem pronta
 * para enviar: cortada na guia, reduzida e comprimida. `null` quando o
 * aluno desistiu.
 */
export async function escolherFoto(origem: 'camera' | 'galeria', opcoes: { cortarNaGuia?: boolean } = {}): Promise<FotoPronta | null> {
  let resultado: ImagePicker.ImagePickerResult;
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) return escolherFoto('galeria', opcoes);
    resultado = await ImagePicker.launchCameraAsync({ quality: 1 });
  } else {
    resultado = await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] });
  }
  if (resultado.canceled || !resultado.assets[0]) return null;
  const a = resultado.assets[0];
  return prepararFoto(a.uri, a.width, a.height, opcoes);
}

/** Corta (opcional), reduz e comprime uma foto já tirada. */
export async function prepararFoto(uri: string, largura: number, altura: number, { cortarNaGuia = false } = {}): Promise<FotoPronta> {
  const contexto = ImageManipulator.manipulate(uri);
  let w = largura;
  let h = altura;
  if (cortarNaGuia && largura > 0 && altura > 0) {
    const r = recorteDaGuia(largura, altura);
    contexto.crop(r);
    w = r.width;
    h = r.height;
  }
  const alvo = dimensoesParaEnvio(w, h);
  if (alvo.largura < w) contexto.resize({ width: alvo.largura });
  const imagem = await contexto.renderAsync();
  // 0.7: abaixo disso o JPEG borra o traço fino da caneta.
  const salvo = await imagem.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { uri: salvo.uri, base64: salvo.base64 ?? '', largura: salvo.width, altura: salvo.height };
}
