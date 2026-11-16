import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { normalizeStudyLeague, toggleGoalCompletion, type StudyLeague } from '@mentor/core/ligasEngine';
import { useAppStore, persistir } from '@mentor/state/appStore';
import { ChatAoVivo } from '../../../src/features/ligas/ChatAoVivo';
import { Selo } from '../../../src/ui/Basicos';
import { Cartao } from '../../../src/ui/Cartao';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';
import { cor } from '../../../src/ui/tema';

/**
 * Uma liga (metas e chat ao vivo) ou, com id "turma", o mural da turma.
 * O chat é o mesmo componente: só muda a tabela e o filtro do Realtime.
 */
export default function Liga() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const turmaId = useAppStore((s) => s.session?.turmaId ?? null);
  const uid = useAppStore((s) => s.session?.uid ?? '');
  const ehTurma = id === 'turma';
  const [liga, setLiga] = useState<StudyLeague | null>(null);

  useEffect(() => {
    if (ehTurma) return;
    void supabaseRepository.loadLigas().then((brutas) => {
      const b = brutas.find((x) => String(x.id) === id);
      if (!b) return;
      setLiga(
        normalizeStudyLeague({
          ...(b as Partial<StudyLeague>),
          id: String(b.id),
          title: String(b.title ?? 'Liga'),
          prompt: String((b as { prompt?: string }).prompt ?? ''),
          authorName: String((b as { authorName?: string }).authorName ?? ''),
          turma: '',
          escola: '',
          xpReward: Number(b.xpReward ?? 0),
        }),
      );
    });
  }, [id, ehTurma]);

  function alternarMeta(metaId: string) {
    if (!liga || !uid) return;
    const anterior = liga;
    const nova = toggleGoalCompletion(liga, metaId, uid);
    setLiga(nova);
    persistir(supabaseRepository.atualizarLiga(liga.id, nova as unknown as Record<string, unknown>), {
      aoFalhar: () => setLiga(anterior),
      mensagem: 'Não foi possível marcar a meta.',
    });
  }

  if (ehTurma) {
    return (
      <Tela cabecalho={{ titulo: 'Mural da turma', subtitulo: 'Dúvidas e combinados com a sua turma', cor: 'ceu', pose: 'acenando', voltar: true }}>
        {turmaId ? (
          <ChatAoVivo origem="turma" alvoId={turmaId} />
        ) : (
          <Cartao>
            <Texto>Você ainda não está numa turma. Entre com o código que o professor passar, no Perfil do site.</Texto>
          </Cartao>
        )}
      </Tela>
    );
  }

  return (
    <Tela cabecalho={{ titulo: liga?.title ?? 'Liga', subtitulo: liga?.prompt || undefined, cor: 'esmeralda', pose: 'pulando', voltar: true }}>
      {liga ? (
        <Cartao estilo={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Selo texto={liga.discipline} />
            {liga.inviteCode ? <Selo texto={`código ${liga.inviteCode}`} corFundo={cor.ambar100} corTexto={cor.ambar700} /> : null}
          </View>
          <Texto variante="subtitulo">Metas da equipe</Texto>
          {liga.goals.length === 0 ? <Texto variante="legenda">Combinem a primeira meta no chat.</Texto> : null}
          {liga.goals.map((g) => {
            const feita = !!g.completedBy?.includes(uid);
            return (
              <Pressable
                key={g.id}
                onPress={() => alternarMeta(g.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: feita }}
                accessibilityLabel={`${g.title}. ${g.description}`}
                style={estilos.meta}
              >
                <Ionicons name={feita ? 'checkbox' : 'square-outline'} size={24} color={feita ? cor.esmeralda600 : cor.tinta500} />
                <View style={{ flex: 1 }}>
                  <Texto negrito>{g.title}</Texto>
                  <Texto variante="legenda">
                    {g.description} · {g.completedBy?.length ?? 0} {g.completedBy?.length === 1 ? 'concluiu' : 'concluíram'}
                  </Texto>
                </View>
              </Pressable>
            );
          })}
        </Cartao>
      ) : null}
      <Texto variante="subtitulo">Chat da liga</Texto>
      {id ? <ChatAoVivo origem="liga" alvoId={id} /> : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
});
