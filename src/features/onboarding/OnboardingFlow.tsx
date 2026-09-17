import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, MoonStar, Rocket, Sunrise, Sunset, Target } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { userRepository } from '../../shared/storage/UserRepository';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { safeSet } from '../../shared/lib/safeStorage';
import { marcarOnboardingLocal } from '../../shared/lib/onboardingLocal';

/**
 * ONBOARDING INTELIGENTE — wizard de primeiro acesso (tela cheia).
 *
 * Separação "primeiro acesso" x "recorrente": quem tem
 * `session.onboardingCompleted === false` cai aqui e NÃO vê sidebar nem
 * painel até concluir o passo 4.
 *
 * PERFORMANCE: todo o estado do fluxo (passo, chips, seleções) é
 * useState LOCAL deste componente. A única assinatura do store é a ação
 * `concluirOnboardingLocal` (estável, nunca dispara render). Cliques nos
 * chips re-renderizam só este wizard — o App e o resto da árvore nem
 * ficam sabendo. Toast/erro via getState(), sem assinar nada.
 */

const METAS = [
  'Passar no ENEM',
  'Não reprovar de ano',
  'Aprender Programação',
  'Passar em concurso',
  'Melhorar as notas',
  'Criar rotina de estudos',
] as const;

const TEMPOS = ['15 min', '30 min', '1 hora', 'Mais de 2 horas'] as const;

const TURNOS = [
  { id: 'manha', rotulo: 'Manhã', icone: Sunrise },
  { id: 'tarde', rotulo: 'Tarde', icone: Sunset },
  { id: 'noite', rotulo: 'Noite', icone: MoonStar },
] as const;

const TOTAL_PASSOS = 4;

export function OnboardingFlow() {
  const [passo, setPasso] = useState(1);
  const [metas, setMetas] = useState<string[]>([]);
  const [tempo, setTempo] = useState<string | null>(null);
  const [turno, setTurno] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Ações estáveis: assinar ação não re-renderiza nunca.
  const concluirLocal = useAppStore((s) => s.concluirOnboardingLocal);
  const primeiroNome = (useAppStore.getState().session?.nome ?? '').split(/\s+/)[0] || 'estudante';

  function alternarMeta(meta: string) {
    setMetas((atuais) => (atuais.includes(meta) ? atuais.filter((m) => m !== meta) : [...atuais, meta]));
  }

  const podeAvancar =
    passo === 1 || passo === 4 || (passo === 2 && metas.length > 0) || (passo === 3 && !!tempo && !!turno);

  async function finalizar() {
    if (!tempo || !turno || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      // Persiste no perfil; se o banco falhar (offline, migration pendente),
      // segue local — ninguém fica preso no wizard por causa de infra.
      const ok = await userRepository.concluirOnboarding({ metas, tempoDiario: tempo, turno });
      concluirLocal({ metas, tempoDiario: tempo, turno });
      /* Marca DURAVEL, nao so em memoria: a volta para a aba recarrega o
         perfil do banco e sobrescreve a memoria. Sem isto, banco que nao
         consegue guardar a flag = wizard a cada troca de aba. */
      marcarOnboardingLocal(useAppStore.getState().session?.uid ?? '');
      // O tour guiado antigo cobriria a mesma coisa de novo: marca como
      // visto para o recém-chegado cair direto no app configurado.
      supabaseRepository.savePreferencias({ tutorial_completo: true }).catch(() => {});
      safeSet('mm_tour_visto', '1');
      if (!ok) {
        useAppStore.getState().setToast('Preferências salvas neste aparelho. Sincronizamos quando a rede voltar.', 'info');
      }
    } catch (e) {
      // Falha total: mesmo assim libera (store local), avisando.
      concluirLocal({ metas, tempoDiario: tempo, turno });
      marcarOnboardingLocal(useAppStore.getState().session?.uid ?? '');
      setErro(e instanceof Error ? e.message : 'Erro de conexão');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#0b1120' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-amber-500/5 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-md animate-fade-up relative z-10">
        {/* Progresso */}
        <div className="flex items-center gap-1.5 mb-6" aria-label={`Passo ${passo} de ${TOTAL_PASSOS}`}>
          {Array.from({ length: TOTAL_PASSOS }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i + 1 < passo ? 'bg-amber-400/50' : i + 1 === passo ? 'bg-amber-400' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        <div className="glass rounded-3xl p-7 relative overflow-hidden">
          {passo === 1 && (
            <div className="text-center">
              <img
                src="/assets/sagui_pulando_2.png"
                alt="Sagui dando boas-vindas"
                width={128}
                height={128}
                className="w-32 h-32 object-contain mx-auto drop-shadow-[0_8px_24px_rgba(245,158,11,0.18)] motion-safe:animate-float-suave"
              />
              <h1 className="text-xl font-extrabold text-white mt-4">
                Boas-vindas, {primeiroNome}!
              </h1>
              <p className="text-sm text-gray-400 leading-relaxed mt-2">
                Eu sou o <strong className="text-amber-300">Sagui</strong>, e vou montar seus estudos
                do seu jeito. Chegou cansado do trabalho? Sem culpa: o app se adapta ao
                seu cansaço e pede só o que dá para hoje.
              </p>
              <p className="text-xs text-gray-500 mt-3">4 passinhos rápidos e já liberamos tudo.</p>
            </div>
          )}

          {passo === 2 && (
            <div>
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mb-4">
                <Target size={20} className="text-gray-900" />
              </span>
              <h1 className="text-xl font-extrabold text-white">O que você quer conquistar?</h1>
              <p className="text-sm text-gray-500 mt-1 mb-4">Pode marcar mais de um. Vale mudar depois.</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Metas de estudo">
                {METAS.map((meta) => {
                  const ativa = metas.includes(meta);
                  return (
                    <button
                      key={meta}
                      type="button"
                      onClick={() => alternarMeta(meta)}
                      aria-pressed={ativa}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold border transition-all min-h-[44px] active:scale-95 ${
                        ativa
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_14px_rgba(245,158,11,0.2)]'
                          : 'bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-200'
                      }`}
                    >
                      {ativa && <Check size={13} />}
                      {meta}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {passo === 3 && (
            <div>
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center mb-4">
                <Clock size={20} className="text-white" />
              </span>
              <h1 className="text-xl font-extrabold text-white">Quanto tempo você tem por dia?</h1>
              <p className="text-sm text-gray-500 mt-1 mb-4">Sinceridade aqui vira plano que funciona.</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tempo diário">
                {TEMPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTempo(t)}
                    aria-pressed={tempo === t}
                    className={`py-3.5 rounded-xl text-sm font-bold border transition-all min-h-[52px] active:scale-95 ${
                      tempo === t
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-5 mb-2 font-medium">E o turno principal?</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Turno principal">
                {TURNOS.map((t) => {
                  const Icone = t.icone;
                  const ativo = turno === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTurno(t.id)}
                      aria-pressed={ativo}
                      className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold border transition-all min-h-[52px] active:scale-95 ${
                        ativo
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : 'bg-white/[0.03] text-gray-400 border-white/10 hover:text-gray-200'
                      }`}
                    >
                      <Icone size={17} />
                      {t.rotulo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {passo === 4 && (
            <div className="text-center">
              <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                <Rocket size={24} className="text-white" />
              </span>
              <h1 className="text-xl font-extrabold text-white">Tudo pronto!</h1>
              <p className="text-sm text-gray-400 leading-relaxed mt-2">
                {metas.length > 0 && (
                  <>Vamos mirar em <strong className="text-amber-300">{metas.join(', ')}</strong>, </>
                )}
                {tempo && turno && (
                  <>com <strong className="text-amber-300">{tempo} por dia</strong> no período da{' '}
                  <strong className="text-amber-300">{turno === 'manha' ? 'manhã' : turno}</strong>.</>
                )}
              </p>
              {erro && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2 mt-3" role="alert">{erro}</p>
              )}
            </div>
          )}

          {/* Navegação */}
          <div className="flex items-center justify-between gap-3 mt-7">
            {passo > 1 ? (
              <button
                type="button"
                onClick={() => setPasso((p) => p - 1)}
                disabled={salvando}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-amber-400 transition-colors min-h-[44px] px-2 disabled:opacity-40"
              >
                <ArrowLeft size={15} /> Voltar
              </button>
            ) : (
              <span />
            )}
            {passo < TOTAL_PASSOS ? (
              <button
                type="button"
                onClick={() => podeAvancar && setPasso((p) => p + 1)}
                disabled={!podeAvancar}
                className="btn-primary px-6 h-12 inline-flex items-center gap-2 disabled:opacity-40"
              >
                Continuar <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={finalizar}
                disabled={salvando}
                className="btn-primary px-6 h-12 inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {salvando && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {salvando ? 'Preparando tudo…' : 'Começar minha jornada'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
