import { useState, useEffect } from 'react';
import { Check, CheckCircle2, ClipboardList, Eye, EyeOff, Lightbulb, XCircle, Zap } from 'lucide-react';
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

  /* Na MESMA ordem em que as seções aparecem na página: antes a lista
     começava por "Conta", que era a quarta seção, e o índice parecia
     embaralhado. */
  const SECOES = [
    { id: 'secao-responsaveis', rotulo: 'Responsáveis' },
    { id: 'secao-psicologo', rotulo: 'Psicólogo' },
    { id: 'secao-escola', rotulo: 'Escola e códigos' },
    { id: 'secao-acessibilidade', rotulo: 'Acessibilidade' },
    { id: 'secao-conta', rotulo: 'Conta' },
    { id: 'secao-ia', rotulo: 'IA' },
    { id: 'secao-dados', rotulo: 'Seus dados' },
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
    <div className="max-w-5xl mx-auto">
      <header className="pb-6 border-b border-linha">
        <h1 className="text-[1.75rem] text-white">{session?.nome || 'Estudante'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{session?.email || ''}</p>
        {/* Nível, XP e sequência em uma linha: os três cartões e a barra
            de progresso que ficavam aqui repetiam a Central e a barra
            lateral, e empurravam as configurações para baixo. */}
        <p className="text-sm text-gray-400 mt-3">
          Nível <span className="text-white font-medium">{nivel}</span>
          <span className="text-gray-600"> · </span>
          <span className="font-mono text-white">{xpResto}</span> de {xpMeta} XP para o próximo
          <span className="text-gray-600"> · </span>
          {gamification.streak} {gamification.streak === 1 ? 'dia seguido' : 'dias seguidos'}
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10 pt-6">
        {/* Índice das seções: fixo ao lado no computador, uma linha de
            atalhos no celular. */}
        <nav aria-label="Seções do perfil" className="mb-6 lg:mb-0">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-0 lg:sticky lg:top-8">
            {SECOES.map((sec) => (
              <li key={sec.id}>
                <button
                  onClick={() => irParaSecao(sec.id)}
                  className="text-sm text-gray-400 hover:text-white py-1.5 lg:w-full lg:text-left lg:px-3 lg:-mx-3 lg:rounded-md lg:hover:bg-folha-2 transition-colors"
                >
                  {sec.rotulo}
                </button>
              </li>
            ))}
            <li className="hidden lg:block mt-3 pt-3 border-t border-linha">
              <button onClick={logout} className="text-sm text-gray-400 hover:text-red-300 py-1.5">Sair da conta</button>
            </li>
          </ul>
        </nav>

        <div className="space-y-6 min-w-0">
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
      <div id="secao-escola" className="painel rounded-2xl p-5 scroll-mt-24">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">Escola e códigos</h2>
        <p className="text-xs text-gray-500 mb-4">Primeiro a instituição, depois a turma. Os códigos são secretos: não repasse a ninguém de fora.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Escola vinculada</label>
              <p className="text-sm text-white painel-suave rounded-xl px-3 py-2.5">
                {escolas.find(e => e.id === escolaId)?.nome ?? 'Nenhuma ainda'}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Turma</label>
              <p className="text-sm text-white painel-suave rounded-xl px-3 py-2.5">
                {turmas.find(t => t.id === turmaId)?.nome ?? 'Nenhuma ainda'}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="codigo-instituicao" className="block text-xs text-gray-500 mb-1.5 font-medium"> 1. Código da instituição
            </label>
            <div className="flex gap-2">
              <input
                id="codigo-instituicao"
                value={codigoInst}
                onChange={e => setCodigoInst(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Ex: SOL2026A (veio no email)"
                maxLength={12}
                autoComplete="off"
                className="flex-1 text-sm"
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
            <label htmlFor="codigo-turma" className="block text-xs text-gray-500 mb-1.5 font-medium"> 2. Código da turma
            </label>
            <div className="flex gap-2">
              <input
                id="codigo-turma"
                value={codigoTurma}
                onChange={e => setCodigoTurma(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="Ex: ABC123 (professor passa)"
                maxLength={12}
                autoComplete="off"
                className="flex-1 text-sm"
              />
              <button
                onClick={handleEntrarNaTurma}
                disabled={!codigoTurma.trim() || entrando}
                className="btn-primary text-xs px-4 py-2 shrink-0 disabled:opacity-40"
              >
                {entrando ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2"> O código da turma define qual ranking e qual mural você enxerga,
              por isso a turma não pode ser escolhida na lista.
            </p>
          </div>
        </div>
      </div>

      {/* Acessibilidade: fonte, contraste, movimento, daltonismo */}
      <AcessibilidadePanel />

      {/* Personal info */}
      <div id="secao-conta" className="painel rounded-2xl p-5 scroll-mt-24">
        <h2 className="text-sm font-semibold text-gray-300 mb-4"><ClipboardList size={16} className="inline-block align-[-0.15em] text-gray-400" /> Conta</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">E-mail</label>
            <input type="email" value={session?.email || ''} disabled className="w-full text-sm opacity-50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Sobrenome</label>
            <input type="text" value={sobrenome} onChange={e => setSobrenome(e.target.value)} className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">Meta de Estudo</label>
            <input type="text" value={meta} onChange={e => setMeta(e.target.value)} className="w-full text-sm" placeholder="Ex: Medicina na USP" />
          </div>
          <button onClick={handleSaveProfile} disabled={salvandoPerfil} className="btn-primary w-full">{salvandoPerfil ? 'Salvando…' : 'Salvar alterações'}</button>
        </div>
      </div>

      {/* AI Settings */}
      <div id="secao-ia" className="painel rounded-2xl p-5 scroll-mt-24">
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
            <h2 className="text-lg text-white">IA</h2>
            <p className="text-sm text-gray-500">
              {hasProxy() ? 'O Mentor, o quiz e a correção de redação usam a IA do servidor do app.' : 'Sem IA no servidor, dá para usar a sua própria chave.'}
            </p>
          </div>
        </div>
        {hasProxy() ? (
          <>
            <div className="flex items-start gap-2.5 text-xs text-emerald-300 bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/15">
              <span className="shrink-0"><Zap size={16} className="inline-block align-[-0.15em] text-amber-400" /></span>
              <span><strong>Já está ligada.</strong> Não precisa de chave: ela fica guardada no servidor, nunca neste aparelho.</span>
            </div>

            <button
              onClick={runAiTest}
              disabled={aiTest === 'testing'}
              className="btn-secondary w-full mt-3"
            >
              {aiTest === 'testing' ? 'Testando conexão…' : ' Testar conexão com a IA'}
            </button>

            {aiTest === 'ok' && (
              <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2.5 mt-2 border border-emerald-500/15">
                <span className="shrink-0"><CheckCircle2 size={16} className="inline-block align-[-0.15em] text-emerald-400" /></span>
                <span>IA conectada! Resposta do modelo: <strong className="text-emerald-200">“{aiTestMsg}”</strong></span>
              </div>
            )}
            {aiTest === 'error' && (
              <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 rounded-xl px-3 py-2.5 mt-2 border border-red-500/15">
                <span className="shrink-0"><XCircle size={16} className="inline-block align-[-0.15em] text-red-400" /></span>
                <span>Falha: <code className="text-red-200 break-all">{aiTestMsg}</code></span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 mb-4">
              <span className="text-amber-400 shrink-0"><Lightbulb size={16} className="inline-block align-[-0.15em] text-amber-400" /></span>
              {getAIProviderInfo().provider === 'deepseek' ? (
                <span>Modelo <strong className="text-gray-300">deepseek-v4-flash</strong> via back-end (chave no servidor, nada no navegador). <strong className="text-gray-300">Não cole sua chave aqui.</strong></span>
              ) : (
                <span>Use sua chave <strong className="text-gray-300">Gemini API</strong> (gratuita) do Google AI Studio. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline">Obter chave grátis</a></span>
              )}
            </div>

            {getAIProviderInfo().provider === 'deepseek' && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-white/[0.03] rounded-xl p-3 border border-white/5 mb-4">
                <span className="text-emerald-400 shrink-0"><Check size={16} className="inline-block align-[-0.15em]" /></span>
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1.5"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={handleSaveKey} className="btn-primary flex-1" disabled={!keyInput.trim()}>
                {keyInput.trim() === apiKey ? 'Conectado ' : 'Conectar IA'}
              </button>
              {apiKey && (
                <button onClick={() => { setKeyInput(''); setApiKey(''); }} className="btn-ghost text-sm text-red-400 hover:text-red-300"> Remover
                </button>
              )}
            </div>

            {apiKey && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/5 rounded-xl px-3 py-2 border border-emerald-500/10">
                <span><Check size={16} className="inline-block align-[-0.15em] text-emerald-400" /></span> Chave salva. O Mentor, o quiz e a correção passam a usar a IA com ela.
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
                  <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2.5 mt-2 border border-emerald-500/15">
                    <span className="shrink-0"><CheckCircle2 size={16} className="inline-block align-[-0.15em] text-emerald-400" /></span>
                    <span>Conexão ok! Resposta: <em className="text-emerald-200">“{aiTestMsg}”</em></span>
                  </div>
                )}
                {aiTest === 'error' && (
                  <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 rounded-xl px-3 py-2.5 mt-2 border border-red-500/15">
                    <span className="shrink-0"><XCircle size={16} className="inline-block align-[-0.15em] text-red-400" /></span>
                    <span>Falha: <code className="text-red-200 break-all">{aiTestMsg}</code></span>
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
                <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2.5 mt-2 border border-emerald-500/15">
                  <span className="shrink-0"><CheckCircle2 size={16} className="inline-block align-[-0.15em] text-emerald-400" /></span>
                  <span>Conexão ok! Resposta: <em className="text-emerald-200">“{aiTestMsg}”</em></span>
                </div>
              )}
              {aiTest === 'error' && (
                <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 rounded-xl px-3 py-2.5 mt-2 border border-red-500/15">
                  <span className="shrink-0"><XCircle size={16} className="inline-block align-[-0.15em] text-red-400" /></span>
                  <span>Falha: <code className="text-red-200 break-all">{aiTestMsg}</code></span>
                </div>
              )}
            </>
          )}
          </>
        )}
      </div>

      <section className="painel rounded-2xl p-5">
        <h2 className="text-lg text-white">Relatório da semana</h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-4">Horas, acertos e humor dos últimos 7 dias, num resumo só.</p>
        <button onClick={() => setShowWeeklyReport(true)} className="btn-secondary">Abrir o relatório</button>
      </section>

      {/* "Privacidade total: dados salvos apenas no navegador" estava
          aqui, e era falso: conversa, caderno e estudo ficam na conta, no
          banco. O texto agora diz onde ficam e quem vê o quê, que é o que
          as regras de acesso (RLS) de fato garantem. */}
      <section id="secao-dados" className="painel rounded-2xl p-5 scroll-mt-24">
        <h2 className="text-lg text-white">Seus dados</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-300 leading-relaxed">
          <li>Ficam na sua conta, no banco do app, e não só neste aparelho: você entra de outro celular e encontra tudo.</li>
          <li>Conversas com o Mentor, caderno e humor são só seus. Nem responsável, nem escola, nem psicólogo leem.</li>
          <li>Responsáveis veem números: horas de estudo, acerto por matéria e dias ativos.</li>
          <li>O psicólogo só vê o que você (ou, abaixo de 16 anos, o seu responsável) autorizar, e por tempo limitado.</li>
        </ul>
      </section>

      <button onClick={logout} className="btn-danger w-full lg:hidden">Sair da conta</button>
        </div>
      </div>
    </div>
  );
}
