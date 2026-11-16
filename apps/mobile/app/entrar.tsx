import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { userRepository } from '@mentor/api/UserRepository';
import { isSupabaseConfigured } from '@mentor/api/supabase';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../src/ui/Botao';
import { Campo } from '../src/ui/Basicos';
import { Cartao } from '../src/ui/Cartao';
import { imagemSagui } from '../src/ui/sagui';
import { Texto } from '../src/ui/Texto';
import { cor } from '../src/ui/tema';

/**
 * Entrada por e-mail e senha.
 *
 * Sem seletor de papel: o papel vem do perfil no banco (JWT + `perfis`),
 * e a conta cai na área dela. Link mágico, Google e Apple são da issue de
 * autenticação nativa do M2 (#32).
 */
export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');

  async function entrar() {
    if (!email.trim() || !senha) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setErro('');
    setEntrando(true);
    try {
      const r = await userRepository.login(email.trim(), senha);
      if (r.error || !r.session) {
        setErro(r.error ?? 'Não foi possível entrar.');
        return;
      }
      // onAuthChange também chega, mas o setSession aqui evita um quadro
      // de login depois do toque em "Entrar".
      useAppStore.getState().setSession(r.session);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: cor.branco }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.centro} keyboardShouldPersistTaps="handled">
        <View style={estilos.coluna}>
          <Image source={imagemSagui('acenando')} style={estilos.sagui} accessible={false} />
          <Texto variante="titulo" centro accessibilityRole="header">
            Midnight Mentor
          </Texto>
          <Texto centro cor={cor.tinta500}>
            Seu parceiro de estudos para o ENEM.
          </Texto>
          <Cartao estilo={{ gap: 14, marginTop: 16 }}>
            {!isSupabaseConfigured() ? (
              <Texto variante="legenda" cor={cor.vermelho600}>
                O app ainda não sabe onde fica o servidor. Defina EXPO_PUBLIC_SITE_URL (ou SUPABASE_URL e
                SUPABASE_ANON_KEY no site) e abra de novo.
              </Texto>
            ) : null}
            <Campo
              rotulo="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="voce@escola.com.br"
            />
            <Campo
              rotulo="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              onSubmitEditing={() => void entrar()}
              returnKeyType="go"
              erro={erro || undefined}
            />
            <Botao titulo="Entrar" aoTocar={() => void entrar()} carregando={entrando} />
          </Cartao>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  centro: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  coluna: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 6 },
  sagui: { width: 120, height: 120, alignSelf: 'center', resizeMode: 'contain' },
});
