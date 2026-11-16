import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { userRepository } from '@mentor/api/UserRepository';
import { isSupabaseConfigured } from '@mentor/api/supabase';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../src/ui/Botao';
import { Campo } from '../src/ui/Basicos';
import { Cartao } from '../src/ui/Cartao';
import { imagemSagui } from '../src/ui/sagui';
import { Texto } from '../src/ui/Texto';
import { cor } from '../src/ui/tema';
import { entrarComProvedor, pedirLinkNoEmail } from '../src/sessao/entradaSocial';
import { appleDisponivelNativo, entrarComApple } from '../src/sessao/entradaApple';

/**
 * Entrada por e-mail e senha.
 *
 * Sem seletor de papel: o papel vem do perfil no banco (JWT + `perfis`),
 * e a conta cai na área dela. Também por link no e-mail, Google e Apple
 * (#32); a Apple aparece sempre que há login social, como a App Store exige.
 */
export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState<'senha' | 'link'>('senha');
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [appleNativo, setAppleNativo] = useState(false);

  useEffect(() => {
    void appleDisponivelNativo().then(setAppleNativo);
  }, []);

  async function enviarLink() {
    setErro('');
    setEntrando(true);
    const e = await pedirLinkNoEmail(email);
    setEntrando(false);
    if (e) setErro(e);
    else setLinkEnviado(true);
  }

  async function social(qual: 'google' | 'apple') {
    setErro('');
    const e = qual === 'apple' ? await entrarComApple() : await entrarComProvedor('google');
    if (e) setErro(e);
  }

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
            {modo === 'senha' ? (
              <>
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
              </>
            ) : linkEnviado ? (
              <Texto accessibilityLiveRegion="polite">
                Se este e-mail tem conta, o link chegou. Abra no celular: ele entra direto no app.
              </Texto>
            ) : (
              <>
                {erro ? <Texto variante="legenda" cor={cor.vermelho600}>{erro}</Texto> : null}
                <Botao titulo="Mandar link de entrada" icone="mail-outline" aoTocar={() => void enviarLink()} carregando={entrando} />
              </>
            )}
            <Pressable
              onPress={() => {
                setModo(modo === 'senha' ? 'link' : 'senha');
                setErro('');
                setLinkEnviado(false);
              }}
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Texto negrito centro cor={cor.ceu700}>
                {modo === 'senha' ? 'Entrar sem senha, com um link no e-mail' : 'Entrar com senha'}
              </Texto>
            </Pressable>
            <View style={estilos.ou}>
              <View style={estilos.linha} />
              <Texto variante="legenda">ou</Texto>
              <View style={estilos.linha} />
            </View>
            <Botao titulo="Continuar com Google" variante="secundario" icone="logo-google" aoTocar={() => void social('google')} />
            {appleNativo ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={16}
                style={{ height: 52 }}
                onPress={() => void social('apple')}
              />
            ) : (
              <Botao titulo="Continuar com Apple" variante="secundario" icone="logo-apple" aoTocar={() => void social('apple')} />
            )}
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
  ou: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linha: { flex: 1, height: 2, backgroundColor: cor.cinza100 },
});
