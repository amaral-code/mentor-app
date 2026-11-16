import { Stack } from 'expo-router';
import { useAppStore } from '@mentor/state/appStore';
import { useEfeitosDoAluno } from '../../src/sessao/useSessaoDoApp';
import { OverlayNivel } from '../../src/features/loja/OverlayNivel';
import { RelatorioSemanal } from '../../src/features/bemEstar/RelatorioSemanal';
import { GuardaDoomscroll } from '../../src/features/bemEstar/GuardaDoomscroll';
import { cor } from '../../src/ui/tema';

/**
 * Área do aluno. As abas ficam em `(abas)`; o resto é empilhado por
 * cima delas, com o botão voltar do Android funcionando de graça.
 */
export default function LayoutAluno() {
  const { nivelNovo, fecharNivel } = useEfeitosDoAluno();
  const relatorioAberto = useAppStore((s) => s.showWeeklyReport);
  return (
    <GuardaDoomscroll>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.branco } }} />
      <OverlayNivel nivel={nivelNovo} aoFechar={fecharNivel} />
      {relatorioAberto ? <RelatorioSemanal /> : null}
    </GuardaDoomscroll>
  );
}
