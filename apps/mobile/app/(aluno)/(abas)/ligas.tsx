import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { chatLigaRepository } from '@mentor/api/ChatLigaRepository';
import { createStudyLeague, normalizeStudyLeague, type StudyLeague } from '@mentor/core/ligasEngine';
import { MATERIAS_COMUNIDADE, moderar } from '@mentor/core/moderationEngine';
import { useAppStore, persistir } from '@mentor/state/appStore';
import { Campo, Esqueleto, Selo, Vazio } from '../../../src/ui/Basicos';
import { Botao } from '../../../src/ui/Botao';
import { Cartao } from '../../../src/ui/Cartao';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';
import { cor, raio } from '../../../src/ui/tema';

/** Teto do web: duas ligas por aluno. */
const MAXIMO_LIGAS = 2;

/**
 * Ligas: as do aluno, as abertas da escola, entrar por código e criar.
 * Mural da turma e ranking ficam a um toque daqui.
 */
export default function Ligas() {
  const sessao = useAppStore((s) => s.session);
  const [ligas, setLigas] = useState<StudyLeague[]>([]);
  const [minhas, setMinhas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [entrandoCodigo, setEntrandoCodigo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [disciplina, setDisciplina] = useState('Geral');

  const carregar = useCallback(async () => {
    const [brutas, ids] = await Promise.all([supabaseRepository.loadLigas(), chatLigaRepository.minhasLigas()]);
    setLigas(
      brutas.map((b) =>
        normalizeStudyLeague({
          ...(b as Partial<StudyLeague>),
          id: String(b.id),
          title: String(b.title ?? 'Liga'),
          prompt: String((b as { prompt?: string }).prompt ?? ''),
          authorName: String((b as { authorName?: string }).authorName ?? ''),
          turma: String((b as { turma?: string }).turma ?? ''),
          escola: String((b as { escola?: string }).escola ?? ''),
          xpReward: Number(b.xpReward ?? 0),
        }),
      ),
    );
    setMinhas(ids);
  }, []);

  useEffect(() => {
    void carregar().finally(() => setCarregando(false));
  }, [carregar]);

  async function atualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  async function entrarPorCodigo() {
    if (!codigo.trim()) return;
    setEntrandoCodigo(true);
    try {
      const id = await chatLigaRepository.entrarPorCodigo(codigo);
      setCodigo('');
      await carregar();
      router.push({ pathname: '/liga/[id]', params: { id } });
    } catch (e) {
      useAppStore.getState().setToast(e instanceof Error ? e.message : 'Código não encontrado.', 'error');
    } finally {
      setEntrandoCodigo(false);
    }
  }

  function entrar(liga: StudyLeague) {
    if (minhas.length >= MAXIMO_LIGAS) {
      useAppStore.getState().setToast('Você já está em 2 ligas. Saia de uma para entrar em outra.', 'error');
      return;
    }
    const antes = minhas;
    setMinhas([...minhas, liga.id]);
    persistir(supabaseRepository.entrarNaLiga(liga.id), {
      aoFalhar: () => setMinhas(antes),
      mensagem: 'Não foi possível entrar na liga. Tente de novo.',
    });
    const app = useAppStore.getState();
    app.addXP(liga.xpReward);
    app.addLog({ timestamp: Date.now(), type: 'atividade', description: `Entrou na liga "${liga.title}"`, xp: liga.xpReward });
    router.push({ pathname: '/liga/[id]', params: { id: liga.id } });
  }

  async function criar() {
    const nome = titulo.trim().slice(0, 60);
    if (!nome || criando) return;
    if (!moderar(nome).aprovado) {
      useAppStore.getState().setToast('Escolha outro nome para a liga.', 'error');
      return;
    }
    setCriando(true);
    try {
      const rascunho = createStudyLeague({
        id: `tmp_${Date.now()}`,
        title: nome,
        prompt: 'Liga criada pelos estudantes: definam a primeira meta juntos no chat.',
        authorName: sessao?.nome ?? 'Estudante',
        turma: '',
        escola: '',
        discipline: disciplina,
        xpReward: 35,
        goals: [{ id: `g${Date.now()}`, title: 'Definir a primeira meta', description: 'Combinem no chat o primeiro desafio da equipe', target: 1, unit: 'meta' }],
      });
      const id = await supabaseRepository.saveLiga(rascunho as unknown as Record<string, unknown>);
      if (!id) throw new Error('sem retorno do banco');
      await supabaseRepository.entrarNaLiga(id);
      setTitulo('');
      await carregar();
      router.push({ pathname: '/liga/[id]', params: { id } });
    } catch {
      useAppStore.getState().setToast('Não foi possível criar a liga agora.', 'error');
    } finally {
      setCriando(false);
    }
  }

  const minhasLigas = ligas.filter((l) => minhas.includes(l.id));
  const abertas = ligas.filter((l) => !minhas.includes(l.id) && !l.private);

  return (
    <Tela cabecalho={{ titulo: 'Ligas', subtitulo: 'Estude junto: metas, chat e ranking', cor: 'esmeralda', pose: 'pulando' }} aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      <View style={estilos.atalhos}>
        <Cartao aoTocar={() => router.push('/ranking')} rotuloAcessivel="Abrir o ranking" estilo={estilos.atalho}>
          <Ionicons name="podium" size={26} color={cor.ambar600} />
          <Texto negrito>Ranking</Texto>
        </Cartao>
        <Cartao aoTocar={() => router.push({ pathname: '/liga/[id]', params: { id: 'turma' } })} rotuloAcessivel="Abrir o mural da turma" estilo={estilos.atalho}>
          <Ionicons name="people" size={26} color={cor.ceu600} />
          <Texto negrito>Mural da turma</Texto>
        </Cartao>
      </View>

      <Cartao estilo={{ gap: 10 }}>
        <Texto variante="subtitulo">Entrar com código</Texto>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <Campo rotulo="Código da liga" value={codigo} onChangeText={(t) => setCodigo(t.toUpperCase())} autoCapitalize="characters" placeholder="EXA123" estilo={{ flex: 1 }} />
          <Botao titulo="Entrar" aoTocar={() => void entrarPorCodigo()} carregando={entrandoCodigo} desabilitado={!codigo.trim()} />
        </View>
        <Texto variante="legenda">Liga privada só aparece para quem tem o código.</Texto>
      </Cartao>

      <Texto variante="rotulo">Minhas ligas</Texto>
      {carregando ? (
        <Esqueleto altura={80} />
      ) : minhasLigas.length === 0 ? (
        <Vazio titulo="Você ainda não está em nenhuma liga." texto="Entre numa aberta ou crie a sua com os colegas." pose="acenando" />
      ) : (
        minhasLigas.map((l) => (
          <Cartao key={l.id} aoTocar={() => router.push({ pathname: '/liga/[id]', params: { id: l.id } })} rotuloAcessivel={`Abrir a liga ${l.title}`} estilo={estilos.liga}>
            <View style={{ flex: 1, gap: 4 }}>
              <Texto variante="subtitulo">{l.title}</Texto>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Selo texto={l.discipline} />
                {l.inviteCode ? <Selo texto={`código ${l.inviteCode}`} corFundo={cor.ambar100} corTexto={cor.ambar700} /> : null}
              </View>
            </View>
            <Ionicons name="chatbubbles" size={22} color={cor.esmeralda600} />
          </Cartao>
        ))
      )}

      {abertas.length > 0 ? <Texto variante="rotulo">Abertas na sua escola</Texto> : null}
      {abertas.map((l) => (
        <Cartao key={l.id} estilo={estilos.liga}>
          <View style={{ flex: 1, gap: 4 }}>
            <Texto negrito>{l.title}</Texto>
            <Texto variante="legenda">
              {l.discipline} · +{l.xpReward} XP ao entrar
            </Texto>
          </View>
          <Botao titulo="Entrar" compacto variante="sucesso" aoTocar={() => entrar(l)} rotuloAcessivel={`Entrar na liga ${l.title}`} />
        </Cartao>
      ))}

      <Cartao estilo={{ gap: 10 }}>
        <Texto variante="subtitulo">Criar uma liga</Texto>
        <Campo rotulo="Nome da liga" value={titulo} onChangeText={setTitulo} placeholder="Ex.: Exatas da noite" maxLength={60} />
        <View style={estilos.chips}>
          {MATERIAS_COMUNIDADE.map((m) => (
            <Pressable key={m} onPress={() => setDisciplina(m)} accessibilityRole="radio" accessibilityState={{ checked: disciplina === m }} style={[estilos.chip, disciplina === m ? estilos.chipAtivo : null]}>
              <Texto variante="legenda" negrito cor={disciplina === m ? cor.esmeralda700 : cor.tinta700}>
                {m}
              </Texto>
            </Pressable>
          ))}
        </View>
        <Botao titulo="Criar liga" variante="sucesso" icone="add" aoTocar={() => void criar()} carregando={criando} desabilitado={!titulo.trim()} />
      </Cartao>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  atalhos: { flexDirection: 'row', gap: 10 },
  atalho: { flex: 1, alignItems: 'center', gap: 6 },
  liga: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 10, borderRadius: raio.pilula, borderWidth: 2, borderColor: cor.cinza200, justifyContent: 'center' },
  chipAtivo: { borderColor: cor.esmeralda500, backgroundColor: cor.esmeralda50 },
});
