import { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { FADIGA_ZERADA } from '@mentor/core/burnoutModel';
import { useAppStore } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { CartaoFadiga } from '../../src/features/central/CartaoFadiga';
import { Botao } from '../../src/ui/Botao';
import { Cartao } from '../../src/ui/Cartao';
import { Tela } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor } from '../../src/ui/tema';

function semanaCurta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/**
 * Bem-estar: índice de cansaço, relatório da semana, pausas e o caminho
 * para pedir ajuda. O CVV aparece aqui sempre, não só quando o índice
 * sobe: quem precisa nem sempre tem o número alto.
 */
export default function BemEstar() {
  const relatorios = useBemEstarStore((s) => s.relatorios);
  const previsao = useBemEstarStore((s) => s.previsao);
  const carregado = useBemEstarStore((s) => s.carregado);

  useEffect(() => {
    if (!carregado) void useBemEstarStore.getState().carregarTudo();
  }, [carregado]);

  return (
    <Tela cabecalho={{ titulo: 'Bem-estar', subtitulo: 'Estudar bem também é descansar', cor: 'esmeralda', pose: 'meditando', voltar: true }} aoAtualizar={() => void useBemEstarStore.getState().carregarTudo()}>
      {FADIGA_ZERADA ? (
        <Cartao>
          <Texto>O índice de cansaço está desligado no momento.</Texto>
        </Cartao>
      ) : previsao ? (
        <CartaoFadiga />
      ) : (
        <Cartao>
          <Texto variante="legenda">O índice de cansaço aparece depois de algumas respostas no quiz: com três toques seria chute.</Texto>
        </Cartao>
      )}

      <Cartao estilo={{ gap: 10 }}>
        <Texto variante="subtitulo">Pausas que funcionam</Texto>
        <Botao titulo="Respiração guiada" variante="sucesso" icone="leaf" aoTocar={() => useAppStore.getState().setShowCrisisOverlay(true)} />
        <Botao titulo="Ouvir uma pílula de 3 min" variante="secundario" icone="headset" aoTocar={() => router.push('/audio')} />
        <Botao titulo="Ativar o escudo e largar o celular" variante="secundario" icone="shield-checkmark" aoTocar={() => router.push('/foco')} />
      </Cartao>

      <Cartao estilo={{ gap: 8 }}>
        <Texto variante="subtitulo">Relatório da semana</Texto>
        <Texto variante="legenda">Sai toda sexta. Não mede acertos: mede o que sustentou a sua semana.</Texto>
        <Botao titulo="Abrir o relatório desta semana" variante="secundario" icone="document-text-outline" aoTocar={() => useAppStore.getState().setShowWeeklyReport(true)} />
        {relatorios.slice(0, 4).map((r) => (
          <View key={r.semanaInicio} style={{ paddingVertical: 4 }}>
            <Texto variante="legenda" negrito>
              Semana de {semanaCurta(r.semanaInicio)}
            </Texto>
            <Texto variante="legenda" numberOfLines={2}>
              {r.textoGerado}
            </Texto>
          </View>
        ))}
      </Cartao>

      <Cartao destaque={cor.vermelho500} estilo={{ gap: 8 }}>
        <Texto variante="subtitulo">Se estiver difícil</Texto>
        <Texto>O CVV atende de graça, 24 horas, pelo 188. Falar ajuda.</Texto>
        <Botao titulo="Ligar 188" variante="perigo" icone="call" aoTocar={() => void Linking.openURL('tel:188')} />
      </Cartao>
    </Tela>
  );
}
