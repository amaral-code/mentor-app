import { ScrollView } from 'react-native';
import { PainelNoSite } from '../../src/features/papeis/PainelNoSite';

/** Rota de entrada do papel teacher (o painel nativo é do M6). */
export default function Painel() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <PainelNoSite
        titulo="Seu painel de professor"
        texto="Veja como estão as turmas que você leciona no painel completo, no navegador."
        itens={['Como a turma está (termômetro)', 'O que revisar com a turma', 'Códigos das suas turmas']}
      />
    </ScrollView>
  );
}
