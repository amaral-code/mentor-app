import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { DadosMapaMental } from '@mentor/core/aiService';
import { layoutMapaMental } from '@mentor/core/mapaMental';
import { Texto } from '../../ui/Texto';
import { cor } from '../../ui/tema';

const CORES_RAMO = [cor.ceu600, cor.esmeralda600, cor.ambar600, cor.violeta600, cor.vermelho600, cor.azul600];
const FONTE = Platform.select({ web: 'system-ui, sans-serif', default: undefined });
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;

/**
 * Mapa mental em SVG nativo (o web usa Mermaid, que precisa de DOM).
 *
 * Zoom pelos botões + e − (funcionam com leitor de tela e mouse) e, no
 * iOS, também com pinça. Arrastar: o mapa fica dentro de duas rolagens,
 * uma horizontal e uma vertical, o que funciona igual em todo lugar.
 * Para o leitor de tela, o mapa vira uma lista: tema, ramos e pontos.
 */
export function MapaMental({ dados }: { dados: DadosMapaMental }) {
  const layout = useMemo(() => layoutMapaMental(dados), [dados]);
  const [zoom, setZoom] = useState(0.8);
  const [larguraVisivel, setLarguraVisivel] = useState(0);
  /* Abre inteiro na largura da tela; daí o aluno aproxima o que quiser. */
  const ajustar = (largura = larguraVisivel) =>
    largura > 0 && setZoom(Math.min(1, Math.max(ZOOM_MIN, +((largura - 4) / layout.largura).toFixed(2))));
  const porId = useMemo(() => new Map(layout.nos.map((n) => [n.id, n])), [layout]);
  const descricao = `Mapa mental: ${dados.titulo}. ${dados.ramos.map((r) => `${r.rotulo}${r.filhos.length ? `: ${r.filhos.join(', ')}` : ''}`).join('. ')}.`;

  const mudarZoom = (delta: number) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + delta).toFixed(2))));

  return (
    <View style={{ gap: 8 }}>
      <View style={estilos.barra}>
        <Pressable onPress={() => ajustar()} accessibilityRole="button" accessibilityLabel="Ver o mapa inteiro" style={[estilos.botao, { width: 'auto', paddingHorizontal: 10 }]}>
          <Texto variante="legenda" negrito cor={cor.azul600}>
            Inteiro
          </Texto>
        </Pressable>
        <Pressable onPress={() => mudarZoom(-0.2)} accessibilityRole="button" accessibilityLabel="Diminuir o mapa" style={estilos.botao}>
          <Ionicons name="remove" size={22} color={cor.azul600} />
        </Pressable>
        <Texto variante="legenda" style={{ minWidth: 48, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </Texto>
        <Pressable onPress={() => mudarZoom(0.2)} accessibilityRole="button" accessibilityLabel="Aumentar o mapa" style={estilos.botao}>
          <Ionicons name="add" size={22} color={cor.azul600} />
        </Pressable>
      </View>
      <View
        style={estilos.moldura}
        accessible
        accessibilityRole="image"
        accessibilityLabel={descricao}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (larguraVisivel === 0) ajustar(w);
          setLarguraVisivel(w);
        }}
      >
        <ScrollView
          style={{ maxHeight: 460 }}
          nestedScrollEnabled
          maximumZoomScale={3}
          minimumZoomScale={0.5}
          bouncesZoom
        >
          <ScrollView horizontal nestedScrollEnabled>
            <Svg width={layout.largura * zoom} height={layout.altura * zoom} viewBox={`0 0 ${layout.largura} ${layout.altura}`}>
              {layout.arestas.map((a) => {
                const de = porId.get(a.de)!;
                const para = porId.get(a.para)!;
                return (
                  <Line
                    key={`${a.de}-${a.para}`}
                    x1={de.x}
                    y1={de.y}
                    x2={para.x}
                    y2={para.y}
                    stroke={CORES_RAMO[para.ramo % CORES_RAMO.length]}
                    strokeOpacity={0.45}
                    strokeWidth={para.nivel === 1 ? 3 : 2}
                  />
                );
              })}
              {layout.nos.map((n) => {
                const corRamo = n.ramo < 0 ? cor.azul600 : CORES_RAMO[n.ramo % CORES_RAMO.length];
                const fundo = n.nivel === 0 ? cor.azul600 : n.nivel === 1 ? corRamo : cor.branco;
                const texto = n.nivel === 2 ? cor.tinta900 : cor.branco;
                return (
                  <G key={n.id}>
                    <Rect
                      x={n.x - n.largura / 2}
                      y={n.y - n.altura / 2}
                      width={n.largura}
                      height={n.altura}
                      rx={n.nivel === 0 ? 18 : 12}
                      fill={fundo}
                      stroke={corRamo}
                      strokeWidth={2}
                    />
                    {n.linhas.map((l, i) => (
                      <SvgText
                        key={i}
                        x={n.x}
                        y={n.y - ((n.linhas.length - 1) * 17) / 2 + i * 17 + 5}
                        fontSize={n.nivel === 0 ? 15 : 13}
                        fontWeight={n.nivel === 2 ? '600' : '800'}
                        fill={texto}
                        textAnchor="middle"
                        fontFamily={FONTE}
                      >
                        {l}
                      </SvgText>
                    ))}
                  </G>
                );
              })}
            </Svg>
          </ScrollView>
        </ScrollView>
      </View>
      <Texto variante="legenda">Arraste para os lados e para baixo para percorrer o mapa.</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  botao: { width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: cor.cinza200, alignItems: 'center', justifyContent: 'center' },
  moldura: { borderRadius: 16, borderWidth: 2, borderColor: cor.cinza200, backgroundColor: cor.superficie, overflow: 'hidden' },
});
