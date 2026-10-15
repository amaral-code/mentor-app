import { BadgeCheck, Lock, Video } from 'lucide-react';
import { formatarDataHora, iniciais, type SessaoView } from '../tipos';
import { nomeDaPlataforma } from '../../../shared/lib/salaVirtual';

interface HeroSessaoProps {
  sessao: SessaoView;
  countdown: string;
  salaAberta: boolean;
  entrando: boolean;
  onEntrar: () => void;
}

/**
 * Hero da próxima sessão (protótipo 1:1): retrato com selo online,
 * badges de confirmação/CRP, data, duração, countdown ao vivo e CTA
 * de entrada na sala. Retrato usa iniciais em gradiente (as URLs
 * externas do protótipo são bloqueadas pela CSP do index.html).
 */
export function HeroSessao({ sessao, countdown, salaAberta, entrando, onEntrar }: HeroSessaoProps) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl painel border-l-[3px] !border-l-amber-400 p-6 sm:p-8"
      data-purpose="imminent-session-hero"
    >
      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-folha-3 flex-shrink-0 flex items-center justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-200" aria-hidden="true">
                {iniciais(sessao.psicologoNome)}
              </span>
            </div>
            {/* O selo verde "Profissional Online" saiu: o app não sabe se o
                profissional está conectado, e o tique dizia que sabia. */}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-amber-400">
                Próxima sessão, confirmada
              </span>
              {/* O selo de conferido só aparece com CRP de verdade: o
                  tique verde ao lado de "CRP não informado" dizia que
                  algo foi conferido quando não foi. */}
              {sessao.crp.startsWith('CRP não') ? (
                <span className="text-xs text-gray-500">{sessao.crp}</span>
              ) : (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <BadgeCheck size={13} aria-hidden="true" />
                  {sessao.crp}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              {sessao.psicologoNome}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-300">
              <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                {sessao.ehHoje ? 'Hoje' : formatarDataHora(sessao.inicio).split(' às ')[0]}, {sessao.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                Duração: {sessao.duracaoMinutos} min
              </span>
              <span className="text-slate-500">•</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 tabular-nums">
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span id="countdown-timer">{countdown}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[240px]">
          <button
            onClick={onEntrar}
            disabled={entrando}
            id="btn-enter-room"
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-[#1b1406] font-semibold text-sm sm:text-base transition-colors cursor-pointer select-none disabled:opacity-70"
          >
            <Video size={20} className="transition-transform duration-300 group-hover:scale-110" />
            <span id="btn-enter-text">{entrando ? 'Conectando...' : salaAberta ? 'Entrar na Sala Virtual' : 'Ver Detalhes da Sala'}</span>
          </button>
          <div className="flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
            <Lock size={14} className="text-emerald-400" />
            Link privado, pelo {nomeDaPlataforma(sessao.meetingProvider, sessao.meetingUrl)}
          </div>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-midnight-700/70 flex items-center gap-3.5 bg-midnight-900/40 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 px-6 sm:px-8 py-3.5 rounded-b-3xl">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-amber-500/20 flex-shrink-0 border border-amber-500/40">
          <img
            alt="Sagui Amigo"
            loading="lazy"
            draggable={false}
            onError={(e) => { if (e.currentTarget.src.endsWith('ele_feliz_pulando.png')) e.currentTarget.src = '/assets/sagui_pulando_2.png'; }}
            className="w-full h-full object-cover object-top scale-110"
            src="/assets/ele_feliz_pulando.png"
          />
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-amber-400 font-bold">Dica do Sagui:</strong> Encontre um cantinho calmo, coloque seus fones de ouvido e respire fundo 5 minutinhos antes da sessão. Não precisa preparar nada especial: aqui é para falar o que vier ao coração!
        </p>
      </div>
    </section>
  );
}
