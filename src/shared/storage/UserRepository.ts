import type { Session as SbSession, Subscription } from '@supabase/supabase-js';
import { Session, User, UserRole } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { comTimeout, TIMEOUT_AUTH_MS } from '../lib/comTimeout';

/**
 * Autenticacao - exclusivamente Supabase Auth.
 *
 * A versao anterior mantinha um array `mm_users` no localStorage com as
 * SENHAS EM TEXTO PURO e um objeto `mm_session` que o app tratava como
 * verdade. Isso permitia duas coisas graves:
 *
 *   1. ler todas as senhas pelo DevTools (e elas eram reenviadas ao
 *      Supabase, entao vazavam a conta real);
 *   2. digitar no console
 *        localStorage.setItem('mm_session', '{"role":"educator",...}')
 *      e recarregar para virar educador.
 *
 * Agora a sessao vem do JWT e o papel vem da tabela `perfis`. Nenhum dos
 * dois e gravavel pelo cliente: o papel e travado por trigger no banco.
 */

const SEM_SUPABASE = 'Banco de dados nao configurado. Verifique o .env.';

export interface AuthResult {
  session: Session | null;
  error?: string;
  /** Cadastro criado, mas exige confirmacao por e-mail antes do login. */
  precisaConfirmarEmail?: boolean;
  /** Papel real no banco, quando difere do que o usuario escolheu na tela. */
  papelDivergente?: UserRole;
}

export class UserRepository {
  /** Perfil do usuario logado, ou null. */
  private async carregarPerfil(uid: string, emailFallback: string): Promise<Session | null> {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await comTimeout(
      sb
        .from('perfis')
        .select('id, email, nome, papel, escola_id, turma_id, deve_trocar_senha')
        .eq('id', uid)
        .maybeSingle(),
      TIMEOUT_AUTH_MS,
      'Carregar perfil',
    );

    if (error || !data) return null;

    return {
      uid: data.id,
      email: data.email ?? emailFallback,
      nome: data.nome,
      role: (data.papel as UserRole) ?? 'student',
      escolaId: data.escola_id,
      turmaId: data.turma_id,
      deveTrocarSenha: !!data.deve_trocar_senha,
    };
  }

  /**
   * Sessao atual a partir do JWT guardado pelo supabase-js.
   * Nunca joga: com a rede travada devolve null (tela de login) em vez de
   * derrubar o boot com rejection nao tratada.
   */
  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured()) return null;
    const sb = getSupabase();
    if (!sb) return null;

    try {
      const { data } = await comTimeout(sb.auth.getSession(), TIMEOUT_AUTH_MS, 'Recuperar sessão');
      const user = data.session?.user;
      if (!user) return null;

      return await this.carregarPerfil(user.id, user.email ?? '');
    } catch {
      return null;
    }
  }

  async login(email: string, senha: string, papelEscolhido?: UserRole): Promise<AuthResult> {
    if (!isSupabaseConfigured()) return { session: null, error: SEM_SUPABASE };
    const sb = getSupabase();
    if (!sb) return { session: null, error: SEM_SUPABASE };

    const { data, error } = await comTimeout(
      sb.auth.signInWithPassword({ email, password: senha }),
      TIMEOUT_AUTH_MS,
      'Entrar',
    );

    if (error) {
      // Mensagem generica de proposito: distinguir "e-mail nao existe" de
      // "senha errada" entrega uma lista de contas validas a quem testa.
      const naoConfirmado = /confirm/i.test(error.message);
      return {
        session: null,
        error: naoConfirmado
          ? 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.'
          : 'E-mail ou senha incorretos.',
      };
    }
    if (!data.user) return { session: null, error: 'Falha ao autenticar.' };

    let session: Session | null;
    try {
      session = await this.carregarPerfil(data.user.id, data.user.email ?? email);
    } catch (err) {
      // Timeout de rede: mensagem acionavel, botao destrava (AuthPage sai do loading).
      return { session: null, error: err instanceof Error ? err.message : 'Erro de conexão' };
    }
    if (!session) {
      return { session: null, error: 'Perfil nao encontrado. Fale com o suporte.' };
    }

    return {
      session,
      papelDivergente:
        papelEscolhido && papelEscolhido !== session.role ? session.role : undefined,
    };
  }

  /**
   * Cadastro.
   *
   * Nao recebe papel de proposito. O papel e definido pelo trigger
   * handle_new_user() no banco, que sempre grava 'student' - o metadata do
   * signUp e controlado pelo cliente, e obedecer a ele deixaria qualquer
   * pessoa se cadastrar como admin. Promocao e ato administrativo.
   */
  async register(email: string, senha: string, nome: string): Promise<AuthResult> {
    if (!isSupabaseConfigured()) return { session: null, error: SEM_SUPABASE };
    const sb = getSupabase();
    if (!sb) return { session: null, error: SEM_SUPABASE };

    const { data, error } = await comTimeout(
      sb.auth.signUp({
        email,
        password: senha,
        options: { data: { nome: nome.trim() } },
      }),
      TIMEOUT_AUTH_MS,
      'Criar conta',
    );

    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message);
      return {
        session: null,
        error: jaExiste ? 'E-mail ja cadastrado.' : error.message,
      };
    }

    // Com confirmacao de e-mail ligada, signUp nao devolve sessao.
    if (!data.session) {
      return { session: null, precisaConfirmarEmail: true };
    }

    try {
      const session = await this.carregarPerfil(data.user!.id, email);
      return { session, error: session ? undefined : 'Perfil nao criado. Tente entrar novamente.' };
    } catch (err) {
      return { session: null, error: err instanceof Error ? err.message : 'Erro de conexão' };
    }
  }

  async logout(): Promise<void> {
    const sb = getSupabase();
    await sb?.auth.signOut();
  }

  /** Atualiza campos livres do proprio perfil (papel e escola sao travados no banco). */
  async updateProfile(dados: Partial<Pick<User, 'nome' | 'sobrenome' | 'metaEstudo'>>): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return false;

    const patch: Record<string, unknown> = {};
    if (dados.nome !== undefined) patch.nome = dados.nome;
    if (dados.sobrenome !== undefined) patch.sobrenome = dados.sobrenome;
    if (dados.metaEstudo !== undefined) patch.meta_estudo = dados.metaEstudo;
    if (Object.keys(patch).length === 0) return true;

    const { error } = await sb.from('perfis').update(patch).eq('id', auth.user.id);
    return !error;
  }

  /**
   * Reage a login/logout/refresh do token - inclusive em outra aba.
   * Devolve a funcao de cancelamento.
   */
  onAuthChange(cb: (session: Session | null) => void): () => void {
    const sb = getSupabase();
    if (!sb) return () => {};

    const { data } = sb.auth.onAuthStateChange(async (_evt, sbSession: SbSession | null) => {
      if (!sbSession?.user) {
        cb(null);
        return;
      }
      try {
        cb(await this.carregarPerfil(sbSession.user.id, sbSession.user.email ?? ''));
      } catch {
        // Rede oscilou no refresh do token: ignora o evento em vez de
        // chamar cb(null) e deslogar quem estava estudando.
      }
    });

    const sub: Subscription | undefined = data?.subscription;
    return () => sub?.unsubscribe();
  }
}

export const userRepository = new UserRepository();
