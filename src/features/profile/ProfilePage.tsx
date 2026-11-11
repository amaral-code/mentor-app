import { useState, useEffect } from 'react';
import { Brain, Check, CheckCircle2, ClipboardList, Eye, EyeOff, Flame, Lightbulb, Lock, Moon, Star, XCircle, Zap } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { userRepository } from '../../shared/storage/UserRepository';
import { getEscolasCadastradas, getTurmasCadastradas } from '../../shared/lib/rankingEngine';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { calcLevel } from '../../shared/lib/utils';
import { AcessibilidadePanel } from '../../shared/ui/AcessibilidadePanel';
import { SecaoResponsaveis } from './SecaoResponsaveis';
import { AcessoPsicologo } from '../psicologia/AcessoPsicologo';
import { AvisoMensagens } from '../psicologia/AvisoMensagens';
import { hasProxy, testGeneration, getAIProviderInfo } from '../../shared/lib/aiService';
import type { Escola, Turma } from '../../shared/types';
import { CabecalhoPagina } from '../../shared/ui/CabecalhoPagina';

export function ProfilePage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);
  const setShowWeeklyReport = useAppStore((s) => s.setShowWeeklyReport);
  const gamification = useAppStore((s) => s.gamification);
  const apiKey = useAppStore((s) => s.apiKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const setToast = useAppStore((s) => s.setToast);
  const [nome, setNome] = useState(session?.nome || '');
  const [sobrenome, setSobrenome] = useState('');
  const [meta, setMeta] = useState('');
  const [keyInput, setKeyInput] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [aiTest, setAiTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [aiTestMsg, setAiTestMsg] = useState('');
  /* Nível via calcLevel (fonte única, igual à sidebar). */
  const { level: nivel, remainder: xpResto } = calcLevel(gamification.xp);
  const xpMeta = 100 * nivel;

  async function runAiTest() {
    setAiTest('testing');
    setAiTestMsg('');
    try {
      const r = (await testGeneration(apiKey)).slice(0, 120);
      setAiTest('ok');
      setAiTestMsg(r);
    } catch (e) {
      setAiTest('error');
      setAiTestMsg(e instanceof Error ? e.message : 'Falha na conexão com a IA');
    }
  }

  const [escolaId, setEscolaId] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);

  // Entrada na turma agora e por codigo do professor: escola_id e turma_id
  // definem qual ranking e qual mural o aluno ve, entao nao podem ser
  // escolhidos livremente pelo proprio aluno.
  const [codigoTurma, setCodigoTurma] = useState('');
  const [entrando, setEntrando] = useState(false);
  // Codigo confidencial da instituicao (8 letras, no email da secretaria).
  // Vincula a ESCOLA; a sala entra depois, pelo codigo da turma.
  const [codigoInst, setCodigoInst] = useState('');
  const [vinculando, setVinculando] = useState(false);

  const SECOES = [
    { id: 'secao-conta', rotulo: 'Conta' },
    { id: 'secao-escola', rotulo: 'Escola e códigos' },
    { id: 'secao-responsaveis', rotulo: 'Responsáveis' },
    { id: 'secao-psicologo', rotulo: 'Psicólogo' },
    { id: 'secao-acessibilidade', rotulo: 'Acessibilidade' },
    { id: 'secao-ia', rotulo: 'IA' },
  ];

  function irParaSecao(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    if (!session) return;
    setEscolaId(session.escolaId || '');
    setTurmaId(session.turmaId || '');
    // sobrenome/meta vem do perfil no banco; nao ha mais lista local de usuarios
    setSobrenome(session.nome.split(' ').slice(1).join(' '));
    setEscolas(getEscolasCadastradas());
    setTurmas(getTurmasCadastradas());
  }, [session]);

  async function handleEntrarNaTurma() {
    if (!codigoTurma.trim()) return;
    setEntrando(true);
    const { ok, erro } = await supabaseRepository.entrarNaTurma(codigoTurma.trim());
    setEntrando(false);
    if (!ok) { setToast(erro ?? 'Não foi possível entrar na turma.', 'error'); return; }
    setCodigoTurma('');
    setToast('Você entrou na turma!', 'success');
    // Recarrega para a sessao trazer escola/turma novas
    const nova = await userRepository.getSession();
    if (nova) useAppStore.getState().setSession(nova);
  }

  async function handleVincularInstituicao() {
    if (!codigoInst.trim()) return;
    setVinculando(true);
    const { ok, erro } = await supabaseRepository.vincularInstituicao(codigoInst.trim());
    setVinculando(false);
    if (!ok) { setToast(erro ?? 'Não foi possível vincular.', 'error'); return; }
    setCodigoInst('');
    setToast('Escola vinculada! Agora digite o código da turma.', 'success');
    const nova = await userRepository.getSession();
    if (nova) useAppStore.getState().setSession(nova);
  }

  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  function handleSaveProfile() {
    if (!session || salvandoPerfil) return;
    setSalvandoPerfil(true);
    userRepository
      .updateProfile({ nome, sobrenome: sobrenome || undefined, metaEstudo: meta || undefined })
      .then((ok) => setToast(ok ? 'Perfil atualizado!' : 'Não foi possível salvar.', ok ? 'success' : 'error'))
      .catch(() => setToast('Não foi possível salvar.', 'error'))
      .finally(() => setSalvandoPerfil(false));
  }

  function handleSaveKey() {
    setApiKey(keyInput.trim());
    setToast(keyInput.trim() ? 'Chave API salva!' : 'Chave removida', 'success');
  }


  return (
    <div className="space-y-5 animate-fade-up max-w-lg md:max-w-2xl mx-auto">
      {/* No computador a faixa colorida dá o tom da seção; no celular o
          avatar já abre a tela e a faixa só empurraria o conteúdo. */}
      <CabecalhoPagina className="hidden md:block" titulo="Seu perfil" subtitulo="Conta, escola, responsáveis e preferências" cor="ceu" pose="aprovacao" />

      {/* Cabeçalho do perfil: avatar redondo céu, nome em destaque e nível. */}
      <div className="flex flex-col items-center text-center pt-2">
        <div className="w-24 h-24 rounded-full bg-ceu-500 border-4 border-white shadow-lip-ceu flex items-center justify-center text-4xl font-black text-white">
          {session?.nome?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <h1 className="mt-3 text-2xl md:text-3xl font-black text-tinta-900">{session?.nome || 'Usuário'}</h1>
        <p className="text-sm font-semibold text-slate-500">{session?.email || ''}</p>
        <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-extrabold text-azul-600 bg-azul-100 px-3 py-1 rounded-full">
          <Star size={14} fill="currentColor" /> Nível {nivel} · Aspirante
        </span>
      </div>

      {/* Atalhos de seção: o perfil cresceu, o aluno pula direto ao assunto */}
      <nav aria-label="Seções do perfil" className="flex flex-wrap justify-center gap-2">
        {SECOES.map((s) => (
          <button
            key={s.id}
            onClick={() => irParaSecao(s.id)}
            className="px-3.5 py-2 rounded-xl bg-white border-2 border-slate-200 text-xs font-extrabold text-slate-600 hover:border-ceu-500 hover:text-ceu-600 transition-colors"
          >
            {s.rotulo}
          </button>
        ))}
      </nav>

      {/* Números do aluno (nível via calcLevel: fonte única, igual à sidebar),
          no formato "Cartão de número" do Figma. */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ofensiva', value: `${gamification.streak}d`, Icone: Flame, cor: 'bg-amber-500 border-amber-500', texto: 'text-amber-600' },
          { label: 'XP total', value: gamification.xp.toLocaleString('pt-BR'), Icone: Zap, cor: 'bg-ceu-500 border-ceu-500', texto: 'text-ceu-600' },
          { label: 'Nível', value: nivel, Icone: Star, cor: 'bg-azul-600 border-azul-600', texto: 'text-azul-600' },
        ].map(({ label, value, Icone, cor, texto }) => (
          <div key={label} className={`rounded-2xl border-2 overflow-hidden text-center ${cor}`}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-white py-1.5">{label}</p>
            <div className={`bg-white rounded-[13px] py-3 flex items-center justify-center gap-1.5 ${texto}`}>
              <Icone size={18} fill="currentColor" aria-hidden="true" />
              <span className="text-lg font-black tabular-nums">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* XP Bar (mesma conta da sidebar: resto e meta do nível atual) */}
      <div className="cartao p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-tinta-900">Progresso</h2>
          <span className="text-xs font-extrabold text-azul-600 bg-azul-100 px-2.5 py-1 rounded-full tabular-nums">Nível {nivel}</span>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-3xl font-black text-tinta-900 tabular-nums">{xpResto}</span>
          <span className="text-sm font-bold text-slate-500">/ {xpMeta} XP</span>
        </div>
        <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full bg-amber-500 xp-bar relative" style={{ width: `${(xpResto / xpMeta) * 100}%` }}>
            <span className="absolute left-2 right-2 top-1 h-1 rounded-full bg-white/35" aria-hidden="true" />
          </div>
        </div>
      </div>

      <SecaoResponsaveis />

      {/* Quem vê os meus dados, num lugar só: responsáveis e psicólogo. As
          notificações de acesso mandam o aluno "encerrar em Perfil", e até
          aqui o controle do psicólogo só existia na Rede de Apoio, que não
          tem entrada no menu do aluno. */}
      {session && (
        <div id="secao-psicologo" className="scroll-mt-24 space-y-3">
          <AvisoMensagens />
          <AcessoPsicologo aluno={{ id: session.uid, nome: session.nome }} papel="aluno" />
        </div>
      )}

      {/* Escola e codigos: vinculo por codigo confidencial (email da secretaria) */}
      <div id="secao-escola" className="glass-card rounded-2xl p-5 scroll-mt-24">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Escola e códigos</h2>
        <p className="text-xs text-slate-500 mb-4">Primeiro a instituição, depois a turma. Os códigos são secretos: não repasse a ninguém de fora.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Escola vinculada</label>
              <p className="text-sm text-tinta-900 glass-light rounded-xl px-3 py-2.5">
                {escolas.find(e => e.id === escolaId)?.nome ?? 'Nenhuma ainda'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Turma</label>
              <p className="text-sm text-tinta-900 glass-light rounded-xl px-3 py-2.5">
                {turmas.find(t => t.id === turmaId)?.nome ?? 'Nenhuma ainda'}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="codigo-instituicao" className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider"> 1. Código da instituição
            </label>
            <div className="flex gap-2">
              <input
                id="codigo-instituicao"
                value={codigoInst}
                onChange={e => setCodigoInst(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Ex: SOL2026A (veio no email)"
                maxLength={12}
                autoComplete="off"
                className="flex-1 text-sm tracking-widest uppercase"
              />
              <button
                onClick={handleVincularInstituicao}
                disabled={!codigoInst.trim() || vinculando}
                className="btn-primary text-xs px-4 py-2 shrink-0 disabled:opacity-40"
              >
                {vinculando ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="codigo-turma" className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider"> 2. Código da turma
            </label>
            <div className="flex gap-2">
              <input
                id="codigo-turma"
                value={codigoTurma}
                onChange={e => setCodigoTurma(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Ex: ABC123 (professor passa)"
                maxLength={12}
                autoComplete="off"
                className="flex-1 text-sm tracking-widest uppercase"
              />
              <button
                onClick={handleEntrarNaTurma}
                disabled={!codigoTurma.trim() || entrando}
                className="btn-primary text-xs px-4 py-2 shrink-0 disabled:opacity-40"
              >
                {entrando ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2"> O código da turma define qual ranking e qual mural você enxerga,
              por isso a turma não pode ser escolhida na lista.
            </p>
          </div>
        </div>
      </div>

      {/* Acessibilidade: fonte, contraste, movimento, daltonismo */}
      <AcessibilidadePanel />

      {/* Personal info */}
      <div id="secao-conta" className="glass-card rounded-2xl p-5 scroll-mt-24">
        <h2 className="text-sm font-semibold text-slate-700 mb-4"><ClipboardList size={16} className="inline-block align-[-0.15em] text-slate-600" /> Conta</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">E-mail</label>
            <input type="email" value={session?.email || ''} disabled className="w-full text-sm opacity-50" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Sobrenome</label>
            <input type="text" value={sobrenome} onChange={e => setSobrenome(e.target.value)} className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wider">Meta de Estudo</label>
            <input type="text" value={meta} onChange={e => setMeta(e.target.value)} className="w-full text-sm" placeholder="Ex: Medicina na USP" />
          </div>
          <button onClick={handleSaveProfile} disabled={salvandoPerfil} className="btn-primary w-full">{salvandoPerfil ? 'Salvando…' : 'Salvar alterações'}</button>
        </div>
      </div>

      {/* AI Settings */}
      <div id="secao-ia" className="glass-card rounded-2xl p-5 scroll-mt-24">
        <div className="flex items-center gap-3 mb-4">
          {/* Era gradiente roxo/azul com robozinho: o combo que a regra 5
              proibe. A identidade aqui e o sagui e o ambar da noite. */}
          <img
            src="/assets/sagui_estudando_2.png"
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="w-10 h-10 rounded-xl object-contain bg-amber-500/10 p-1"
          />
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Mentor avançado</h2>
            <p className="text-xs text-slate-500">Conecte sua chave para o sagui responder com mais profundidade.</p>
          </div>
        </div>
        {hasProxy() ? (
          <>
            <div className="flex items-start gap-2.5 text-xs text-emerald-600 bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/15">
              <span className="shrink-0"><Zap size={16} className="inline-block align-[-0.15em] text-amber-600" /></span>
              <span><strong>IA via servidor (proxy grátis).</strong> A inteligência do Midnight Mentor já está configurada, nenhuma chave necessária e pronto para usar. A chave fica protegida no servidor.</span>
            </div>

            <button
              onClick={runAiTest}
              disabled={aiTest === 'testing'}
              className="btn-secondary w-full mt-3"
            >
              {aiTest === 'testing' ? 'Testando conexão…' : ' Testar conexão com a IA'}
            </button>

            {aiTest === 'ok' && (
              <div className="flex items-start gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-xl px-3 py-2.5 mt-2 border border-emerald-500/15">
                <span className="shrink-0"><CheckCircle2 size={16} className="inline-block align-[-0.15em] text-emerald-600" /></span>
                <span>IA conectada! Resposta do modelo: <strong className="text-emerald-600">“{aiTestMsg}”</strong></span>
              </div>
            )}
            {aiTest === 'error' && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 rounded-xl px-3 py-2.5 mt-2 border border-red-500/15">
                <span className="shrink-0"><XCircle size={16} className="inline-block align-[-0.15em] text-red-600" /></span>
                <span>Falha: <code className="text-red-600 break-all">{aiTestMsg}</code></span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 mb-4">
              <span className="text-amber-600 shrink-0"><Lightbulb size={16} className="inline-block align-[-0.15em] text-amber-600" /></span>
              {getAIProviderInfo().provider === 'deepseek' ? (
                <span>Modelo <strong className="text-slate-700">deepseek-v4-flash</strong> via back-end (chave no servidor, nada no navegador). <strong className="text-slate-700">Não cole sua chave aqui.</strong></span>
              ) : (
                <span>Use sua chave <strong className="text-slate-700">Gemini API</strong> (gratuita) do Google AI Studio. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">Obter chave grátis</a></span>
              )}
            </div>

            {getAIProviderInfo().provider === 'deepseek' && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4">
                <span className="text-emerald-600 shrink-0"><Check size={16} className="inline-block align-[-0.15em]" /></span>
                <span>{hasProxy()
                  ? 'Back-end: worker publicado (produção).'
                  : 'Back-end de IA fora do ar. Defina DEEPSEEK_API_KEY nas Environment Variables do projeto e refaça o deploy.'}</span>
              </div>
            )}

            {getAIProviderInfo().provider !== 'deepseek' ? (
            <>
            <div className="relative mb-4">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="Cole sua chave Gemini API aqui..."
                className="w-full text-sm pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1.5"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={handleSaveKey} className="btn-primary flex-1" disabled={!keyInput.trim()}>
                {keyInput.trim() === apiKey ? 'Conectado ' : 'Conectar IA'}
              </button>
              {apiKey && (
                <button onClick={() => { setKeyInput(''); setApiKey(''); }} className="btn-ghost text-sm text-red-600 hover:text-red-600"> Remover
                </button>
              )}
            </div>

            {apiKey && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-500/5 rounded-xl px-3 py-2 border border-emerald-500/10">
                <span><Check size={16} className="inline-block align-[-0.15em] text-emerald-600" /></span> IA conectada. O chat usará IA generativa para respostas inteligentes.
              </div>
            )}

            {apiKey && (
              <>
                <button
                  onClick={runAiTest}
                  disabled={aiTest === 'testing'}
                  className="btn-secondary w-full mt-3 text-center"
                >
                  {aiTest === 'testing' ? 'Testando conexão…' : ' Testar conexão com a IA'}
                </button>
                {aiTest === 'ok' && (
                  <div className="flex items-start gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-xl px-3 py-2.5 mt-2 border border-emerald-500/15">
                    <span className="shrink-0"><CheckCircle2 size={16} className="inline-block align-[-0.15em] text-emerald-600" /></span>
                    <span>Conexão ok! Resposta: <em className="text-emerald-600">“{aiTestMsg}”</em></span>
                  </div>
                )}
                {aiTest === 'error' && (
                  <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 rounded-xl px-3 py-2.5 mt-2 border border-red-500/15">
                    <span className="shrink-0"><XCircle size={16} className="inline-block align-[-0.15em] text-red-600" /></span>
                    <span>Falha: <code className="text-red-600 break-all">{aiTestMsg}</code></span>
                  </div>
                )}
              </>
            )}
            </>
          ) : (
            <>
              <button
                onClick={runAiTest}
                disabled={aiTest === 'testing'}
                className="btn-secondary w-full mt-1 text-center"
              >
                {aiTest === 'testing' ? 'Testando conexão…' : ' Testar conexão com a IA'}
              </button>
              {aiTest === 'ok' && (
                <div className="flex items-start gap-2 text-xs text-emerald-600 bg-emerald-500/10 rounded-xl px-3 py-2.5 mt-2 border border-emerald-500/15">
                  <span className="shrink-0"><CheckCircle2 size={16} className="inline-block align-[-0.15em] text-emerald-600" /></span>
                  <span>Conexão ok! Resposta: <em className="text-emerald-600">“{aiTestMsg}”</em></span>
                </div>
              )}
              {aiTest === 'error' && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-500/10 rounded-xl px-3 py-2.5 mt-2 border border-red-500/15">
                  <span className="shrink-0"><XCircle size={16} className="inline-block align-[-0.15em] text-red-600" /></span>
                  <span>Falha: <code className="text-red-600 break-all">{aiTestMsg}</code></span>
                </div>
              )}
            </>
          )}
          </>
        )}
      </div>

      {/* Tools */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4"> Ferramentas</h2>
        <button onClick={() => setShowWeeklyReport(true)} className="btn-secondary w-full text-center"> Ver Relatório Semanal
        </button>
      </div>

      {/* About */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg"><Moon size={16} className="inline-block align-[-0.15em] text-amber-600" /></span>
          <h2 className="text-sm font-semibold text-slate-700">Midnight Mentor</h2>
        </div>
        <div className="text-sm text-slate-600 leading-relaxed space-y-2">
          <p><Brain size={16} className="inline-block align-[-0.15em] text-violet-600" /> Assistente de estudos inteligente para o ENEM.</p>
          <p><Lock size={16} className="inline-block align-[-0.15em] text-slate-500" /> <strong className="text-slate-700">Seus dados:</strong> ficam guardados na sua conta, protegidos por login. Só você decide quem acompanha, em Responsáveis e Psicólogo.</p>
          <p><Zap size={16} className="inline-block align-[-0.15em] text-amber-600" /> Sem internet ou com a IA fora do ar, o Mentor responde pela base local, que é mais limitada.</p>
        </div>
      </div>

      <button onClick={logout} className="btn-danger w-full text-center"> Sair da Conta
      </button>
    </div>
  );
}
