import { StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userRepository } from '@mentor/api/UserRepository';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../../../src/ui/Botao';
import { Cartao } from '../../../src/ui/Cartao';
import { Tela } from '../../../src/ui/Tela';
import { Texto } from '../../../src/ui/Texto';
import { cor } from '../../../src/ui/tema';

type NomeIcone = keyof typeof Ionicons.glyphMap;

const SECOES: { rota: Href; titulo: string; texto: string; icone: NomeIcone; cor: string }[] = [
  { rota: '/redacao', titulo: 'Redação', texto: 'Fotografe a folha e receba a correção nas 5 competências', icone: 'camera', cor: cor.violeta600 },
  { rota: '/revisoes', titulo: 'Revisões', texto: 'Calendário da revisão espaçada e o que revisar hoje', icone: 'calendar', cor: cor.ceu600 },
  { rota: '/flashcards', titulo: 'Flashcards', texto: 'Cartões do caderno, arraste para o lado', icone: 'albums', cor: cor.esmeralda600 },
  { rota: '/caderno', titulo: 'Caderno', texto: 'Anotações, mapa mental e cartões gerados', icone: 'book', cor: cor.azul600 },
  { rota: '/foco', titulo: 'Modo Foco', texto: 'Pomodoro e Escudo de Dopamina', icone: 'timer', cor: cor.ambar600 },
  { rota: '/audio', titulo: 'Pílulas de áudio', texto: 'Três minutos de revisão para ouvir', icone: 'headset', cor: cor.laranja600 },
  { rota: '/ranking', titulo: 'Ranking', texto: 'Sua posição na turma, na escola e no geral', icone: 'podium', cor: cor.ambar600 },
  { rota: '/bem-estar', titulo: 'Bem-estar', texto: 'Índice de cansaço e relatório da semana', icone: 'leaf', cor: cor.esmeralda600 },
  { rota: '/loja', titulo: 'Loja do Sagui', texto: 'Troque moedas de foco por itens', icone: 'storefront', cor: cor.violeta600 },
];

export default function Mais() {
  const nome = useAppStore((s) => s.session?.nome ?? '');
  return (
    <Tela cabecalho={{ titulo: 'Mais', subtitulo: nome ? `Conta de ${nome}` : undefined, cor: 'azul', pose: 'aprovacao' }}>
      <View style={estilos.grade}>
        {SECOES.map((s) => (
          <Cartao key={s.titulo} aoTocar={() => router.push(s.rota)} rotuloAcessivel={`${s.titulo}. ${s.texto}`} estilo={estilos.item}>
            <View style={[estilos.icone, { backgroundColor: s.cor }]}>
              <Ionicons name={s.icone} size={22} color={cor.branco} />
            </View>
            <View style={{ flex: 1 }}>
              <Texto variante="subtitulo">{s.titulo}</Texto>
              <Texto variante="legenda">{s.texto}</Texto>
            </View>
            <Ionicons name="chevron-forward" size={20} color={cor.cinza400} />
          </Cartao>
        ))}
      </View>
      <Botao titulo="Sair da conta" variante="secundario" icone="log-out-outline" aoTocar={() => void sair()} />
    </Tela>
  );
}

/** Sair limpa a sessão do cofre (Supabase) e o estado em memória. */
async function sair() {
  await userRepository.logout();
  useAppStore.getState().logout();
}

const estilos = StyleSheet.create({
  grade: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
