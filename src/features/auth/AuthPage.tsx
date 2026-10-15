import { useState, useEffect, useRef, useCallback, Fragment, memo } from 'react';
import { BookOpen, Building2, ChevronLeft, ChevronRight, Eye, EyeOff, GraduationCap, HeartHandshake } from 'lucide-react';
import { MoonLogo } from '../../shared/ui/MoonLogo';
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

/* Cada porta diz o que a pessoa vai encontrar do outro lado, e não um
   adjetivo ("Estudante focado no ENEM", "Acompanhamento pedagógico"):
   quem chega pela primeira vez escolhe pelo que vai fazer. Ícones na mesma
   cor, sem gradiente: a cor não distinguia nada que o nome não distinga. */
const ROLE_CONFIG: Record<RoleEscolhivel, { label: string; desc: string; icon: React.ReactNode }> = {
  student: {
    label: 'Sou estudante',
    desc: 'Plano do dia, Mentor para dúvidas, quiz e redação corrigida',
    icon: <GraduationCap size={20} />,
  },
  teacher: {
    label: 'Sou professor',
    desc: 'Como as suas turmas estão e o que vale revisar em aula',
    icon: <BookOpen size={20} />,
  },
  educator: {
    label: 'Sou da secretaria',
    desc: 'Matrículas, turmas, códigos de acesso e docentes',
    icon: <Building2 size={20} />,
  },
  parent: {
    label: 'Sou responsável',
    desc: 'Horas de estudo e acerto por matéria do estudante',
    icon: <HeartHandshake size={20} />,
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
   AuthPage raiz, entao CADA TECLA re-renderizava a pagina inteira e
   todos os irmaos. Aqui o input e NAO-CONTROLADO
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
      <label htmlFor={id} className="block text-sm text-gray-300 mb-1.5 font-medium">
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
          className={`w-full${comEspacoDireita ? ' pr-12' : ''}`}
        />
        {acaoDireita}
      </div>
      {erro && <p id={erroId} className="text-sm text-red-400 mt-1.5">{erro}</p>}
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
        className="btn-primary w-full h-12"
        disabled={loading}
      >
        {loading && <span className="w-4 h-4 anel-carregando rounded-full animate-spin" aria-hidden="true" />}
        {loading ? (isLogin ? 'Entrando...' : 'Criando a conta...') : (isLogin ? 'Entrar' : 'Criar conta')}
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
        <div className="min-h-dvh bg-mesa">
          <div className="mx-auto max-w-5xl px-5 py-10 md:py-16 grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16 md:items-center min-h-dvh">
            {/* Lado do produto: o que é, em frases que só caberiam neste
                app. O sagui é a identidade e fica, pequeno. */}
            <section className="animate-fade-in">
              <div className="flex items-center gap-2.5">
                <MoonLogo className="w-8 h-8" />
                <span className="font-display text-xl font-semibold text-white">Midnight Mentor</span>
              </div>
              <h1 className="mt-8 text-[2rem] md:text-[2.5rem] leading-[1.15] text-white">
                Estudo para o ENEM que cabe na rotina de quem estuda à noite.
              </h1>
              <p className="mt-4 text-[0.9375rem] text-gray-400 max-w-md">
                Um plano por dia, montado com o seu sono e o seu cansaço. Um Mentor que responde dúvida de prova.
                Redação corrigida pelas cinco competências. E a escola e a família vendo como você vai, sem ler as suas conversas.
              </p>
              <div className="mt-8 hidden md:flex items-end gap-4">
                <img src="/assets/sagui_pulando_2.png" alt="" width={88} height={88} className="w-[88px] h-[88px] object-contain" />
                <p className="text-sm text-gray-500 pb-3 max-w-[16rem]">O sagui é o mascote: aparece quando você acerta, quando precisa de pausa e quando é hora de dormir.</p>
              </div>
            </section>

            <section aria-labelledby="entrar-titulo" className="animate-fade-in">
              <h2 id="entrar-titulo" className="text-lg text-white">Como você vai usar</h2>
              <p className="text-sm text-gray-500 mt-0.5">Cada perfil tem a sua própria área.</p>
              <ul className="mt-4 painel rounded-2xl overflow-hidden pauta">
                {(Object.entries(ROLE_CONFIG) as [RoleEscolhivel, typeof ROLE_CONFIG['student']][]).map(([role, cfg]) => (
                  <li key={role}>
                    <button
                      onClick={() => escolherPapel(role)}
                      className="w-full px-4 py-4 text-left flex items-center gap-4 group hover:bg-folha-2 transition-colors"
                    >
                      <span className="w-10 h-10 rounded-md border border-linha-forte flex items-center justify-center text-gray-300 group-hover:text-amber-400 group-hover:border-amber-500/50 transition-colors shrink-0">
                        {cfg.icon}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[0.9375rem] font-semibold text-white">{cfg.label}</span>
                        <span className="block text-sm text-gray-500 mt-0.5">{cfg.desc}</span>
                      </span>
                      <ChevronRight size={18} className="text-gray-600 group-hover:text-amber-400 transition-colors shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-4">
                Psicólogos entram com a conta criada e conferida pela equipe, por qualquer uma das portas.
              </p>
              {/* "Conectado ao banco de dados" era dito a todo visitante;
                  só a falha muda o que a pessoa pode fazer. */}
              {!isSupabaseConfigured() && (
                <p role="alert" className="mt-4 text-sm text-red-300 border-l-2 border-red-400 pl-3">
                  O app está sem conexão com o banco de dados, então ninguém consegue entrar agora. Avise a escola.
                </p>
              )}
            </section>
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
      <div className="min-h-dvh flex items-center justify-center px-5 py-10 bg-mesa">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex items-center gap-2.5 mb-8">
            <MoonLogo className="w-7 h-7" />
            <span className="font-display text-lg font-semibold text-white">Midnight Mentor</span>
          </div>

          <div className="relative">
            {/* Estado de sucesso: o sagui aprova antes de entrar */}
            {sucesso && (
              <div className="absolute -inset-4 z-20 flex flex-col items-center justify-center gap-3 bg-mesa/95 animate-fade-in" role="status">
                <img loading="lazy"
                  src="/assets/sagui_aprovacao_2.png"
                  alt=""
                  width={112}
                  height={112}
                  className="w-28 h-28 object-contain motion-safe:animate-scale-in"
                />
                <p className="text-sm font-semibold text-amber-400">Boa. Bora estudar.</p>
              </div>
            )}

            <button
              onClick={voltarParaPapeis}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors -ml-2 px-2 min-h-[44px]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {roleCfg.label}: trocar
            </button>

            <h1 className="text-[1.75rem] text-white mt-2">{isLogin ? 'Entrar' : 'Criar conta'}</h1>
            <p className="text-sm text-gray-500 mt-1 mb-6">{roleCfg.desc}.</p>

            {/* Banners de servidor/conexao (erros de campo vivem no form) */}
            {error && (
              <p className="text-red-300 text-sm border-l-2 border-red-400 pl-3 py-1 animate-slide-up mb-5" role="alert">
                {error}
              </p>
            )}

            {aviso && (
              <p className="text-amber-300 text-sm border-l-2 border-amber-400 pl-3 py-1 animate-slide-up mb-5" role="status">
                {aviso}
              </p>
            )}

            {/* key reseta os inputs nao-controlados ao trocar de modo */}
            <AuthForm
              key={isLogin ? 'login' : 'cadastro'}
              isLogin={isLogin}
              loading={loading}
              onSubmit={handleAutenticar}
            />

            <div className="mt-6 pt-5 border-t border-linha text-sm text-gray-400">
              {isLogin ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
              <button
                onClick={alternarModo}
                className="text-amber-400 hover:text-amber-300 font-medium underline-offset-4 hover:underline"
              >
                {isLogin ? 'Criar agora' : 'Entrar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
