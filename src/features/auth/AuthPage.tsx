import { useState, useEffect, useRef, useCallback, Fragment, memo } from 'react';
import { Eye, EyeOff, GraduationCap, HeartHandshake, Lock, Mail, Presentation, School, User } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { userRepository } from '../../shared/storage/UserRepository';
import { isSupabaseConfigured } from '../../shared/lib/supabase';
import { UserRole } from '../../shared/types';
import { ColorBlindnessToggle } from '../../shared/ui/ColorBlindnessToggle';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Senha minima no CADASTRO. O login nao valida tamanho, para nao travar
 *  contas criadas antes desta regra. */
const MIN_SENHA_CADASTRO = 6;

/**
 * 'admin' e 'psychologist' ficam de fora: nao sao perfis que se escolhem
 * na tela de acesso. O psicologo cria a conta como qualquer pessoa e e
 * promovido por registrar_psicologo() no banco, depois da conferencia do
 * CRP - deixar o papel disponivel aqui seria permitir que qualquer um se
 * anunciasse como profissional de saude na plataforma. O docente entra
 * pela porta propria (a conta chega por email da secretaria); escolher
 * outra porta so gera o aviso de divergencia, o servidor decide o papel.
 */
type RoleEscolhivel = Exclude<UserRole, 'admin' | 'psychologist'>;

const ROLE_CONFIG: Record<RoleEscolhivel, { label: string; desc: string; icon: React.ReactNode }> = {
  student: {
    label: 'Aluno',
    desc: 'Estudante focado no ENEM',
    icon: <GraduationCap size={30} strokeWidth={2.25} />,
  },
  educator: {
    label: 'Educacional',
    desc: 'Secretaria da escola',
    icon: <School size={30} strokeWidth={2.25} />,
  },
  teacher: {
    label: 'Docente',
    desc: 'Professor em sala',
    icon: <Presentation size={30} strokeWidth={2.25} />,
  },
  parent: {
    label: 'Pais e responsáveis',
    desc: 'Acompanhamento pedagógico',
    icon: <HeartHandshake size={30} strokeWidth={2.25} />,
  },
};

interface ErrosCampo {
  nome?: string;
  email?: string;
  senha?: string;
}

interface ValoresAuth {
  nome: string;
  email: string;
  senha: string;
}

/* ====================================================================
   CampoAuth — input isolado e memorizado.
   ====================================================================
   Por que existe: antes o `value`/`onChange` de cada campo morava no
   AuthPage raiz, entao CADA TECLA re-renderizava a pagina inteira —
   fundo com blur, card `.glass` com backdrop-filter (o paint mais caro
   no mobile) e todos os irmaos. Aqui o input e NAO-CONTROLADO
   (defaultValue + ref): digitar nao dispara setState nenhum, logo nao
   ha re-render por tecla. O unico setState no onChange limpa o erro do
   proprio campo — e so roda quando aquele erro esta visivel.
   ==================================================================== */
interface CampoAuthProps {
  id: string;
  erroId: string;
  label: string;
  erro?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  limparErro: (campo: keyof ErrosCampo) => void;
  campo: keyof ErrosCampo;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'email' | 'text';
  enterKeyHint?: 'next' | 'send' | 'go';
  acaoDireita?: React.ReactNode;
  comEspacoDireita?: boolean;
  /** Ícone dentro do campo, à esquerda (visual do Figma). */
  icone?: React.ReactNode;
}

const CampoAuth = memo(function CampoAuth({
  id, erroId, label, erro, inputRef, limparErro, campo,
  type = 'text', placeholder, autoComplete, inputMode,
  enterKeyHint, acaoDireita, comEspacoDireita, icone,
}: CampoAuthProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-500 mb-1.5 font-extrabold uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        {icone && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true">{icone}</span>}
        <input
          id={id}
          name={id}
          ref={inputRef}
          type={type}
          defaultValue=""
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoCapitalize={type === 'email' ? 'none' : undefined}
          autoCorrect={type === 'email' ? 'off' : undefined}
          spellCheck={type === 'email' ? false : undefined}
          aria-invalid={!!erro}
          aria-describedby={erro ? erroId : undefined}
          onChange={() => limparErro(campo)}
          className={`w-full h-14 transition-all${icone ? ' pl-12' : ''}${comEspacoDireita ? ' pr-12' : ''}${erro ? ' !border-red-400 focus:!border-red-500' : ''}`}
        />
        {acaoDireita}
      </div>
      {erro && <p id={erroId} className="text-sm font-bold text-red-600 mt-1.5">{erro}</p>}
    </div>
  );
});

interface AuthFormProps {
  isLogin: boolean;
  loading: boolean;
  onSubmit: (valores: ValoresAuth) => void;
}

/**
 * Formulario isolado do chrome da pagina.
 *
 * Todo estado de digitacao vive aqui dentro (refs + erros + ver-senha).
 * O AuthPage pai NUNCA re-renderiza por tecla — cabecalho, card glass,
 * banner do perfil e fundo com blur ficam intactos enquanto digita.
 * Validacao so no submit: email usa regex simples (microssegundos),
 * sem mascara nem formatacao por tecla.
 */
const AuthForm = memo(function AuthForm({ isLogin, loading, onSubmit }: AuthFormProps) {
  const nomeRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const senhaRef = useRef<HTMLInputElement | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erros, setErros] = useState<ErrosCampo>({});

  // Limpa o erro do campo ao voltar a digitar. Sem erro visivel, retorna
  // o estado anterior = React descarta o update, zero re-render.
  const limparErro = useCallback((campo: keyof ErrosCampo) => {
    setErros((anterior) => {
      if (!anterior[campo]) return anterior;
      const { [campo]: _removido, ...resto } = anterior;
      return resto;
    });
  }, []);

  const alternarSenha = useCallback(() => setMostrarSenha((v) => !v), []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nome = nomeRef.current?.value.trim() ?? '';
    const email = emailRef.current?.value.trim() ?? '';
    const senha = senhaRef.current?.value ?? '';

    const novos: ErrosCampo = {};
    if (!isLogin && !nome) novos.nome = 'Como podemos te chamar?';
    if (!email) novos.email = 'Informe seu e-mail';
    else if (!EMAIL_REGEX.test(email)) novos.email = 'Esse e-mail não parece válido';
    if (!senha) novos.senha = 'Informe sua senha';
    else if (!isLogin && senha.length < MIN_SENHA_CADASTRO) {
      novos.senha = `Use pelo menos ${MIN_SENHA_CADASTRO} caracteres`;
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    onSubmit({ nome, email, senha });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {!isLogin && (
        <CampoAuth
          id="campo-nome"
          erroId="erro-nome"
          campo="nome"
          label="Nome"
          placeholder="Seu nome"
          autoComplete="name"
          enterKeyHint="next"
          inputRef={nomeRef}
          icone={<User size={20} strokeWidth={2.5} />}
          erro={erros.nome}
          limparErro={limparErro}
        />
      )}

      <CampoAuth
        id="campo-email"
        erroId="erro-email"
        campo="email"
        label="E-mail"
        type="email"
        inputMode="email"
        placeholder="seu@email.com"
        autoComplete="email"
        enterKeyHint="next"
        inputRef={emailRef}
        icone={<Mail size={20} strokeWidth={2.5} />}
        erro={erros.email}
        limparErro={limparErro}
      />

      <CampoAuth
        id="campo-senha"
        erroId="erro-senha"
        campo="senha"
        label="Senha"
        type={mostrarSenha ? 'text' : 'password'}
        placeholder={isLogin ? 'Sua senha' : `Pelo menos ${MIN_SENHA_CADASTRO} caracteres`}
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        enterKeyHint="send"
        inputRef={senhaRef}
        icone={<Lock size={20} strokeWidth={2.5} />}
        erro={erros.senha}
        limparErro={limparErro}
        comEspacoDireita
        acaoDireita={
          <button
            type="button"
            onClick={alternarSenha}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-ceu-600 transition-colors"
          >
            {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        }
      />

      <button
        type="submit"
        className="btn-primary w-full flex items-center justify-center gap-2 h-14 text-base uppercase"
        disabled={loading}
      >
        {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Criar conta')}
      </button>
    </form>
  );
});

export function AuthPage() {
  const [selectedRole, setSelectedRole] = useState<RoleEscolhivel>('student');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  // Seletores atomicos: assinar o store INTEIRO aqui faria qualquer update
  // global (toast, mascote, telemetria) re-renderizar os inputs e roubar
  // foco no meio da digitacao.
  const setSession = useAppStore((s) => s.setSession);
  const setShowTutorial = useAppStore((s) => s.setShowTutorial);
  const setTutorialStep = useAppStore((s) => s.setTutorialStep);

  // O beat de comemoracao usa setTimeout. Se o componente sair antes de
  // disparar, o timer chamaria setState num componente desmontado.
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  /**
   * Autenticacao (rede). Recebe os valores lidos dos refs no submit —
   * nao ha estado de digitacao aqui, entao nada re-renderiza por tecla.
   *
   * O banner unico de erro fica reservado a falha de servidor/conexao;
   * erro de campo aparece sob o campo, dentro do AuthForm.
   */
  const handleAutenticar = useCallback(async ({ nome, email, senha }: ValoresAuth) => {
    setError('');
    setAviso('');
    setLoading(true);

    try {
      if (isLogin) {
        const r = await userRepository.login(email, senha, selectedRole);
        if (r.error || !r.session) { setError(r.error || 'E-mail ou senha incorretos'); setLoading(false); return; }
        if (r.papelDivergente) {
          // Psicólogo e admin não têm porta na tela de login, então não
          // estão no ROLE_CONFIG: sem este mapa o aviso mostrava o nome
          // interno do papel, em inglês ("psychologist").
          const ROTULO_FORA_DA_TELA: Partial<Record<string, string>> = {
            psychologist: 'Psicólogo(a)',
            admin: 'Administrador',
          };
          const rotulo =
            ROLE_CONFIG[r.papelDivergente as RoleEscolhivel]?.label ??
            ROTULO_FORA_DA_TELA[r.papelDivergente] ??
            'outro perfil';
          setAviso(`Sua conta é do tipo "${rotulo}". Entrando nesse perfil.`);
        }
        // Beat de comemoracao antes de trocar de tela: o sagui aparece
        // aprovando, o que torna a espera parte da recompensa.
        setSucesso(true);
        const sessao = r.session;
        timerRef.current = window.setTimeout(() => setSession(sessao), 650);
      } else {
        const r = await userRepository.register(email, senha, nome);
        if (r.precisaConfirmarEmail) {
          setAviso('Conta criada. Confirme o e-mail para entrar: mandamos um link para você.');
          setIsLogin(true);
          setLoading(false);
          return;
        }
        if (r.error || !r.session) { setError(r.error || 'Erro ao cadastrar'); setLoading(false); return; }
        const sessao = r.session;
        setSucesso(true);
        timerRef.current = window.setTimeout(() => {
          setSession(sessao);
          if (sessao.role === 'student') { setShowTutorial(true); setTutorialStep(0); }
        }, 650);
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão');
      setLoading(false);
    }
  }, [isLogin, selectedRole, setSession, setShowTutorial, setTutorialStep]);

  const alternarModo = useCallback(() => {
    setIsLogin((v) => !v);
    setError('');
    setAviso('');
  }, []);
  /* Perfil e formulário na MESMA tela (visual lúdico): escolher o perfil
     só seleciona; o "Entrar" usa o perfil selecionado, como antes. */
  const escolherPapel = useCallback((role: RoleEscolhivel) => {
    setSelectedRole(role);
    setError('');
    setAviso('');
  }, []);

  return (
    <Fragment>
      <ColorBlindnessToggle />
      <div className="min-h-dvh bg-white flex items-center justify-center px-5 py-8 md:p-10">
        <div className="w-full max-w-md md:max-w-5xl md:grid md:grid-cols-2 md:gap-14 md:items-center animate-fade-up">
          {/* Herói: o sagui abre a tela, com o balão de fala. */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-1 md:flex-col md:gap-4">
              <img
                src="/assets/sagui_acenando_2.png"
                alt=""
                width={240}
                height={240}
                className="w-28 h-28 md:w-60 md:h-60 shrink-0 object-contain motion-safe:animate-float-suave"
              />
              <div className="relative max-w-[200px] md:max-w-xs rounded-2xl border-2 border-slate-200 shadow-lip bg-white px-4 py-3 text-left md:text-center">
                <p className="text-sm md:text-base font-bold text-tinta-900 leading-snug">Oi! Eu sou o sagui. Bora estudar pro ENEM?</p>
              </div>
            </div>
            <h1 className="mt-5 text-[32px] md:text-5xl font-black text-azul-600 leading-tight tracking-tight">Midnight Mentor</h1>
            <p className="text-base md:text-lg font-semibold text-slate-500 mt-1">Seu mentor de estudos para o ENEM</p>
            <div className="hidden md:inline-flex mt-6 items-center gap-2 text-xs font-bold text-slate-500 rounded-xl border-2 border-slate-200 px-3 py-2">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {isSupabaseConfigured() ? 'Conectado ao banco de dados' : 'Banco não configurado'}
            </div>
          </div>

          <div className="mt-8 md:mt-0 relative">
            {/* Estado de sucesso: o sagui aprova antes de entrar */}
            {sucesso && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl animate-fade-in">
                <img loading="lazy"
                  src="/assets/sagui_aprovacao_2.png"
                  alt=""
                  width={128}
                  height={128}
                  className="w-32 h-32 object-contain motion-safe:animate-scale-in"
                />
                <p className="text-lg font-black text-amber-600">Boa. Bora estudar.</p>
              </div>
            )}

            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3">Quem vai entrar?</p>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Perfil de acesso">
              {(Object.entries(ROLE_CONFIG) as [RoleEscolhivel, typeof ROLE_CONFIG['student']][]).map(([role, cfg]) => {
                const sel = role === selectedRole;
                return (
                  <button
                    key={role}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => escolherPapel(role)}
                    title={cfg.desc}
                    className={`min-h-[92px] rounded-2xl border-2 px-2 py-3 flex flex-col items-center justify-center gap-1.5 text-center transition-[transform,background-color,border-color] active:translate-y-1 active:shadow-none ${
                      sel ? 'bg-ceu-100 border-ceu-500 shadow-lip-ceu text-ceu-600' : 'bg-white border-slate-200 shadow-lip text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cfg.icon}
                    <span className={`text-[15px] font-extrabold leading-tight ${sel ? 'text-ceu-600' : 'text-tinta-900'}`}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm font-semibold text-slate-500 mt-3 text-center">{ROLE_CONFIG[selectedRole].desc}</p>

            <div className="mt-5">
              {/* Banners de servidor/conexao (erros de campo vivem no form) */}
              {error && (
                <div className="text-red-700 text-sm font-bold bg-red-50 rounded-2xl px-4 py-3 border-2 border-red-200 animate-slide-up mb-4" role="alert">
                  {error}
                </div>
              )}
              {aviso && (
                <div className="text-amber-700 text-sm font-bold bg-amber-50 rounded-2xl px-4 py-3 border-2 border-amber-200 animate-slide-up mb-4" role="status">
                  {aviso}
                </div>
              )}

              {/* key reseta os inputs nao-controlados ao trocar de modo */}
              <AuthForm
                key={isLogin ? 'login' : 'cadastro'}
                isLogin={isLogin}
                loading={loading}
                onSubmit={handleAutenticar}
              />

              <div className="mt-5 text-center">
                <button
                  onClick={alternarModo}
                  className="text-sm font-semibold text-slate-500 min-h-[44px] px-2"
                >
                  {isLogin ? 'Ainda não tem conta? ' : 'Já tem conta? '}
                  <span className="text-ceu-600 font-extrabold">
                    {isLogin ? 'Criar agora' : 'Entrar'}
                  </span>
                </button>
              </div>
              <p className="md:hidden mt-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isSupabaseConfigured() ? 'Conectado ao banco de dados' : 'Banco não configurado'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
