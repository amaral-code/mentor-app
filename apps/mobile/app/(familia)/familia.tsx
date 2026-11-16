import { ScrollView } from 'react-native';
import { PainelNoSite } from '../../src/features/papeis/PainelNoSite';

/** Rota de entrada do papel parent (o painel nativo é do M6). */
export default function Painel() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <PainelNoSite
        titulo="Seu painel de família"
        texto="Acompanhe o estudo de quem você cuida pelo painel completo, no navegador."
        itens={['Estudo da semana: minutos, acertos e matérias', 'Bem-estar e o acesso do psicólogo, quando você autoriza', 'Entrar com o código que o estudante gera no Perfil']}
      />
    </ScrollView>
  );
}
