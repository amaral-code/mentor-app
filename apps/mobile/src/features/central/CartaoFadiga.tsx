import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COR_CLASSE, FADIGA_ZERADA, ROTULO_CLASSE, sugestaoPausa } from '@mentor/core/burnoutModel';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { Barra } from '../../ui/Basicos';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { GraficoBarras } from '../../ui/Graficos';
import { Texto } from '../../ui/Texto';
import { cor } from '../../ui/tema';

/**
 * Índice de fadiga (o BurnoutCard do web).
 *
 * Mostra o SCORE e os motivos, nunca um diagnóstico. Com menos de 5
 * respostas na janela o card não aparece (previsão nula): classificar
 * cansaço com três toques seria chute com cara de medida. Desligado por
 * `FADIGA_ZERADA`, também some: "0/100" afirmaria algo que o app não mede.
 */
export function CartaoFadiga() {
  const previsao = useBemEstarStore((s) => s.previsao);
  const historico = useBemEstarStore((s) => s.historicoBurnout);
  const denso = useBemEstarStore((s) => s.conteudoDensoBloqueado);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(t);
  }, [confirmando]);

  if (FADIGA_ZERADA || !previsao) return null;
  const corClasse = COR_CLASSE[previsao.classe];
  const serie = historico.slice(-14);

  function reiniciar() {
    if (!confirmando) return setConfirmando(true);
    setConfirmando(false);
    void useBemEstarStore.getState().reiniciarIndice();
  }

  return (
    <Cartao estilo={{ gap: 10 }}>
      <View style={estilos.topo}>
        <View style={[estilos.icone, { backgroundColor: `${corClasse}1A` }]}>
          <Ionicons name="pulse" size={20} color={corClasse} />
        </View>
        <View style={{ flex: 1 }}>
          <Texto negrito>Índice de fadiga</Texto>
          <Texto variante="legenda">Calculado com as suas últimas respostas e horários</Texto>
        </View>
        <Texto variante="numero" cor={corClasse} accessibilityLabel={`${previsao.score} de 100`}>
          {previsao.score}
        </Texto>
      </View>
      <Barra valor={previsao.score} corBarra={corClasse} rotulo="Índice de fadiga" />
      <Texto negrito cor={corClasse}>
        {ROTULO_CLASSE[previsao.classe]}
      </Texto>
      {previsao.motivos.length > 0 ? <Texto variante="legenda">O que pesou: {previsao.motivos.join(' e ')}.</Texto> : null}
      {serie.length > 1 ? (
        <GraficoBarras
          altura={48}
          maximo={100}
          mostrarRotulos={false}
          barras={serie.map((d) => ({ rotulo: d.data, valor: d.score, cor: COR_CLASSE[d.classe] }))}
          resumo={`Índice dos últimos ${serie.length} dias, de ${serie[0].score} a ${serie[serie.length - 1].score}`}
        />
      ) : null}
      {denso ? (
        <View style={estilos.pausa}>
          <Texto negrito cor={cor.laranja600}>
            Conteúdo denso pausado
          </Texto>
          <Texto variante="legenda" cor={cor.laranja600}>
            {sugestaoPausa(previsao.classe).texto}
          </Texto>
          <View style={estilos.acoes}>
            <Botao titulo="Ouvir 3 min" variante="secundario" compacto icone="headset" aoTocar={() => router.push('/audio')} />
            <Botao titulo="Ativar escudo" variante="fantasma" compacto aoTocar={() => router.push('/foco')} />
          </View>
        </View>
      ) : null}
      <Botao
        titulo={confirmando ? 'Toque de novo para zerar' : 'Reiniciar índice'}
        variante={confirmando ? 'perigo' : 'fantasma'}
        compacto
        icone="refresh"
        aoTocar={reiniciar}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pausa: { borderRadius: 14, borderWidth: 2, borderColor: '#FED7AA', backgroundColor: '#FFF7ED', padding: 12, gap: 6 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
