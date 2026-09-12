import { useState, useEffect, useRef, useCallback, Fragment, memo } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, GraduationCap, HeartHandshake, Moon, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { userRepository } from '../../shared/storage/UserRepository';
import { isSupabaseConfigured } from '../../shared/lib/supabase';
import { UserRole } from '../../shared/types';
import { ColorBlindnessToggle } from '../../shared/ui/ColorBlindnessToggle';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Senha minima no CADASTRO. O login nao valida tamanho, para nao travar
 *  contas criadas antes desta regra. */
const MIN_SENHA_CADASTRO = 6;

type AuthStep = 'role' | 'auth';

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

const ROLE_CONFIG: Record<RoleEscolhivel, { label: string; desc: string; icon: React.ReactNode; gradient: string }> = {
  student: {
    label: 'Aluno',
    desc: 'Estudante focado no ENEM',
    icon: <GraduationCap size={24} />,
    gradient: 'from-amber-400 to-orange-600',
  },
  educator: {
    label: 'Educacional',
    desc: 'Secretaria da escola',
    icon: <Users size={24} />,
    gradient: 'from-emerald-400 to-cyan-600',
  },
  teacher: {
    label: 'Docente',
    desc: 'Professor em sala',
    icon: <Users size={24} />,
    gradient: 'from-sky-400 to-blue-600',
  },
  parent: {
    label: 'Pais e responsáveis',
    desc: 'Acompanhamento pedagógico',
    icon: <HeartHandshake size={24} />,
    gradient: 'from-violet-400 to-purple-600',
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
}

const CampoAuth = memo(function CampoAuth({
  id, erroId, label, erro, inputRef, limparErro, campo,
  type = 'text', placeholder, autoComplete, inputMode,
  enterKeyHint, acaoDireita, comEspacoDireita,
}: CampoAuthProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-500 mb-1.5 font-medium tracking-wide">
        {label}
      </label>
      <div className="relative">
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
          className={`w-full transition-all${comEspacoDireita ? ' pr-12' : ''}${erro ? ' border-red-500/40 focus:border-red-500/60' : ''}`}
        />
        {acaoDireita}
      </div>
      {erro && <p id={erroId} className="text-xs text-red-400 mt-1.5">{erro}</p>}
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
        erro={erros.senha}
        limparErro={limparErro}
        comEspacoDireita
        acaoDireita={
          <button
            type="button"
            onClick={alternarSenha}
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-gray-500 hover:text-amber-400 transition-colors"
          >
            {mostrarSenha ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        }
      />

      <button
        type="submit"
        className="btn-primary w-full flex items-center justify-center gap-2 h-12 press"
        disabled={loading}
      >
        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Criar conta')}
      </button>
    </form>
  );
});

export function AuthPage() {
  const [step, setStep] = useState<AuthStep>('role');
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
          setAviso(`Sua conta é do tipo "${ROLE_CONFIG[r.papelDivergente as RoleEscolhivel]?.label ?? r.papelDivergente}". Entrando nesse perfil.`);
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

  const voltarParaPapeis = useCallback(() => { setStep('role'); setError(''); }, []);
  const alternarModo = useCallback(() => {
    setIsLogin((v) => !v);
    setError('');
    setAviso('');
  }, []);
  const escolherPapel = useCallback((role: RoleEscolhivel) => {
    setSelectedRole(role);
    setStep('auth');
    setIsLogin(true);
    setError('');
    setAviso('');
  }, []);

  /* ==================================================================
     Etapa 1: escolha do perfil
     ================================================================== */
  if (step === 'role') {
    return (
      <Fragment>
        <ColorBlindnessToggle />
        <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#0b1120' }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-amber-500/5 blur-[100px]" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-orange-500/5 blur-[100px]" />
          </div>

          <div className="w-full max-w-lg animate-fade-up relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-7 text-center sm:text-left">
              {/* O sagui e a identidade do produto: ele abre a tela.
                  Empilhado no celular: lado a lado ele saia pela borda
                  esquerda em 375px. */}
              <img
                src="/assets/sagui_pulando_2.png"
                alt=""
                width={104}
                height={104}
                className="w-24 h-24 shrink-0 object-contain drop-shadow-[0_8px_24px_rgba(245,158,11,0.18)] motion-safe:animate-float-suave"
              />
              <div className="min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mb-3 mx-auto sm:mx-0 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                  <Moon size={22} className="text-gray-900" />
                </div>
                <h1 className="text-2xl font-extrabold text-white leading-tight">
                  <span className="text-gradient">Midnight Mentor</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Estuda de dia, revisa de noite. O sagui acompanha.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium text-center mb-3">
              Como você entra
            </p>

            <div className="space-y-3">
              {(Object.entries(ROLE_CONFIG) as [RoleEscolhivel, typeof ROLE_CONFIG['student']][]).map(([role, cfg]) => (
                <button
                  key={role}
                  onClick={() => escolherPapel(role)}
                  className="w-full glass rounded-2xl p-5 text-left hover:border-amber-500/20 transition-all group border border-white/5 flex items-center gap-4 press lift"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white shadow-lg shrink-0`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">{cfg.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{cfg.desc}</p>
                  </div>
                  <ChevronRight size={20} className="text-gray-600 group-hover:text-amber-400 transition-colors shrink-0" />
                </button>
              ))}
            </div>

            <div className="mt-6 text-xs text-center text-gray-400">
              <div className="glass-light rounded-xl px-4 py-2.5 inline-flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {isSupabaseConfigured() ? 'Conectado ao banco de dados' : 'Banco não configurado'}
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }

  /* ==================================================================
     Etapa 2: formulario
     ================================================================== */
  const roleCfg = ROLE_CONFIG[selectedRole];

  return (
    <Fragment>
      <ColorBlindnessToggle />
      <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#0b1120' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-amber-500/5 blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-orange-500/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-sm animate-fade-up relative z-10">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              <Moon size={28} className="text-gray-900" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">
              <span className="text-gradient">Midnight Mentor</span>
            </h1>
          </div>

          <div className="glass rounded-2xl p-7 relative overflow-hidden">
            {/* Estado de sucesso: o sagui aprova antes de entrar */}
            {sucesso && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0b1120]/95 animate-fade-in">
                <img loading="lazy"
                  src="/assets/sagui_aprovacao_2.png"
                  alt=""
                  width={128}
                  height={128}
                  className="w-32 h-32 object-contain motion-safe:animate-scale-in"
                />
                <p className="text-sm font-semibold text-amber-400">Boa. Bora estudar.</p>
              </div>
            )}

            <button
              onClick={voltarParaPapeis}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-400 transition-colors mb-3 -ml-2 px-2 min-h-[44px] press"
            >
              <ChevronLeft size={14} />
              Trocar perfil
            </button>

            {/* O `/10` do Tailwind so afeta a ULTIMA cor do gradiente, entao
                isto virava um bloco quase solido e a descricao sumia por
                falta de contraste. Fundo neutro, cor fica so no icone. */}
            <div className="rounded-xl bg-white/[0.04] border border-white/5 p-3 flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${roleCfg.gradient} flex items-center justify-center text-white shrink-0`}>
                {roleCfg.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{roleCfg.label}</p>
                <p className="text-xs text-gray-500">{roleCfg.desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">
                {isLogin ? 'Acessar' : 'Criar conta'}
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            {/* Banners de servidor/conexao (erros de campo vivem no form) */}
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-2.5 border border-red-500/10 animate-slide-up mb-4" role="alert">
                {error}
              </div>
            )}

            {aviso && (
              <div className="text-amber-300 text-sm bg-amber-500/10 rounded-xl px-4 py-2.5 border border-amber-500/15 animate-slide-up mb-4" role="status">
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

            <div className="mt-6 text-center">
              <button
                onClick={alternarModo}
                className="text-sm text-gray-500 hover:text-amber-400 transition-colors"
              >
                {isLogin ? 'Ainda não tem conta? ' : 'Já tem conta? '}
                <span className="text-amber-400 hover:text-amber-300 font-medium">
                  {isLogin ? 'Criar agora' : 'Entrar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
