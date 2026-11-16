import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Speech from 'expo-speech';
import { conteudoRepository } from '@mentor/api/ConteudoRepository';
import { hasProxy, sintetizarAudio } from '@mentor/core/aiService';
import { estaConcluido, estimarDuracaoSegundos, formatarTempo, VOZES } from '@mentor/core/audioPills';
import { obterRoteiroDaPilula } from '@mentor/core/roteiroPilula';
import type { ModuloAudio, ProgressoAudio } from '@mentor/core/types';
import { useAppStore } from '@mentor/state/appStore';
import { apagarBaixado, audioBaixado, baixar, paraTocar, podeBaixar } from '../../src/features/audio/arquivosAudio';
import { deveSalvarProgresso, proximaVelocidade } from '../../src/lib/audio';
import { anunciar } from '../../src/ui/acessibilidade';
import { Barra, Esqueleto, Selo, Vazio } from '../../src/ui/Basicos';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { ALVO_TOQUE, cor, raio } from '../../src/ui/tema';

/**
 * Pílulas de áudio: três minutos por tema, fone no ouvido, tela apagada.
 *
 * Toca em segundo plano (UIBackgroundModes "audio" pelo plugin do
 * expo-audio) com controles na tela de bloqueio; no Android esses
 * controles são também o que mantém o áudio vivo depois de ~3 minutos
 * em segundo plano. Sem voz neural (sem servidor), lê o roteiro com a
 * voz do aparelho (expo-speech).
 */
export default function Audio() {
  const apiKey = useAppStore((s) => s.apiKey);
  const [modulos, setModulos] = useState<ModuloAudio[]>([]);
  const [progresso, setProgresso] = useState<Record<string, ProgressoAudio>>({});
  const [carregando, setCarregando] = useState(true);
  const [ativo, setAtivo] = useState<ModuloAudio | null>(null);
  const [roteiro, setRoteiro] = useState('');
  const [origem, setOrigem] = useState('');
  const [fonte, setFonte] = useState<{ uri: string; dataUrl: string | null } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [voz, setVoz] = useState<string>(VOZES[0].id);
  const [falando, setFalando] = useState(false);
  const [baixados, setBaixados] = useState(0);
  const ultimoSalvo = useRef(0);

  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    // Toca com o celular no silencioso e em segundo plano; "doNotMix" é
    // o que a tela de bloqueio exige para mostrar os controles.
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    Promise.all([conteudoRepository.listarModulos(), conteudoRepository.carregarProgresso()])
      .then(([m, p]) => {
        setModulos(m);
        setProgresso(p);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
    return () => {
      void Speech.stop();
    };
  }, []);

  const porMateria = useMemo(() => {
    const mapa = new Map<string, ModuloAudio[]>();
    for (const m of modulos) mapa.set(m.materia, [...(mapa.get(m.materia) ?? []), m]);
    return [...mapa.entries()];
  }, [modulos]);

  function salvarProgresso(modulo: ModuloAudio, segundos: number, concluido: boolean) {
    setProgresso((p) => ({ ...p, [modulo.id]: { moduloId: modulo.id, segundosOuvidos: segundos, concluido } }));
    // Progresso local continua valendo; o servidor sincroniza na próxima.
    conteudoRepository.salvarProgresso(modulo.id, segundos, concluido).catch(() => {});
  }

  function concluir(modulo: ModuloAudio) {
    if (progresso[modulo.id]?.concluido) return;
    salvarProgresso(modulo, modulo.duracaoSegundos, true);
    useAppStore.getState().addLog({ timestamp: Date.now(), type: 'atividade', description: `Pílula de áudio ouvida: ${modulo.titulo}`, xp: 15 });
    useAppStore.getState().setToast('Pílula concluída. +15 XP', 'success');
  }

  /* Progresso e conclusão acompanham o player (a cada 15 s, e no fim). */
  useEffect(() => {
    if (!ativo || !status.isLoaded) return;
    const dur = status.duration || estimarDuracaoSegundos(roteiro);
    if (status.didJustFinish || estaConcluido(status.currentTime, dur)) {
      concluir(ativo);
      return;
    }
    if (status.playing && deveSalvarProgresso(ultimoSalvo.current, Date.now())) {
      ultimoSalvo.current = Date.now();
      salvarProgresso(ativo, Math.floor(status.currentTime), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.currentTime, status.didJustFinish, status.playing]);

  async function abrir(modulo: ModuloAudio) {
    player.pause();
    void Speech.stop();
    setFalando(false);
    setAtivo(modulo);
    setFonte(null);
    setRoteiro('');
    setPreparando(true);
    try {
      const r = await obterRoteiroDaPilula(modulo, apiKey);
      setRoteiro(r.texto);
      setOrigem(r.origem);
      if (r.origem === 'bolso') useAppStore.getState().setToast('Sem conexão com a IA: tocando a versão curta de bolso.', 'info');

      const local = audioBaixado(modulo.id, voz);
      let uri: string | null = local;
      let dataUrl: string | null = null;
      if (!uri && hasProxy() && r.origem !== 'bolso') {
        try {
          dataUrl = (await sintetizarAudio(r.texto, { voz })).url;
          uri = await paraTocar(modulo.id, voz, dataUrl);
        } catch {
          /* sem voz neural: cai na voz do aparelho */
        }
      }
      if (uri) {
        player.replace({ uri });
        player.setActiveForLockScreen(true, { title: modulo.titulo, artist: 'Midnight Mentor', albumTitle: modulo.materia });
        const desde = progresso[modulo.id]?.concluido ? 0 : progresso[modulo.id]?.segundosOuvidos ?? 0;
        if (desde > 5) void player.seekTo(desde);
        setFonte({ uri, dataUrl });
      }
    } catch (e) {
      useAppStore.getState().setToast(e instanceof Error ? e.message : 'Não foi possível preparar esta pílula.', 'error');
    } finally {
      setPreparando(false);
    }
  }

  function tocarOuPausar() {
    if (fonte) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }
    // Plano B: voz do aparelho lendo o roteiro (não toca com a tela apagada no iOS).
    if (falando) {
      void Speech.stop();
      setFalando(false);
      return;
    }
    setFalando(true);
    Speech.speak(roteiro, {
      language: 'pt-BR',
      rate: 1.0,
      onDone: () => {
        setFalando(false);
        if (ativo) concluir(ativo);
      },
      onStopped: () => setFalando(false),
      onError: () => setFalando(false),
    });
  }

  async function alternarBaixado() {
    if (!ativo) return;
    if (audioBaixado(ativo.id, voz)) {
      apagarBaixado(ativo.id, voz);
      setBaixados((n) => n + 1);
      anunciar('Removida do aparelho.');
      return;
    }
    try {
      const dataUrl = fonte?.dataUrl ?? (await sintetizarAudio(roteiro, { voz })).url;
      await baixar(ativo.id, voz, dataUrl);
      setBaixados((n) => n + 1);
      useAppStore.getState().setToast('Pílula baixada: toca sem internet.', 'success');
    } catch {
      useAppStore.getState().setToast('Não deu para baixar agora. Tente com internet.', 'error');
    }
  }

  const duracao = status.duration || (roteiro ? estimarDuracaoSegundos(roteiro) : ativo?.duracaoSegundos ?? 180);
  const tocando = fonte ? status.playing : falando;
  const estaBaixada = ativo ? !!audioBaixado(ativo.id, voz) && baixados >= 0 : false;

  return (
    <Tela cabecalho={{ titulo: 'Pílulas de Áudio', subtitulo: 'Três minutos por tema. Fone no ouvido, tela apagada.', cor: 'violeta', pose: 'acenando', voltar: true }}>
      {ativo ? (
        <Cartao estilo={{ gap: 12 }} destaque={cor.violeta600}>
          <View>
            <Texto variante="rotulo" cor={cor.violeta600}>
              {ativo.materia}
            </Texto>
            <Texto variante="subtitulo">{ativo.titulo}</Texto>
            <Texto variante="legenda">{ativo.resumo}</Texto>
          </View>
          {preparando ? (
            <View style={estilos.preparando}>
              <ActivityIndicator color={cor.violeta600} />
              <Texto negrito>Preparando o áudio desta pílula…</Texto>
            </View>
          ) : (
            <>
              <Barra valor={fonte ? (status.currentTime / Math.max(1, duracao)) * 100 : 0} corBarra={cor.violeta600} rotulo="Progresso da pílula" />
              <View style={estilos.linha}>
                <Texto variante="legenda">{formatarTempo(fonte ? status.currentTime : 0)}</Texto>
                <Texto variante="legenda">{formatarTempo(duracao)}</Texto>
              </View>
              <View style={estilos.controles}>
                <Pressable onPress={() => void player.seekTo(Math.max(0, status.currentTime - 15))} disabled={!fonte} accessibilityRole="button" accessibilityLabel="Voltar 15 segundos" style={estilos.controle}>
                  <Ionicons name="play-back" size={24} color={fonte ? cor.violeta600 : cor.cinza300} />
                </Pressable>
                <Pressable onPress={tocarOuPausar} accessibilityRole="button" accessibilityLabel={tocando ? 'Pausar' : 'Tocar'} style={estilos.play}>
                  <Ionicons name={tocando ? 'pause' : 'play'} size={34} color={cor.branco} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    const v = proximaVelocidade(player.playbackRate);
                    player.setPlaybackRate(v);
                    anunciar(`Velocidade ${String(v).replace('.', ',')} vezes`);
                  }}
                  disabled={!fonte}
                  accessibilityRole="button"
                  accessibilityLabel="Mudar a velocidade"
                  style={estilos.controle}
                >
                  <Texto negrito cor={fonte ? cor.violeta600 : cor.cinza300}>{String(fonte ? player.playbackRate : 1).replace('.', ',')}x</Texto>
                </Pressable>
              </View>
              {!fonte ? (
                <Selo texto="Voz do aparelho: a voz neural precisa de internet" corFundo={cor.ambar100} corTexto={cor.ambar700} />
              ) : null}
              {origem === 'bolso' ? <Texto variante="legenda">Versão curta de bolso: a completa precisa da IA.</Texto> : null}
              <View style={estilos.vozes}>
                {VOZES.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => {
                      setVoz(v.id);
                      setFonte(null);
                      player.pause();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: voz === v.id }}
                    style={[estilos.voz, voz === v.id ? estilos.vozAtiva : null]}
                  >
                    <Texto variante="legenda" negrito cor={voz === v.id ? cor.violeta600 : cor.tinta500}>
                      {v.nome}
                    </Texto>
                  </Pressable>
                ))}
              </View>
              {podeBaixar && (fonte || estaBaixada) ? (
                <Botao
                  titulo={estaBaixada ? 'Remover do aparelho' : 'Baixar para ouvir offline'}
                  icone={estaBaixada ? 'trash-outline' : 'download-outline'}
                  variante="secundario"
                  compacto
                  aoTocar={() => void alternarBaixado()}
                />
              ) : null}
            </>
          )}
        </Cartao>
      ) : null}

      {carregando ? (
        <View style={{ gap: 10 }}>
          <Esqueleto altura={64} />
          <Esqueleto altura={64} />
        </View>
      ) : porMateria.length === 0 ? (
        <Vazio titulo="Nenhuma pílula por aqui ainda." texto="O catálogo vem do servidor. Puxe para atualizar quando tiver internet." />
      ) : (
        porMateria.map(([materia, lista]) => (
          <View key={materia} style={{ gap: 8 }}>
            <Texto variante="rotulo">{materia}</Texto>
            {lista.map((m) => {
              const p = progresso[m.id];
              const baixada = Platform.OS !== 'web' && !!audioBaixado(m.id, voz);
              return (
                <Cartao key={m.id} aoTocar={() => void abrir(m)} rotuloAcessivel={`${m.titulo}${p?.concluido ? ', concluída' : ''}${baixada ? ', baixada' : ''}`} estilo={estilos.item} selecionado={ativo?.id === m.id}>
                  <Ionicons name={p?.concluido ? 'checkmark-circle' : 'headset'} size={24} color={p?.concluido ? cor.esmeralda600 : cor.violeta600} />
                  <View style={{ flex: 1 }}>
                    <Texto negrito>{m.titulo}</Texto>
                    <Texto variante="legenda">{formatarTempo(m.duracaoSegundos)}{baixada ? ' · no aparelho' : ''}</Texto>
                  </View>
                </Cartao>
              );
            })}
          </View>
        ))
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  preparando: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  controles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  controle: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
  play: { width: 72, height: 72, borderRadius: 36, backgroundColor: cor.violeta600, alignItems: 'center', justifyContent: 'center' },
  vozes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  voz: { minHeight: 36, paddingHorizontal: 10, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, justifyContent: 'center' },
  vozAtiva: { borderColor: cor.violeta600, backgroundColor: '#F5F3FF' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
