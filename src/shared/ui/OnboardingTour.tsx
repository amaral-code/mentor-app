import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { TabId } from '../types';
import { Mascot } from './Mascot';
import { AppIcon } from './AppIcon';
import { supabaseRepository } from '../storage/SupabaseRepository';
import { safeSet } from '../lib/safeStorage';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: string;
  tab: TabId;
  targetSelector?: string;
}

const STEPS: Step[] = [
  { id: 'welcome', title: 'Bem-vindo ao Midnight Mentor!', description: 'Vamos fazer um tour rápido pelo seu novo assistente de estudos para o ENEM. Conheça cada ferramenta e comece a estudar com inteligência.', icon: 'luaCheia', tab: 'dashboard' },
  { id: 'dashboard', title: 'Central de Estudos', description: 'Seu painel principal. Veja o plano de estudos do dia, registre seu humor, acompanhe seu SSC e gerencie suas tarefas diárias.', icon: 'bussola', tab: 'dashboard', targetSelector: '[data-tab="dashboard"]' },
  { id: 'chat', title: 'Mentor', description: 'Converse com o sagui. Tire dúvidas, receba dicas de estudo e suporte emocional personalizado.', icon: 'marcador', tab: 'chat', targetSelector: '[data-tab="chat"]' },
  { id: 'essay', title: 'Redação 1000', description: 'Pratique redação no formato ENEM. Receba correção automática com nota por cada competência.', icon: 'escrita', tab: 'essay', targetSelector: '[data-tab="essay"]' },
  { id: 'foco', title: 'Modo Foco', description: 'Use o modo foco para estudar em blocos curtos, manter ritmo e evitar distrações.', icon: 'cronometro', tab: 'foco', targetSelector: '[data-tab="foco"]' },
  { id: 'quiz', title: 'Quiz Interativo', description: 'Teste seus conhecimentos com perguntas de múltipla escolha. Ganhe XP e veja seu progresso.', icon: 'alvo', tab: 'quiz', targetSelector: '[data-tab="quiz"]' },
  { id: 'comunidade', title: 'Ligas de estudo', description: 'Entre em ligas da sua turma, complete metas e use o chat focado da sua equipe.', icon: 'trofeu', tab: 'comunidade', targetSelector: '[data-tab="comunidade"]' },
  { id: 'ranking', title: 'Ranking e evolução', description: 'Acompanhe sua posição, evolução e os resultados das suas atividades de estudo.', icon: 'subida', tab: 'ranking', targetSelector: '[data-tab="ranking"]' },
  { id: 'notebook', title: 'Caderno de Estudos', description: 'Crie anotações organizadas com tags e busca rápida. Seu material de revisão sempre à mão.', icon: 'caderno', tab: 'notebook', targetSelector: '[data-tab="notebook"]' },
  { id: 'profile', title: 'Perfil e Progresso', description: 'Acompanhe seu nível, XP total, sequência de dias de estudo e todo seu histórico.', icon: 'estrela', tab: 'profile', targetSelector: '[data-tab="profile"]' },
  { id: 'done', title: 'Tudo pronto! ', description: 'Agora você conhece todas as ferramentas. Explore cada aba, complete seus planos e evolua seu nível. Bons estudos!', icon: 'festa', tab: 'dashboard' },
];

interface Rect { top: number; left: number; width: number; height: number; }

function SpotlightOverlay({ rect, padding = 12 }: { rect: Rect; padding?: number }) {
  const r = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  return (
    <>
      {/* Top bar - from top of screen to top of target */}
      <div className="fixed z-[199] bg-black/70" style={{ top: 0, left: 0, right: 0, height: r.top, pointerEvents: 'auto' }} />
      {/* Bottom bar - from bottom of target to bottom of screen */}
      <div className="fixed z-[199] bg-black/70" style={{ left: 0, right: 0, top: r.top + r.height, bottom: 0, pointerEvents: 'auto' }} />
      {/* Left bar - between top and bottom, left side to target */}
      <div className="fixed z-[199] bg-black/70" style={{ top: r.top, left: 0, width: r.left, height: r.height, pointerEvents: 'auto' }} />
      {/* Right bar - between top and bottom, target right to screen edge */}
      <div className="fixed z-[199] bg-black/70" style={{ top: r.top, left: r.left + r.width, right: 0, height: r.height, pointerEvents: 'auto' }} />
      {/* Glowing border around the cutout */}
      <div
        className="fixed z-[200] rounded-xl pointer-events-none"
        style={{
          top: r.top - 2,
          left: r.left - 2,
          width: r.width + 4,
          height: r.height + 4,
          border: '2px solid rgba(245, 158, 11, 0.7)',
          boxShadow: '0 0 24px rgba(245, 158, 11, 0.4), inset 0 0 12px rgba(245, 158, 11, 0.05)',
        }}
      />
    </>
  );
}

export function OnboardingTour() {
  const { showTutorial, tutorialStep, setShowTutorial, setTutorialStep, setActiveTab, addXP, addLog } = useAppStore();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<'bottom' | 'top' | 'right'>('bottom');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTutorial) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [showTutorial]);

  const locateTarget = useCallback(() => {
    const step = STEPS[tutorialStep];
    if (!step.targetSelector) { setTargetRect(null); return; }
    // Primeiro VISÍVEL: no iPhone a sidebar some (drawer fechado) e o
    // querySelector puro achava o botão escondido — spotlight no vazio.
    const el = [...document.querySelectorAll<HTMLElement>(step.targetSelector)]
      .find((c) => c.offsetParent !== null) ?? null;
    if (el) {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const cardHeight = 340;
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setCardPos(r.top + r.height + cardHeight > vh ? 'top' : 'bottom');
    } else {
      setTargetRect(null);
    }
  }, [tutorialStep]);

  useEffect(() => {
    if (!showTutorial) {
      setTargetRect(null);
      // Fecha o menu que o tour pode ter aberto no celular.
      window.dispatchEvent(new CustomEvent('mm:tour-menu', { detail: { open: false } }));
      return;
    }
    const step = STEPS[tutorialStep];
    setActiveTab(step.tab);
    if (!step.targetSelector) {
      window.dispatchEvent(new CustomEvent('mm:tour-menu', { detail: { open: false } }));
    } else if (window.innerWidth < 768) {
      // Celular: abre o menu ANTES de medir. Medir com o drawer fechado ou
      // no meio da animação gerava destaque pequeno e fora do lugar — era
      // o "dourado não preenche o bloco".
      window.dispatchEvent(new CustomEvent('mm:tour-menu', { detail: { open: true } }));
    }
    // Mede DEPOIS da animação (drawer/página lazy): 350ms e 900ms. Medir
    // cedo demais achava o botão andando e o brilho ficava torto.
    const t1 = setTimeout(locateTarget, 350);
    const t2 = setTimeout(locateTarget, 900);
    window.addEventListener('resize', locateTarget);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('resize', locateTarget);
    };
  }, [showTutorial, tutorialStep, setActiveTab, locateTarget]);

  if (!showTutorial) return null;

  const step = STEPS[tutorialStep];
  const isFirst = tutorialStep === 0;
  const isLast = tutorialStep === STEPS.length - 1;
  const hasTarget = !!step.targetSelector && !!targetRect;
  // BUG CORRIGIDO: quando o cartão ficava ACIMA do alvo, o código usava
  // `bottom: alvo.topo + alvo.altura` — ou seja, media a partir do lado
  // errado e jogava o cartão para fora da tela, sem botão clicável, e o
  // tour travava. O certo é medir a partir do rodapé da viewport.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  function marcarVisto() {
    // Servidor + backup local (conta nova sem linha de preferências ou
    // offline): sem o backup, o tour voltava a cada boot.
    supabaseRepository.savePreferencias({ tutorial_completo: true }).catch(() => {});
    safeSet('mm_tour_visto', '1');
  }

  function handleNext() {
    if (isLast) {
      // Silencio proposital: marca que o tour ja foi visto. Falhar so faz
      // o tour reaparecer uma vez, o que nao justifica um aviso de erro.
      marcarVisto();
      addXP(50);
      addLog({ timestamp: Date.now(), type: 'tutorial', description: 'Completou o tour guiado', xp: 50 });
      setShowTutorial(false);
    } else {
      setTutorialStep(tutorialStep + 1);
    }
  }

  function handleSkip() {
    // Silencio proposital, mesma razao de handleFinish: falhar so faz o
    // tour reaparecer uma vez, o que nao justifica um aviso de erro.
    marcarVisto();
    setShowTutorial(false);
  }

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Cutout overlay with hole */}
      {hasTarget ? (
        <SpotlightOverlay rect={targetRect} padding={10} />
      ) : (
        <div className="fixed inset-0 bg-black/70" style={{ pointerEvents: 'auto' }} />
      )}

      {/* Mascote ancorado ao elemento-alvo (Central de Estudos) simulando fala */}
      {(() => {
        const mascotSize = 112;
        const mascotStyle: React.CSSProperties = {};
        if (hasTarget && targetRect) {
          // card abaixo -> sagui acima do alvo; card acima -> sagui abaixo do alvo
          mascotStyle.top = cardPos === 'bottom'
            ? Math.max(12, targetRect.top - mascotSize - 28)
            : targetRect.top + targetRect.height + 24;
          mascotStyle.left = Math.max(8, targetRect.left + targetRect.width / 2 - mascotSize / 2);
        } else {
          mascotStyle.top = '50%';
          mascotStyle.left = 24;
          mascotStyle.transform = 'translateY(-50%)';
        }
        return (
          <div
            className="fixed z-[201] hidden md:block"
            style={{ width: mascotSize, height: mascotSize, ...mascotStyle }}
          >
            <Mascot state="typing" talking message="Vou te guiar, um passo de cada vez!" speech variant="floating" size={mascotSize} />
          </div>
        );
      })()}

      {/* Card */}
      <div
        ref={cardRef}
        className="fixed z-[201] left-1/2 -translate-x-1/2 w-full max-w-sm px-4 animate-fade-up"
        style={
          hasTarget
            ? cardPos === 'bottom'
              ? { top: targetRect.top + targetRect.height + 20, transform: 'translateX(-50%)' }
              : { bottom: Math.max(12, vh - targetRect.top + 20), transform: 'translateX(-50%)' }
            : { top: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        <div className="glass-card rounded-3xl p-7 text-center shadow-2xl border border-white/10" style={{ pointerEvents: 'auto', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto' }}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-5 shadow-glow">
            <AppIcon name={step.icon} size={28} className="text-gray-900" />
          </div>

          <h2 className="text-lg font-bold text-white mb-2">{step.title}</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">{step.description}</p>

          {/* Dots: só indicam a ordem (1..11), sem pulo. Pular de bolinha
              em bolinha trocava de aba no meio da animação e o destaque
              quebrava — agora o tour anda só no Próximo/Voltar. */}
          <div className="flex items-center justify-center gap-1.5 mb-6" aria-label={`Etapa ${tutorialStep + 1} de ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                aria-hidden="true"
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === tutorialStep ? 'bg-amber-400 w-5' : i < tutorialStep ? 'bg-amber-400/40 w-2' : 'bg-white/10 w-2'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={handleSkip} className="btn-ghost text-xs text-gray-500 hover:text-gray-300"> Pular tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button onClick={() => setTutorialStep(tutorialStep - 1)} className="btn-ghost text-sm px-3 py-2 text-gray-400"> Voltar
                </button>
              )}
              <button onClick={handleNext} className="btn-primary px-6">
                {isLast ? 'Começar!' : 'Próximo '}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Seta sequencial apontando para o elemento-alvo guiado */}
      {hasTarget && (
        <div
          className={`mm-arrow ${cardPos === 'bottom' ? 'mm-arrow--down' : 'mm-arrow--up'}`}
          style={{
            top: cardPos === 'bottom'
              ? targetRect.top - 52
              : targetRect.top + targetRect.height + 16,
            left: targetRect.left + targetRect.width / 2 - 18,
          }}
        >
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
            <path d="M19 0v26m0 0l-9-9m9 9l9-9" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
