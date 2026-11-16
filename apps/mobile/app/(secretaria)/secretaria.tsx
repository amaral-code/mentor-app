import { ScrollView } from 'react-native';
import { PainelNoSite } from '../../src/features/papeis/PainelNoSite';

/** Rota de entrada do papel educator (o painel nativo é do M6). */
export default function Painel() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <PainelNoSite
        titulo="Seu Painel da Secretaria"
        texto="Matrículas, turmas e docentes ficam no painel completo, no navegador."
        itens={['Matrículas e importação de planilha', 'Turmas e códigos', 'Docentes e visão da escola']}
      />
    </ScrollView>
  );
}
