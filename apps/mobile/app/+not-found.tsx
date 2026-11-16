import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { destinoDaSessao } from '@mentor/core/rotasPorPapel';
import { useAppStore } from '@mentor/state/appStore';
import { cor } from '../src/ui/tema';

/**
 * Rota que não existe PARA ESTE PAPEL (o responsável que abre um link
 * /quiz, o aluno que digita /secretaria) cai aqui e vai para a entrada
 * do próprio papel. Para quem tenta, a rota alheia simplesmente não
 * existe: não há tela de "acesso negado" contando que ela está lá.
 */
export default function NaoEncontrada() {
  useEffect(() => {
    const d = destinoDaSessao(useAppStore.getState().session);
    const rota = d.tipo === 'grupo' ? d.rota : d.tipo === 'sem-tela' ? '/sem-painel' : `/${d.tipo}`;
    router.replace(rota as never);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cor.branco }}>
      <ActivityIndicator color={cor.azul600} />
    </View>
  );
}
