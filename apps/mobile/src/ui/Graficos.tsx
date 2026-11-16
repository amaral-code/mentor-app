import { useState } from 'react';
import { Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { cor } from './tema';

/* No navegador o <text> do SVG nasce com fonte serifada; no celular já
   é a fonte do sistema. */
const FONTE_SVG = Platform.select({ web: 'system-ui, sans-serif', default: undefined });

export interface Barra {
  rotulo: string;
  valor: number;
  cor?: string;
  destaque?: boolean;
}

interface Props {
  barras: Barra[];
  altura?: number;
  /** Teto do eixo. Sem ele, o maior valor (mínimo 1, para não dividir por 0). */
  maximo?: number;
  /** Resumo para o leitor de tela: o gráfico em si é decorativo para ele. */
  resumo: string;
  mostrarRotulos?: boolean;
}

/**
 * Gráfico de barras em SVG.
 *
 * O web usa chart.js, que depende de <canvas> e não existe no React
 * Native. Para as barras simples da Central, react-native-svg resolve
 * sem trazer uma biblioteca de gráficos inteira (e o Skia que ela pede).
 */
export function GraficoBarras({ barras, altura = 120, maximo, resumo, mostrarRotulos = true }: Props) {
  const [largura, setLargura] = useState(0);
  const teto = Math.max(1, maximo ?? Math.max(...barras.map((b) => b.valor), 0));
  const rodape = mostrarRotulos ? 18 : 0;
  const areaAltura = altura - rodape;
  const passo = barras.length > 0 ? largura / barras.length : 0;
  const larguraBarra = Math.max(2, passo * 0.62);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={resumo}
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
      style={{ height: altura, width: '100%' }}
    >
      {largura > 0 ? (
        <Svg width={largura} height={altura}>
          <Line x1={0} x2={largura} y1={areaAltura} y2={areaAltura} stroke={cor.cinza200} strokeWidth={2} />
          {barras.map((b, i) => {
            const h = b.valor > 0 ? Math.max(4, (b.valor / teto) * (areaAltura - 6)) : 3;
            const x = i * passo + (passo - larguraBarra) / 2;
            return (
              <Rect
                key={`${b.rotulo}-${i}`}
                x={x}
                y={areaAltura - h}
                width={larguraBarra}
                height={h}
                rx={Math.min(6, larguraBarra / 3)}
                fill={b.valor > 0 ? b.cor ?? cor.ambar500 : cor.cinza200}
                opacity={b.destaque === false ? 0.75 : 1}
              />
            );
          })}
          {mostrarRotulos
            ? barras.map((b, i) => (
                <SvgText
                  key={`r-${b.rotulo}-${i}`}
                  x={i * passo + passo / 2}
                  y={altura - 4}
                  fontSize={11}
                  fontWeight={b.destaque ? '800' : '600'}
                  fill={b.destaque ? cor.ambar700 : cor.tinta500}
                  textAnchor="middle"
                  fontFamily={FONTE_SVG}
                >
                  {b.rotulo}
                </SvgText>
              ))
            : null}
        </Svg>
      ) : null}
    </View>
  );
}
