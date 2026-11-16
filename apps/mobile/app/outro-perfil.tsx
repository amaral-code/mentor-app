import { Image, StyleSheet, View } from 'react-native';
import { userRepository } from '@mentor/api/UserRepository';
import { plataforma } from '@mentor/core/plataforma';
import { useAppStore } from '@mentor/state/appStore';
import { SITE_URL } from '../src/plataforma';
import { Botao } from '../src/ui/Botao';
import { imagemSagui } from '../src/ui/sagui';
import { Texto } from '../src/ui/Texto';
import { cor } from '../src/ui/tema';

const NOME_PAPEL: Record<string, string> = {
  parent: 'responsável',
  teacher: 'professor',
  educator: 'secretaria',
  psychologist: 'psicólogo',
  admin: 'administração',
};

/**
 * Responsável, professor, secretaria e psicólogo ainda não têm tela no
 * app nativo: os painéis são do M6. Em vez de abrir a área do aluno (que
 * o papel não pode usar), a conta é mandada para o site, onde o painel
 * dela existe.
 */
export default function OutroPerfil() {
  const papel = useAppStore((s) => s.userRole);
  return (
    <View style={estilos.centro}>
      <Image source={imagemSagui('aprovacao')} style={estilos.sagui} accessible={false} />
      <Texto variante="titulo" centro accessibilityRole="header">
        Seu painel fica no site
      </Texto>
      <Texto centro cor={cor.tinta500}>
        Esta conta é de {NOME_PAPEL[papel] ?? papel}. O app do celular, por enquanto, é a área do estudante. Abra o
        painel completo no navegador.
      </Texto>
      {SITE_URL ? <Botao titulo="Abrir o painel" icone="open-outline" aoTocar={() => plataforma().abrirUrl(SITE_URL)} /> : null}
      <Botao titulo="Sair" variante="secundario" aoTocar={() => void userRepository.logout()} />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', padding: 24, gap: 14, maxWidth: 480, alignSelf: 'center', width: '100%' },
  sagui: { width: 120, height: 120, alignSelf: 'center', resizeMode: 'contain' },
});
