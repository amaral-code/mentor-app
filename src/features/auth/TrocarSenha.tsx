import { useState } from 'react';
import { KeyRound, Moon } from 'lucide-react';
import { getSupabase } from '../../shared/lib/supabase';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { userRepository } from '../../shared/storage/UserRepository';
import { useAppStore } from '../../stores/appStore';

/**
 * TROCA OBRIGATÓRIA DE SENHA (primeiro acesso de conta importada).
 *
 * A secretaria cria a conta com senha temporária de uso único enviada por
 * email. Enquanto `deve_trocar_senha` estiver ligado, o app inteiro fica
 * bloqueado atrás desta tela: sem ela, a temporária (que passou por um
 * email) viraria senha permanente.
 */
export function TrocarSenha() {
  const setToast = useAppStore((s) => s.setToast);
  const setSession = useAppStore((s) => s.setSession);
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleTrocar() {
    setErro('');
    if (nova.length < 6) {
      setErro('A nova senha precisa de pelo menos 6 caracteres.');
      return;
    }
    if (nova !== confirma) {
      setErro('As senhas não conferem. Digite de novo.');
      return;
    }
    setTrocando(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Sem conexão com o banco.');
      const { error } = await sb.auth.updateUser({ password: nova });
      if (error) throw new Error('Não foi possível trocar. Tente de novo.');
      await supabaseRepository.limparTrocaSenha();
      const novaSessao = await userRepository.getSession();
      if (novaSessao) setSession(novaSessao);
      setToast('Senha atualizada! Bem-vindo ao Midnight Mentor.', 'success');
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível trocar a senha.');
    } finally {
      setTrocando(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: '#0b1120' }}>
      <div className="w-full max-w-sm glass rounded-3xl p-6 md:p-8 text-center animate-fade-up">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-4">
          <Moon size={22} className="text-gray-900" />
        </div>
        <h1 className="text-lg font-bold text-white">Quase lá, crie sua senha</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Sua conta chegou por email com uma senha temporária. Defina agora a sua senha definitiva e secreta.
        </p>
        <div className="space-y-3 text-left">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Nova senha</span>
            <input
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              className="w-full text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wider">Repita a senha</span>
            <input
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleTrocar(); }}
              placeholder="Igual à de cima"
              autoComplete="new-password"
              className="w-full text-sm"
            />
          </label>
        </div>
        {erro && (
          <p role="alert" className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2 mt-3">
            {erro}
          </p>
        )}
        <button
          onClick={() => void handleTrocar()}
          disabled={trocando || nova.length < 6 || confirma.length === 0}
          className="btn-primary w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <KeyRound size={15} /> {trocando ? 'Salvando…' : 'Definir minha senha'}
        </button>
      </div>
    </div>
  );
}
