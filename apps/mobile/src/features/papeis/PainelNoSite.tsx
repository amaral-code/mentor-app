import { Image, StyleSheet, View } from 'react-native';
import { userRepository } from '@mentor/api/UserRepository';
import { plataforma } from '@mentor/core/plataforma';
import { useAppStore } from '@mentor/state/appStore';
import { SITE_URL } from '../../plataforma';
import { sairDaConta } from '../../sessao/sair';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { BotaoApoio } from '../../ui/BotaoApoio';
import { imagemSagui, type PoseSagui } from '../../ui/sagui';
import { Texto } from '../../ui/Texto';
import { cor } from '../../ui/tema';

interface Props {
  titulo: string;
  texto: string;
  /** O que o painel completo faz, para a pessoa saber o que vai achar lá. */
  itens: string[];
  pose?: PoseSagui;
}

/**
 * Tela de entrada de um papel que ainda não tem painel nativo.
 *
 * Os painéis de família, professor, secretaria e psicólogo são do M6. Até
 * lá cada papel tem a SUA rota (URL própria, guarda própria) e esta tela
 * leva ao painel completo no site, em vez de abrir a área do aluno, que o
 * papel não pode usar.
 */
export function PainelNoSite({ titulo, texto, itens, pose = 'aprovacao' }: Props) {
  const nome = useAppStore((s) => s.session?.nome?.split(' ')[0] ?? '');
  return (
    <View style={estilos.centro}>
      <View style={{ alignSelf: 'flex-end' }}>
        <BotaoApoio />
      </View>
      <Image source={imagemSagui(pose)} style={estilos.sagui} accessible={false} />
      <Texto variante="titulo" centro accessibilityRole="header">
        {nome ? `${nome}, ${titulo.toLowerCase()}` : titulo}
      </Texto>
      <Texto centro cor={cor.tinta500}>
        {texto}
      </Texto>
      <Cartao estilo={{ gap: 6 }}>
        <Texto variante="rotulo">No painel completo</Texto>
        {itens.map((i) => (
          <Texto key={i}>• {i}</Texto>
        ))}
      </Cartao>
      {SITE_URL ? <Botao titulo="Abrir o painel" icone="open-outline" aoTocar={() => plataforma().abrirUrl(SITE_URL)} /> : null}
      <Botao titulo="Sair" variante="secundario" aoTocar={() => void sairDaConta(() => userRepository.logout())} />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14, maxWidth: 520, alignSelf: 'center', width: '100%' },
  sagui: { width: 110, height: 110, alignSelf: 'center', resizeMode: 'contain' },
});
