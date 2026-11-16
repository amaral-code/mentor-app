import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useAppStore } from '@mentor/state/appStore';
import { plataforma } from '@mentor/core/plataforma';
import { SITE_URL } from '../../plataforma';
import { anunciar, useMovimentoReduzido } from '../../ui/acessibilidade';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';

type Fase = 'inspira' | 'segura' | 'expira';
const DURACAO: Record<Fase, number> = { inspira: 4, segura: 7, expira: 8 };
const PROXIMA: Record<Fase, Fase> = { inspira: 'segura', segura: 'expira', expira: 'inspira' };
const NOME: Record<Fase, string> = { inspira: 'Inspire', segura: 'Segure', expira: 'Solte o ar' };
const CICLOS = 4;

/**
 * Apoio em crise, a no máximo DOIS toques de qualquer tela do aluno: o
 * botão "Apoio" do cabeçalho abre isto, e "Ligar 188" já é o segundo.
 *
 * O CVV (188) é a primeira coisa da tela, antes da respiração: quem está
 * mal de verdade não pode ter que rolar para achar o telefone. A ligação
 * é gratuita e funciona 24 horas.
 *
 * O texto desta tela precisa de revisão de um psicólogo da equipe ou
 * parceiro antes de ir para as lojas (#46).
 */
export function OverlayCrise() {
  const aberto = useAppStore((s) => s.showCrisisOverlay);
  const fechar = () => useAppStore.getState().setShowCrisisOverlay(false);
  const reduzido = useMovimentoReduzido();
  const [respirando, setRespirando] = useState(false);
  const [fase, setFase] = useState<Fase>('inspira');
  const [restante, setRestante] = useState(DURACAO.inspira);
  const [ciclo, setCiclo] = useState(1);
  const escala = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!aberto) setRespirando(false);
  }, [aberto]);

  useEffect(() => {
    if (!respirando) return;
    const t = setInterval(() => {
      setRestante((s) => {
        if (s > 1) return s - 1;
        setFase((f) => {
          const nova = PROXIMA[f];
          if (nova === 'inspira') setCiclo((c) => c + 1);
          anunciar(NOME[nova]);
          return nova;
        });
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [respirando]);

  useEffect(() => {
    if (!respirando) return;
    setRestante(DURACAO[fase]);
    if (!reduzido) {
      Animated.timing(escala, { toValue: fase === 'expira' ? 0.7 : 1, duration: DURACAO[fase] * 1000, useNativeDriver: true }).start();
    }
  }, [fase, respirando, reduzido, escala]);

  useEffect(() => {
    if (ciclo > CICLOS) {
      setRespirando(false);
      setCiclo(1);
      anunciar('Respiração concluída.');
    }
  }, [ciclo]);

  function comecarRespiracao() {
    setFase('inspira');
    setCiclo(1);
    setRestante(DURACAO.inspira);
    setRespirando(true);
    anunciar('Inspire');
  }

  return (
    <Modal visible={aberto} animationType="fade" transparent onRequestClose={fechar} accessibilityViewIsModal>
      <View style={estilos.fundo}>
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <Texto variante="titulo" centro accessibilityRole="header">
            Você não está só nessa
          </Texto>
          <Texto centro>Se está difícil agora, fale com alguém. É de graça, sigiloso e funciona 24 horas.</Texto>

          <Botao titulo="Ligar para o CVV, 188" variante="perigo" icone="call" aoTocar={() => void Linking.openURL('tel:188')} dica="Centro de Valorização da Vida, ligação gratuita" />
          <Botao titulo="Conversar pelo chat do CVV" variante="secundario" icone="chatbubble-ellipses-outline" aoTocar={() => void Linking.openURL('https://cvv.org.br')} />
          <Texto variante="legenda" centro>
            Em perigo imediato, ligue 192 (SAMU) ou 190.
          </Texto>

          <View style={estilos.bloco}>
            <Texto variante="subtitulo" centro>
              Respiração 4, 7, 8
            </Texto>
            {respirando ? (
              <View style={{ alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
                <Animated.View style={[estilos.circulo, { transform: [{ scale: reduzido ? 1 : escala }] }]}>
                  <Texto variante="numero" cor={cor.esmeralda700}>
                    {restante}
                  </Texto>
                </Animated.View>
                <Texto variante="subtitulo">{NOME[fase]}</Texto>
                <Texto variante="legenda">
                  Ciclo {Math.min(ciclo, CICLOS)} de {CICLOS}
                </Texto>
                <Botao titulo="Parar" variante="fantasma" compacto aoTocar={() => setRespirando(false)} />
              </View>
            ) : (
              <Botao titulo="Respirar comigo" variante="sucesso" icone="leaf" aoTocar={comecarRespiracao} />
            )}
          </View>

          <View style={estilos.rede}>
            <Texto variante="subtitulo" centro>
              Sua rede de apoio
            </Texto>
            <Texto variante="legenda" centro>
              Mande uma mensagem para quem você confia: seu responsável, um professor ou a psicóloga que acompanha você no app.
            </Texto>
            {SITE_URL ? <Botao titulo="Abrir a Rede de Apoio" variante="secundario" compacto aoTocar={() => plataforma().abrirUrl(SITE_URL)} /> : null}
          </View>

          <Botao titulo="Estou melhor agora" variante="fantasma" aoTocar={fechar} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cor.branco },
  conteudo: { padding: 24, paddingTop: 64, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  bloco: { borderRadius: raio.xl, borderWidth: 2, borderColor: cor.esmeralda500, backgroundColor: cor.esmeralda50, padding: 16, gap: 12 },
  circulo: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  rede: { borderRadius: raio.xl, borderWidth: 2, borderColor: cor.cinza200, backgroundColor: cor.branco, padding: 16, gap: 10 },
});
