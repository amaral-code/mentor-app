import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getSupabase } from '@mentor/api/supabase';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { userRepository } from '@mentor/api/UserRepository';
import { useAppStore } from '@mentor/state/appStore';
import { Botao } from '../src/ui/Botao';
import { Campo } from '../src/ui/Basicos';
import { Cartao } from '../src/ui/Cartao';
import { Texto } from '../src/ui/Texto';
import { cor } from '../src/ui/tema';

/**
 * Troca obrigatória de senha (conta importada pela secretaria).
 *
 * Enquanto `deve_trocar_senha` estiver ligado, o app inteiro fica atrás
 * desta tela, como no web: a senha temporária passou por um e-mail e não
 * pode virar permanente.
 */
export default function TrocarSenha() {
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState('');

  async function trocar() {
    setErro('');
    if (nova.length < 6) return setErro('A nova senha precisa de pelo menos 6 caracteres.');
    if (nova !== confirma) return setErro('As senhas não conferem. Digite de novo.');
    setTrocando(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Sem conexão com o banco.');
      const { error } = await sb.auth.updateUser({ password: nova });
      if (error) throw new Error('Não foi possível trocar. Tente de novo.');
      await supabaseRepository.limparTrocaSenha();
      const sessao = await userRepository.getSession();
      if (sessao) useAppStore.getState().setSession(sessao);
      useAppStore.getState().setToast('Senha atualizada! Boas-vindas ao Midnight Mentor.', 'success');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível trocar a senha.');
    } finally {
      setTrocando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={estilos.centro} keyboardShouldPersistTaps="handled">
      <View style={estilos.coluna}>
        <Texto variante="titulo" centro accessibilityRole="header">
          Quase lá, crie sua senha
        </Texto>
        <Texto centro cor={cor.tinta500}>
          Sua conta chegou por e-mail com uma senha temporária. Defina agora a sua senha definitiva.
        </Texto>
        <Cartao estilo={{ gap: 14, marginTop: 12 }}>
          <Campo rotulo="Nova senha" value={nova} onChangeText={setNova} secureTextEntry autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
          <Campo rotulo="Repita a senha" value={confirma} onChangeText={setConfirma} secureTextEntry erro={erro || undefined} onSubmitEditing={() => void trocar()} />
          <Botao titulo="Salvar senha" aoTocar={() => void trocar()} carregando={trocando} />
          <Botao titulo="Sair" variante="fantasma" aoTocar={() => void userRepository.logout()} />
        </Cartao>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  centro: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: cor.branco },
  coluna: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 6 },
});
