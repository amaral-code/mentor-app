import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MicroTask } from '@mentor/core/types';
import {
  QUADRO_ARVORE,
  XP_DA_TAREFA,
  centroDaToca,
  duracaoDaFase,
  formasDaArvore,
  montarFloresta,
  passosDaToca,
  podeComprovar,
  proximaFase,
  rotuloDaArvore,
  type Arvore,
  type Evento,
  type Fase,
} from '@mentor/core/florestaDoDia';
import { DURACAO_DA_ENTRADA, INICIO_DO_ZOOM, MOVIMENTOS, ZOOM_FINAL, trajetoDaEntrada, trajetoDaEscalada } from '@mentor/core/animacaoSagui';
import { anunciar } from '../../ui/acessibilidade';
import { Botao } from '../../ui/Botao';
import { imagemSagui } from '../../ui/sagui';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';
import { Comprovacao } from './Comprovacao';

/*
 * Floresta do dia no app: o mesmo desenho e a mesma ordem de fases do web
 * (@mentor/core/florestaDoDia). O sagui sobe pelo tronco no thread de UI
 * (Reanimated), entra na toca e a toca abre num círculo que cresce a
 * partir do buraco. XP só pela comprovação, como antes.
 */

function DesenhoArvore({ arvore, largura }: { arvore: Arvore; largura: number }) {
  const formas = useMemo(() => formasDaArvore(arvore), [arvore]);
  return (
    <Svg width={largura} height={(largura * QUADRO_ARVORE.altura) / QUADRO_ARVORE.largura} viewBox={`0 0 ${QUADRO_ARVORE.largura} ${QUADRO_ARVORE.altura}`}>
      {formas.map((f, i) =>
        f.forma === 'circulo' ? (
          <Circle key={i} cx={f.cx} cy={f.cy} r={f.r} fill={f.cor} />
        ) : f.forma === 'elipse' ? (
          <Ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill={f.cor} />
        ) : (
          <Path key={i} d={f.d} fill={f.cor} />
        ),
      )}
    </Svg>
  );
}

/* ------------------------------------------------------------------ */

/* Trajeto do core em sequência de withTiming: cada trecho dura a fração
   de tempo que o core deu a ele. Trecho curtíssimo é a troca de braço
   (espelho), que tem de ser instantânea. */
function emSequencia(valores: number[], tempos: number[], totalMs: number, facilidade = Easing.inOut(Easing.quad)) {
  const passos = valores.slice(1).map((v, i) => withTiming(v, { duration: Math.max(0, (tempos[i + 1] - tempos[i]) * totalMs), easing: facilidade }));
  return withSequence(withTiming(valores[0], { duration: 0 }), ...passos);
}

function SaguiNoTronco({ fase, largura, alturaToca, todasFeitas }: { fase: Fase; largura: number; alturaToca: number; todasFeitas: boolean }) {
  const reduzido = useReducedMotion();
  const escala = largura / QUADRO_ARVORE.largura;
  const alturaArvore = QUADRO_ARVORE.altura * escala;
  const tamanho = Math.round(largura * 0.46);
  const toca = centroDaToca(alturaToca);
  const tocaPx = { x: toca.x * escala, y: toca.y * escala };
  const porta = { x: tocaPx.x + 4, y: tocaPx.y - tamanho * 0.62 };
  const chao = alturaArvore - tamanho * 0.95;

  const x = useSharedValue(porta.x);
  const y = useSharedValue(porta.y);
  const ex = useSharedValue(1);
  const ey = useSharedValue(1);
  const giro = useSharedValue(0);
  const opac = useSharedValue(1);

  useEffect(() => {
    [x, y, ex, ey, giro, opac].forEach((v) => cancelAnimation(v));
    const parar = () => {
      x.value = porta.x;
      y.value = porta.y;
      ex.value = 1;
      ey.value = 1;
      giro.value = 0;
      opac.value = 1;
    };
    if (reduzido) {
      parar();
      if (fase === 'entrando' || fase === 'dentro') opac.value = 0;
      return;
    }
    if (todasFeitas) {
      parar();
      const m = MOVIMENTOS.pular;
      const tempos = m.quadros.map((qd) => qd.t);
      y.value = withRepeat(emSequencia(m.quadros.map((qd) => porta.y + qd.y * tamanho), tempos, m.duracaoMs), -1);
      ey.value = withRepeat(emSequencia(m.quadros.map((qd) => qd.escalaY), tempos, m.duracaoMs), -1);
      return;
    }
    if (fase === 'subindo') {
      const { pontos, duracaoMs } = trajetoDaEscalada(chao, porta.y, porta.x);
      const tempos = pontos.map((p) => p.t);
      x.value = porta.x;
      opac.value = 1;
      y.value = emSequencia(pontos.map((p) => p.y), tempos, duracaoMs, Easing.out(Easing.quad));
      ex.value = emSequencia(pontos.map((p) => p.escalaX), tempos, duracaoMs, Easing.linear);
      ey.value = emSequencia(pontos.map((p) => p.escalaY), tempos, duracaoMs);
      giro.value = emSequencia(pontos.map((p) => p.giro), tempos, duracaoMs);
    } else if (fase === 'pronto') {
      parar();
      // Acena da porta, com uma pausa entre um aceno e outro.
      const m = MOVIMENTOS.acenar;
      giro.value = withRepeat(withSequence(emSequencia(m.quadros.map((qd) => qd.giro), m.quadros.map((qd) => qd.t), m.duracaoMs), withTiming(0, { duration: 1400 })), -1);
    } else if (fase === 'dentro') {
      // Já está lá dentro: invisível no buraco. Repetir a entrada aqui, com
      // a câmera em zoom, fazia um sagui gigante cruzar a tela.
      x.value = tocaPx.x - tamanho / 2;
      y.value = tocaPx.y - tamanho / 2;
      ex.value = 0.05;
      ey.value = 0.05;
      opac.value = 0;
    } else if (fase === 'entrando') {
      const pontos = trajetoDaEntrada(porta, tocaPx, tamanho);
      const tempos = pontos.map((p) => p.t);
      x.value = emSequencia(pontos.map((p) => p.x), tempos, DURACAO_DA_ENTRADA);
      y.value = emSequencia(pontos.map((p) => p.y), tempos, DURACAO_DA_ENTRADA);
      ex.value = emSequencia(pontos.map((p) => p.escalaX), tempos, DURACAO_DA_ENTRADA);
      ey.value = emSequencia(pontos.map((p) => p.escalaY), tempos, DURACAO_DA_ENTRADA);
      giro.value = emSequencia(pontos.map((p) => p.giro), tempos, DURACAO_DA_ENTRADA);
      opac.value = emSequencia(pontos.map((p) => p.opacidade), tempos, DURACAO_DA_ENTRADA);
    } else if (fase === 'saindo') {
      const ms = duracaoDaFase('saindo', false);
      x.value = tocaPx.x - tamanho / 2;
      y.value = tocaPx.y - tamanho / 2;
      ex.value = 0.1;
      ey.value = 0.1;
      opac.value = 0;
      giro.value = 0;
      x.value = withTiming(porta.x, { duration: ms });
      y.value = withTiming(porta.y, { duration: ms, easing: Easing.out(Easing.back(1.4)) });
      ex.value = withTiming(1, { duration: ms });
      ey.value = withTiming(1, { duration: ms });
      opac.value = withTiming(1, { duration: ms / 2 });
    }
  }, [fase, todasFeitas, reduzido, porta.x, porta.y, chao, tamanho, tocaPx.x, tocaPx.y, x, y, ex, ey, giro, opac]);

  const estilo = useAnimatedStyle(() => ({
    opacity: opac.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${giro.value}deg` }, { scaleX: ex.value }, { scaleY: ey.value }],
  }));
  const pose = todasFeitas ? 'pose_17' : fase === 'subindo' || fase === 'entrando' || fase === 'dentro' ? 'pulando' : 'pose_15';
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: tamanho, height: tamanho, zIndex: 2 }, estilo]}>
      <Image source={imagemSagui(pose)} style={{ width: tamanho, height: tamanho, resizeMode: 'contain' }} accessible={false} />
    </Animated.View>
  );
}

/** Câmera: depois do mergulho, a árvore cresce em volta do buraco; na saída, volta. */
function ArvoreComZoom({ fase, ativo, origem, children, largura, altura }: { fase: Fase; ativo: boolean; origem: { x: number; y: number }; children: ReactNode; largura: number; altura: number }) {
  const reduzido = useReducedMotion();
  const zoom = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(zoom);
    if (!ativo || reduzido) {
      zoom.value = 1;
      return;
    }
    if (fase === 'entrando') {
      const espera = DURACAO_DA_ENTRADA * INICIO_DO_ZOOM;
      zoom.value = withSequence(withTiming(1, { duration: espera }), withTiming(ZOOM_FINAL, { duration: DURACAO_DA_ENTRADA - espera, easing: Easing.in(Easing.quad) }));
    } else if (fase === 'dentro') {
      zoom.value = ZOOM_FINAL;
    } else if (fase === 'saindo') {
      zoom.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    } else {
      zoom.value = 1;
    }
  }, [fase, ativo, reduzido, zoom]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }));
  return (
    <Animated.View style={[{ width: largura, height: altura, transformOrigin: [origem.x, origem.y, 0], zIndex: ativo && fase !== 'pronto' ? 10 : 0 }, estilo]}>
      {children}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */

/** Na missão, o sagui cai pelo buraco lá de cima e aterrissa de pé. */
function SaguiAterrissando() {
  const reduzido = useReducedMotion();
  const y = useSharedValue(reduzido ? 0 : -260);
  const ex = useSharedValue(reduzido ? 1 : 0.9);
  const ey = useSharedValue(reduzido ? 1 : 1.1);
  useEffect(() => {
    if (reduzido) return;
    const queda = 340;
    y.value = withSequence(withTiming(-260, { duration: 300 }), withTiming(0, { duration: queda, easing: Easing.in(Easing.quad) }));
    // Achata no impacto, estica de volta e assenta.
    ex.value = withSequence(withTiming(0.9, { duration: 300 + queda }), withTiming(1.18, { duration: 90 }), withTiming(0.96, { duration: 120 }), withTiming(1, { duration: 140 }));
    ey.value = withSequence(withTiming(1.1, { duration: 300 + queda }), withTiming(0.78, { duration: 90 }), withTiming(1.06, { duration: 120 }), withTiming(1, { duration: 140 }));
  }, [reduzido, y, ex, ey]);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scaleX: ex.value }, { scaleY: ey.value }],
  }));
  return (
    <Animated.View style={[{ alignSelf: 'center', transformOrigin: ['50%', '100%', 0] }, estilo]}>
      <Image source={imagemSagui('estudando')} style={estilos.saguiDentro} accessible={false} />
    </Animated.View>
  );
}

function DentroDaToca({
  arvore,
  total,
  origem,
  aoComprovar,
  aoSair,
}: {
  arvore: Arvore;
  total: number;
  origem: { x: number; y: number };
  aoComprovar: () => void;
  aoSair: () => void;
}) {
  const reduzido = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(arvore.tarefa.completed ? ['entender', 'fazer'] : []));
  const feita = arvore.tarefa.completed;
  const passos = passosDaToca(arvore.tarefa);

  // A toca abre num círculo que cresce a partir do buraco do tronco.
  const raioFinal = Math.hypot(width, height);
  const abre = useSharedValue(reduzido ? 1 : 0);
  const conteudo = useSharedValue(reduzido ? 1 : 0);
  useEffect(() => {
    if (reduzido) return;
    abre.value = withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) });
    conteudo.value = withTiming(1, { duration: 500 });
  }, [reduzido, abre, conteudo]);
  useEffect(() => {
    anunciar(`Dentro da toca: ${arvore.tarefa.titulo}`);
  }, [arvore.tarefa.titulo]);

  const circulo = useAnimatedStyle(() => ({ transform: [{ scale: Math.max(0.001, abre.value) }] }));
  const aparecer = useAnimatedStyle(() => ({ opacity: conteudo.value, transform: [{ translateY: (1 - conteudo.value) * 16 }] }));

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={aoSair} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: origem.x - raioFinal,
              top: origem.y - raioFinal,
              width: raioFinal * 2,
              height: raioFinal * 2,
              borderRadius: raioFinal,
              backgroundColor: TERRA,
            },
            circulo,
          ]}
        />
        <Animated.View style={[{ flex: 1 }, aparecer]}>
          <ScrollView contentContainerStyle={[estilos.toca, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
            <View style={estilos.topo}>
              <View style={{ flex: 1 }}>
                <Texto variante="rotulo" cor={cor.ambar100}>
                  Missão · árvore {arvore.indice + 1} de {total}
                </Texto>
                <Texto variante="titulo" cor={cor.branco} accessibilityRole="header">
                  {arvore.tarefa.titulo}
                </Texto>
              </View>
              <Pressable onPress={aoSair} accessibilityRole="button" accessibilityLabel="Sair da toca" style={estilos.sair} hitSlop={8}>
                <Ionicons name="exit-outline" size={18} color={cor.ambar100} />
                <Texto negrito cor={cor.ambar100}>
                  Sair
                </Texto>
              </Pressable>
            </View>
            <SaguiAterrissando />

            {passos.map((p, i) => {
              const marcado = marcados.has(p.id) || (p.daXp && feita);
              const liberado = !p.daXp || podeComprovar(marcados);
              return (
                <View key={p.id} style={[estilos.passo, marcado ? estilos.passoFeito : null]}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[estilos.numero, { backgroundColor: marcado ? cor.esmeralda700 : '#B45309' }]}>
                      {marcado ? <Ionicons name="checkmark" size={20} color={cor.branco} /> : <Texto negrito cor={cor.branco}>{i + 1}</Texto>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Texto negrito cor={cor.tinta900}>
                        {p.titulo}
                      </Texto>
                      <Texto cor={cor.tinta700}>{p.texto}</Texto>
                    </View>
                  </View>
                  {!p.daXp ? (
                    <Botao
                      titulo={marcados.has(p.id) ? 'Feito' : p.id === 'entender' ? 'Entendi' : 'Terminei'}
                      variante="secundario"
                      compacto
                      desabilitado={feita}
                      aoTocar={() => alternar(p.id)}
                      estilo={{ marginTop: 10 }}
                    />
                  ) : feita ? (
                    <View style={estilos.concluida} accessibilityLiveRegion="polite">
                      <Ionicons name="checkmark-circle" size={20} color={cor.branco} />
                      <Texto negrito cor={cor.branco}>
                        Tarefa concluída · +{XP_DA_TAREFA} XP
                      </Texto>
                    </View>
                  ) : (
                    <>
                      <Botao
                        titulo={`Comprovar · +${XP_DA_TAREFA} XP`}
                        variante="ambar"
                        icone={liberado ? 'flash' : 'lock-closed'}
                        desabilitado={!liberado}
                        aoTocar={aoComprovar}
                        estilo={{ marginTop: 10 }}
                      />
                      {!liberado ? (
                        <Texto variante="legenda" cor="#78350F" style={{ marginTop: 6 }}>
                          Marque os dois passos de cima para liberar.
                        </Texto>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
            {feita ? <Botao titulo="Sair e ir para a próxima árvore" aoTocar={aoSair} /> : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function FlorestaDoDia({ tarefas }: { tarefas: MicroTask[] }) {
  const reduzido = useReducedMotion();
  const { width } = useWindowDimensions();
  const largura = width >= 820 ? 190 : 150;
  const floresta = useMemo(() => montarFloresta(tarefas), [tarefas]);
  const total = floresta.arvores.length;
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const indiceSagui = escolhida !== null && floresta.arvores[escolhida] ? escolhida : floresta.indiceAtual >= 0 ? floresta.indiceAtual : total - 1;
  const [fase, setFase] = useState<Fase>('subindo');
  const disparar = useCallback((ev: Evento) => setFase((f) => proximaFase(f, ev)), []);
  const [comprovando, setComprovando] = useState(false);
  const tocas = useRef<(ComponentRef<typeof View> | null)[]>([]);
  const [origem, setOrigem] = useState({ x: width / 2, y: 300 });

  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    disparar('mudouDeArvore');
  }, [indiceSagui, disparar]);

  useEffect(() => {
    if (fase !== 'subindo' && fase !== 'entrando' && fase !== 'saindo') return;
    const t = setTimeout(() => disparar('fimDaAnimacao'), duracaoDaFase(fase, reduzido));
    return () => clearTimeout(t);
  }, [fase, reduzido, disparar]);

  useEffect(() => {
    if (fase === 'pronto' && escolhida !== null && floresta.arvores[escolhida]?.tarefa.completed) setEscolhida(null);
  }, [fase, escolhida, floresta]);

  function entrar(indice: number) {
    tocas.current[indice]?.measureInWindow((x, y, w, h) => setOrigem({ x: x + w / 2, y: y + h / 2 }));
    if (indice !== indiceSagui) {
      setEscolhida(indice);
      return;
    }
    // Prende o sagui nesta árvore com a toca aberta (ver o web).
    setEscolhida(indice);
    disparar('tocar');
  }

  const escala = largura / QUADRO_ARVORE.largura;
  const alturaArvore = QUADRO_ARVORE.altura * escala;
  const arvoreDoSagui = floresta.arvores[indiceSagui];

  return (
    <View style={estilos.floresta} accessibilityRole="list">
      {floresta.arvores.map((a) => {
        const comSagui = a.indice === indiceSagui;
        const toca = centroDaToca(a.alturaToca);
        return (
          <View key={a.tarefa.id} style={[estilos.linha, { flexDirection: a.lado === 'esquerda' ? 'row' : 'row-reverse', zIndex: comSagui && fase !== 'pronto' ? 10 : 0 }]}>
            <ArvoreComZoom fase={fase} ativo={comSagui} origem={{ x: toca.x * escala, y: toca.y * escala }} largura={largura} altura={alturaArvore}>
              <Pressable
                onPress={() => entrar(a.indice)}
                disabled={a.estado === 'feita'}
                accessibilityRole="button"
                accessibilityLabel={rotuloDaArvore(a, total)}
                accessibilityState={{ disabled: a.estado === 'feita' }}
              >
                <DesenhoArvore arvore={a} largura={largura} />
              </Pressable>
              <View
                ref={(el) => {
                  tocas.current[a.indice] = el;
                }}
                collapsable={false}
                pointerEvents="none"
                style={{ position: 'absolute', left: toca.x * escala - 10, top: toca.y * escala - 10, width: 20, height: 20 }}
              />
              {comSagui ? <SaguiNoTronco fase={fase} largura={largura} alturaToca={a.alturaToca} todasFeitas={floresta.todasFeitas} /> : null}
              {a.estado === 'feita' ? (
                <View style={estilos.selo}>
                  <Ionicons name="checkmark" size={18} color={cor.branco} />
                </View>
              ) : null}
            </ArvoreComZoom>
            <View style={{ flex: 1, alignItems: a.lado === 'esquerda' ? 'flex-start' : 'flex-end' }}>
              <Texto variante="rotulo">Árvore {a.indice + 1}</Texto>
              <Texto
                negrito
                cor={a.estado === 'feita' ? cor.cinza400 : cor.tinta900}
                style={[{ textAlign: a.lado === 'esquerda' ? 'left' : 'right' }, a.estado === 'feita' ? { textDecorationLine: 'line-through' } : null]}
              >
                {a.tarefa.titulo}
              </Texto>
              {comSagui && a.estado !== 'feita' ? (
                <Botao titulo="Entrar na toca" variante="ambar" compacto aoTocar={() => entrar(a.indice)} rotuloAcessivel={`Entrar na toca: ${a.tarefa.titulo}`} estilo={{ marginTop: 8 }} />
              ) : null}
            </View>
          </View>
        );
      })}

      <View style={estilos.fim} accessible accessibilityLabel={floresta.todasFeitas ? 'Plano do dia completo' : 'Fim da floresta de hoje'}>
        <View style={[estilos.trofeu, { backgroundColor: floresta.todasFeitas ? cor.ambar500 : cor.cinza200 }]}>
          <Ionicons name="trophy" size={40} color={floresta.todasFeitas ? cor.branco : cor.cinza400} />
        </View>
        <Texto negrito cor={floresta.todasFeitas ? cor.ambar700 : cor.tinta500}>
          {floresta.todasFeitas ? 'Plano do dia completo!' : 'Termine as árvores para fechar o dia'}
        </Texto>
      </View>

      {fase === 'dentro' && arvoreDoSagui && !comprovando ? (
        <DentroDaToca
          key={arvoreDoSagui.tarefa.id}
          arvore={arvoreDoSagui}
          total={total}
          origem={origem}
          aoComprovar={() => setComprovando(true)}
          aoSair={() => disparar('fechar')}
        />
      ) : null}
      {/* A comprovação é a mesma de antes; ao fechar, volta para dentro da toca. */}
      {comprovando && arvoreDoSagui ? <Comprovacao tarefa={arvoreDoSagui.tarefa} aoFechar={() => setComprovando(false)} /> : null}
    </View>
  );
}

const TERRA = '#5A341A';

const estilos = StyleSheet.create({
  floresta: { gap: 4, paddingVertical: 8, width: '100%', maxWidth: 480, alignSelf: 'center' },
  linha: { alignItems: 'center', gap: 12 },
  selo: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: cor.esmeralda700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fim: { alignItems: 'center', gap: 8, marginTop: 12 },
  trofeu: { width: 88, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  toca: { paddingHorizontal: 16, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: raio.md,
    borderWidth: 2,
    borderColor: 'rgba(254,243,199,0.4)',
  },
  saguiDentro: { width: 112, height: 112, resizeMode: 'contain', alignSelf: 'center' },
  passo: { backgroundColor: '#FFFBEB', borderRadius: raio.lg, borderWidth: 2, borderColor: '#FDE68A', padding: 14 },
  passoFeito: { backgroundColor: '#ECFDF5', borderColor: cor.esmeralda700 },
  numero: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  concluida: {
    marginTop: 10,
    minHeight: 46,
    borderRadius: raio.md,
    backgroundColor: cor.esmeralda700,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
