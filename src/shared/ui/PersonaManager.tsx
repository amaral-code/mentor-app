import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { AppIcon } from './AppIcon';
import { Check } from 'lucide-react';
import type { ChatPersona } from '../types';

/* Eram 20 emojis; o script de remocao deixou 20 botoes em branco. Agora
   sao nomes do registro do AppIcon, o mesmo vocabulario do resto do app. */
const ICONS = [
  'mente', 'regua', 'escrita', 'ciencia', 'globo', 'livro', 'marcador',
  'alvo', 'ideia', 'raio', 'foguete', 'trofeu', 'estrela', 'fogo',
  'musica', 'cafe', 'luaCheia', 'bussola', 'caderno', 'forca',
];
const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16', '#14b8a6', '#f97316'];

export function PersonaManager() {
  const { personas, showPersonaManager, setShowPersonaManager, addPersona, removePersona, setActivePersonaId, activePersonaId } = useAppStore();
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#3b82f6');

  if (!showPersonaManager) return null;

  const builtInIds = ['mentor_enem', 'prof_matematica', 'prof_portugues', 'prof_ciencias', 'prof_humanas'];

  function handleCreate() {
    if (!name.trim() || !instruction.trim()) return;
    // Teto + linha única: a instrução viaja no system prompt da IA, então
    // texto gigante ou com quebras vira custo e vetor de injeção de prompt.
    const persona: ChatPersona = {
      id: `persona_${Date.now()}`,
      name: name.trim().replace(/\s+/g, ' ').slice(0, 60),
      instruction: instruction.trim().replace(/\s+/g, ' ').slice(0, 2000),
      icon,
      color,
      createdAt: Date.now(),
    };
    addPersona(persona);
    setActivePersonaId(persona.id);
    setName('');
    setInstruction('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowPersonaManager(false)} />
      <div className="relative z-10 w-full max-w-lg animate-scale-in">
        <div className="glass-card rounded-3xl max-h-[85dvh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-bold text-white"> Gerenciar Personas</h2>
            <button onClick={() => setShowPersonaManager(false)} className="btn-ghost text-lg leading-none"></button>
          </div>

          <div className="p-5 space-y-5">
            {/* Existing personas as visual cards */}
            <div className="grid grid-cols-2 gap-3">
              {personas.map(p => {
                const isBuiltIn = builtInIds.includes(p.id);
                const isActive = activePersonaId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setActivePersonaId(p.id); setShowPersonaManager(false); }}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all group ${
                      isActive
                        ? 'ring-2 shadow-lg'
                        : 'hover:bg-white/[0.03] border border-white/5'
                    }`}
                    style={isActive ? { backgroundColor: p.color + '15', boxShadow: `0 0 0 2px ${p.color}`, borderColor: p.color + '40' } : {}}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110"
                      style={{ backgroundColor: p.color + '20' }}
                    >
                      <AppIcon name={p.icon} size={20} className="text-amber-300" />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{p.instruction}</p>
                    </div>
                    {isActive && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: p.color }}>
                        <Check size={12} className="text-gray-900" strokeWidth={3} />
                      </div>
                    )}
                    {!isBuiltIn && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removePersona(p.id); }}
                        className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        
                      </button>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create new */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Criar Nova Persona</p>
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nome da persona"
                  className="w-full"
                />
                <textarea
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  placeholder="Instrução: descreva comportamento, tom acadêmico, escopo e rigor de pesquisador"
                  rows={3}
                  className="w-full resize-none"
                />
                <div>
                  <p className="text-[11px] text-gray-500 mb-2">Ícone</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ICONS.map(i => (
                      <button
                        key={i}
                        onClick={() => setIcon(i)}
                        aria-label={`Ícone ${i}`}
                        aria-pressed={icon === i}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
                          icon === i ? 'bg-amber-500/20 ring-1 ring-amber-500/30' : 'hover:bg-white/5'
                        }`}
                      >
                        <AppIcon name={i} size={19} className="text-amber-300" />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 mb-2">Cor</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''
                      }`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <button onClick={handleCreate} disabled={!name.trim() || !instruction.trim()} className="btn-primary w-full"> Criar Persona
                </button>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Personas criadas aqui valem para estudos com travas de segurança automáticas: hacking, conteúdos perigosos, atividades ilícitas e xingamentos são sempre recusados.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
