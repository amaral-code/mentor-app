import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
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

function SaguiNoTronco({ fase, largura, alturaToca, todasFeitas }: { fase: Fase; largura: number; alturaToca: number; todasFeitas: boolean }) {
  const reduzido = useReducedMotion();
  const escala = largura / QUADRO_ARVORE.largura;
  const alturaArvore = QUADRO_ARVORE.altura * escala;
  const tamanho = Math.round(largura * 0.46);
  const toca = centroDaToca(alturaToca);
  const yPorta = toca.y * escala - tamanho * 0.62;
  const yChao = alturaArvore - tamanho * 0.95;

  const y = useSharedValue(yPorta);
  const giro = useSharedValue(0);
  const tam = useSharedValue(1);
  const opac = useSharedValue(1);

  useEffect(() => {
    const ms = (f: Fase) => duracaoDaFase(f, reduzido);
    cancelAnimation(y);
    if (todasFeitas) {
      tam.value = 1;
      opac.value = 1;
      y.value = reduzido ? yPorta : withRepeat(withTiming(yPorta - 10, { duration: 600 }), -1, true);
      return;
    }
    if (fase === 'subindo') {
      // Três puxadas no tronco, balançando o corpo a cada uma.
      const passo = (yChao - yPorta) / 3;
      const t = ms('subindo') / 3;
      tam.value = 1;
      opac.value = 1;
      y.value = yChao;
      y.value = withSequence(
        withTiming(yChao - passo, { duration: t, easing: Easing.out(Easing.quad) }),
        withTiming(yChao - 2 * passo, { duration: t, easing: Easing.out(Easing.quad) }),
        withTiming(yPorta, { duration: t, easing: Easing.out(Easing.quad) }),
      );
      giro.value = reduzido ? 0 : withSequence(withTiming(-8, { duration: t }), withTiming(8, { duration: t }), withTiming(0, { duration: t }));
    } else if (fase === 'entrando' || fase === 'dentro') {
      y.value = withTiming(toca.y * escala - tamanho / 2, { duration: ms('entrando') });
      tam.value = withTiming(0.12, { duration: ms('entrando'), easing: Easing.in(Easing.quad) });
      opac.value = withTiming(0, { duration: ms('entrando') });
    } else if (fase === 'saindo') {
      y.value = withTiming(yPorta, { duration: ms('saindo') });
      tam.value = withTiming(1, { duration: ms('saindo'), easing: Easing.out(Easing.back(1.6)) });
      opac.value = withTiming(1, { duration: ms('saindo') });
    } else {
      y.value = yPorta;
      tam.value = 1;
      opac.value = 1;
    }
  }, [fase, todasFeitas, reduzido, yPorta, yChao, toca.y, escala, tamanho, y, giro, tam, opac]);

  const estilo = useAnimatedStyle(() => ({
    opacity: opac.value,
    transform: [{ translateY: y.value }, { rotate: `${giro.value}deg` }, { scale: tam.value }],
  }));
  const pose = todasFeitas || fase === 'subindo' ? 'pulando' : 'acenando';
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: toca.x * escala + 6 - (fase === 'entrando' || fase === 'dentro' ? tamanho / 2 + 6 : 0), top: 0, width: tamanho, height: tamanho }, estilo]}>
      <Image source={imagemSagui(pose)} style={{ width: tamanho, height: tamanho, resizeMode: 'contain' }} accessible={false} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */

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
    conteudo.value = withTiming(1, { duration: 700 });
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
                  Toca da árvore {arvore.indice + 1} de {total}
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
            <Image source={imagemSagui('estudando')} style={estilos.saguiDentro} accessible={false} />

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
          <View key={a.tarefa.id} style={[estilos.linha, { flexDirection: a.lado === 'esquerda' ? 'row' : 'row-reverse' }]}>
            <View style={{ width: largura, height: alturaArvore }}>
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
            </View>
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
