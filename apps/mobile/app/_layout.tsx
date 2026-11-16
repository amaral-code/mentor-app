import '../src/boot';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { carregarConfigRuntime } from '@mentor/core/runtimeConfig';
import { precisaOnboarding } from '@mentor/core/onboardingLocal';
import { useAppStore } from '@mentor/state/appStore';
import { useSessaoDoApp } from '../src/sessao/useSessaoDoApp';
import { Toast } from '../src/ui/Basicos';
import { OverlayCrise } from '../src/features/bemEstar/OverlayCrise';
import { cor } from '../src/ui/tema';

/**
 * Raiz do app: configuração de runtime, sessão e as portas por papel.
 *
 * As portas são `Stack.Protected`: a rota de outro papel simplesmente não
 * existe para quem não tem o papel (deep link incluído). Quem decide o
 * DADO continua sendo a RLS; isto aqui só evita a tela errada.
 */
export default function Raiz() {
  const [configPronta, setConfigPronta] = useState(false);
  const sessaoLida = useSessaoDoApp();
  const autenticado = useAppStore((s) => s.isAuthenticated);
  const papel = useAppStore((s) => s.userRole);
  const trocarSenha = useAppStore((s) => !!s.session?.deveTrocarSenha);
  const primeiroAcesso = useAppStore((s) => precisaOnboarding(s.session));

  /* /api/config antes do primeiro render que dependa do Supabase: nunca
     rejeita e tem teto de 6s, então o pior caso é usar o valor do build. */
  useEffect(() => {
    void carregarConfigRuntime().finally(() => setConfigPronta(true));
  }, []);

  const aluno = autenticado && papel === 'student' && !trocarSenha && !primeiroAcesso;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!configPronta || !sessaoLida ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cor.branco }}>
            <ActivityIndicator size="large" color={cor.azul600} accessibilityLabel="Carregando" />
          </View>
        ) : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cor.branco } }}>
            <Stack.Protected guard={!autenticado}>
              <Stack.Screen name="entrar" />
            </Stack.Protected>
            <Stack.Protected guard={autenticado && trocarSenha}>
              <Stack.Screen name="trocar-senha" />
            </Stack.Protected>
            <Stack.Protected guard={autenticado && !trocarSenha && primeiroAcesso}>
              <Stack.Screen name="boas-vindas" />
            </Stack.Protected>
            <Stack.Protected guard={aluno}>
              <Stack.Screen name="(aluno)" />
            </Stack.Protected>
            <Stack.Protected guard={autenticado && papel !== 'student' && !trocarSenha}>
              <Stack.Screen name="outro-perfil" />
            </Stack.Protected>
          </Stack>
        )}
        {aluno ? <OverlayCrise /> : null}
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
