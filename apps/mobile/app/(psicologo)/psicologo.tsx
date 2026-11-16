import { ScrollView } from 'react-native';
import { PainelNoSite } from '../../src/features/papeis/PainelNoSite';

/** Rota de entrada do papel psychologist (o painel nativo é do M6). */
export default function Painel() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <PainelNoSite
        titulo="Seu painel de psicólogo"
        texto="Pacientes, agenda e prontuário ficam no painel completo, no navegador."
        itens={['Pacientes com consentimento vigente', 'Agenda e consultas', 'Prontuário e mensagens']}
      />
    </ScrollView>
  );
}
