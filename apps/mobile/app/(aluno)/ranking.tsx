import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { carregarPaginaRanking } from '@mentor/api/rankingEngine';
import type { RankingEntry, RankingFilter } from '@mentor/core/types';
import { useAppStore } from '@mentor/state/appStore';
import { Vazio } from '../../src/ui/Basicos';
import { Cabecalho } from '../../src/ui/Tela';
import { Texto } from '../../src/ui/Texto';
import { cor, raio } from '../../src/ui/tema';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ESCOPOS: { id: RankingFilter; rotulo: string }[] = [
  { id: 'turma', rotulo: 'Turma' },
  { id: 'escola', rotulo: 'Escola' },
  { id: 'geral', rotulo: 'Geral' },
];
const MEDALHA = [cor.ambar500, cor.cinza400, '#B87333'];

function Linha({ e }: { e: RankingEntry }) {
  return (
    <View
      style={[estilos.linha, e.destaque ? estilos.eu : null]}
      accessible
      accessibilityLabel={`${e.posicao}º lugar: ${e.nome}, ${e.xp} XP, nível ${e.level}${e.destaque ? ', é você' : ''}`}
    >
      <View style={[estilos.posicao, e.posicao <= 3 ? { backgroundColor: MEDALHA[e.posicao - 1] } : null]}>
        <Texto negrito cor={e.posicao <= 3 ? cor.branco : cor.tinta700}>
          {e.posicao}
        </Texto>
      </View>
      <View style={{ flex: 1 }}>
        <Texto negrito numberOfLines={1}>
          {e.nome}
        </Texto>
        <Texto variante="legenda">
          Nível {e.level} · ofensiva de {e.streak}
        </Texto>
      </View>
      <Texto negrito cor={cor.ambar700}>
        {e.xp} XP
      </Texto>
    </View>
  );
}

/**
 * Ranking por turma, escola ou geral, paginado (20 por vez, a próxima
 * página chega ao rolar até o fim). Colegas aparecem por apelido: o
 * ranking não precisa do nome real de ninguém para funcionar.
 */
export default function Ranking() {
  const sessao = useAppStore((s) => s.session);
  const insets = useSafeAreaInsets();
  const [escopo, setEscopo] = useState<RankingFilter>(sessao?.turmaId ? 'turma' : 'geral');
  const [entradas, setEntradas] = useState<RankingEntry[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);
  const [carregando, setCarregando] = useState(false);

  const perfil = { uid: sessao?.uid ?? '', nome: sessao?.nome, escolaId: sessao?.escolaId, turmaId: sessao?.turmaId };

  const carregar = useCallback(
    async (p: number, e: RankingFilter) => {
      setCarregando(true);
      const r = await carregarPaginaRanking(e, perfil, p);
      setEntradas((atual) => (p === 0 ? r.entradas : [...atual, ...r.entradas]));
      setTemMais(r.temMais);
      setPagina(p);
      setCarregando(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessao?.uid, sessao?.turmaId, sessao?.escolaId],
  );

  useEffect(() => {
    void carregar(0, escopo);
  }, [escopo, carregar]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: cor.branco }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16, gap: 8, maxWidth: 760, width: '100%', alignSelf: 'center' }}
      data={entradas}
      keyExtractor={(e) => `${e.posicao}-${e.nome}`}
      renderItem={({ item }) => <Linha e={item} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (temMais && !carregando) void carregar(pagina + 1, escopo);
      }}
      onRefresh={() => void carregar(0, escopo)}
      refreshing={carregando && pagina === 0}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Cabecalho titulo="Ranking" subtitulo="Quem mais estudou, por XP" cor="ambar" pose="aprovacao" voltar />
          <View style={estilos.escopos} accessibilityRole="tablist">
            {ESCOPOS.map((x) => (
              <Pressable key={x.id} onPress={() => setEscopo(x.id)} accessibilityRole="tab" accessibilityState={{ selected: escopo === x.id }} style={[estilos.escopo, escopo === x.id ? estilos.escopoAtivo : null]}>
                <Texto negrito cor={escopo === x.id ? cor.branco : cor.tinta700}>
                  {x.rotulo}
                </Texto>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={carregando ? undefined : <Vazio titulo="Ninguém pontuou neste ranking ainda." texto="Faça um quiz e apareça aqui primeiro." pose="aprovacao" />}
      ListFooterComponent={carregando && pagina > 0 ? <ActivityIndicator color={cor.ambar600} style={{ marginVertical: 12 }} /> : undefined}
    />
  );
}

const estilos = StyleSheet.create({
  escopos: { flexDirection: 'row', gap: 8 },
  escopo: { flex: 1, minHeight: 44, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, alignItems: 'center', justifyContent: 'center' },
  escopoAtivo: { backgroundColor: cor.ambar600, borderColor: cor.ambar600 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: raio.md, borderWidth: 2, borderColor: cor.cinza100 },
  eu: { borderColor: cor.ambar500, backgroundColor: cor.ambar50 },
  posicao: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: cor.cinza100 },
});
