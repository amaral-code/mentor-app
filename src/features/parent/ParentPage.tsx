import { useAppStore } from '../../stores/appStore';
import { LogOut, Moon } from 'lucide-react';
import { ParentsDashboard } from './ParentsDashboard';
import { PainelCuidado } from './PainelCuidado';

export function ParentPage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);

  return (
    <div className="min-h-screen" style={{ background: '#0b1120' }}>
      {/* Header */}
      <header className="glass border-b border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <Moon size={20} className="text-gray-900" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white">
                <span className="text-gradient">Midnight Mentor</span>
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wide uppercase">Painel dos Pais</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">{session?.nome}</span>
            <span className="px-2 py-1 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-medium border border-violet-500/20">
              Responsável
            </span>
            <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Cuidado vem ANTES dos graficos: quem abre este painel depois de
          um alerta precisa do caminho para agir, nao de uma serie
          historica. Os graficos continuam logo abaixo. */}
      <PainelCuidado />

      <ParentsDashboard />
    </div>
  );
}
