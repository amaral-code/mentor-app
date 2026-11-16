import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { calcularMetricas, destaquesDaSemana, inicioDaSemana } from '@mentor/core/decompressionReport';
import { useAppStore } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { textoDoRelatorioDaSemana } from '@mentor/state/relatorioSemanal';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { cor, raio } from '../../ui/tema';
import { TextoRico } from '../mentor/TextoRico';

/**
 * Relatório de descompressão de sexta: não mede acertos, mede o que
 * sustentou a semana (sono, tempo longe da tela, dias de estudo). Abre
 * sozinho uma vez por semana (efeito no layout do aluno) e também pela
 * tela de Bem-estar.
 */
export function RelatorioSemanal() {
  const fechar = () => useAppStore.getState().setShowWeeklyReport(false);
  const logs = useAppStore((s) => s.logs);
  const quizzes = useAppStore((s) => s.quizResults);
  const ofensiva = useAppStore((s) => s.gamification.streak);
  const sono = useAppStore((s) => s.sono);
  const apiKey = useAppStore((s) => s.apiKey);
  const nome = useAppStore((s) => s.session?.nome?.split(' ')[0]);
  const sessoesOffline = useBemEstarStore((s) => s.sessoesOffline);
  const revisoes = useBemEstarStore((s) => s.revisoes);
  const [sessoesFoco, setSessoesFoco] = useState<{ tipo: string; minutos: number; data: string }[]>([]);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    // Sem o histórico de pomodoro o relatório sai do mesmo jeito, só sem essa linha.
    void supabaseRepository.loadSessoesFoco().then(setSessoesFoco).catch(() => {});
  }, []);

  const metricas = useMemo(
    () =>
      calcularMetricas({
        logs,
        sessoesOffline,
        sessoesFoco,
        quizzes,
        registrosSono: [sono],
        streak: ofensiva,
        revisoesEmDia: revisoes.filter((r) => r.ultimaRevisao && r.ultimaRevisao >= inicioDaSemana()).length,
      }),
    [logs, sessoesOffline, sessoesFoco, quizzes, sono, ofensiva, revisoes],
  );

  // Um texto por abertura: as métricas mudam quando o foco chega, e cada
  // mudança pediria outro parágrafo à IA para a mesma semana.
  useEffect(() => {
    let vivo = true;
    void textoDoRelatorioDaSemana(metricas, apiKey, nome).then((t) => vivo && setTexto(t));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible animationType="slide" onRequestClose={fechar}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Texto variante="rotulo" cor={cor.violeta600}>
          Relatório de descompressão
        </Texto>
        <Texto variante="titulo" accessibilityRole="header">
          Sua semana
        </Texto>
        <View style={estilos.grade}>
          {destaquesDaSemana(metricas).map((d) => (
            <Cartao key={d.rotulo} estilo={estilos.destaque}>
              <Texto variante="legenda">{d.rotulo}</Texto>
              <Texto variante="subtitulo">{d.valor}</Texto>
              <Texto variante="legenda">{d.nota}</Texto>
            </Cartao>
          ))}
        </View>
        <Cartao estilo={{ gap: 8 }}>
          {texto ? (
            <TextoRico texto={texto} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <ActivityIndicator color={cor.violeta600} />
              <Texto>Escrevendo o seu resumo da semana…</Texto>
            </View>
          )}
        </Cartao>
        <Texto variante="legenda">Este relatório não mede acertos. Ele registra o que sustentou a sua semana.</Texto>
        <Botao titulo="Fechar" variante="secundario" aoTocar={fechar} />
      </ScrollView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 20, paddingTop: 56, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  destaque: { flexGrow: 1, flexBasis: '45%', gap: 2, borderRadius: raio.lg },
});
