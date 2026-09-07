import { useState } from 'react';
import { Accessibility, CaseSensitive, Contrast, PersonStanding } from 'lucide-react';
import {
  DALTONISMO_OPCOES,
  lerAcessibilidade,
  salvarAcessibilidade,
  type PreferenciasAcessibilidade,
  type TamanhoFonte,
} from '../lib/acessibilidade';

const FONTES: { id: TamanhoFonte; rotulo: string; desc: string }[] = [
  { id: 'normal', rotulo: 'Normal', desc: 'Padrão' },
  { id: 'grande', rotulo: 'Grande', desc: '+12%' },
  { id: 'extra', rotulo: 'Extra', desc: '+25%' },
];

function Interruptor({
  ligado,
  aoMudar,
  rotulo,
  descricao,
}: {
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
  descricao: string;
}) {
  return (
    <button
      onClick={() => aoMudar(!ligado)}
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      className="w-full flex items-center gap-3 py-2.5 text-left"
    >
      <span
        aria-hidden="true"
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
          ligado ? 'bg-emerald-500' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
            ligado ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-200">{rotulo}</span>
        <span className="block text-[11px] text-gray-500">{descricao}</span>
      </span>
    </button>
  );
}

/**
 * PAINEL DE ACESSIBILIDADE (Perfil).
 *
 * Quatro sensibilidades num lugar só, aplicadas na hora e guardadas neste
 * aparelho: fonte maior para baixa visão, alto contraste, menos movimento
 * (vestibular + sensibilidade sensorial) e filtro de daltonismo. Mesma
 * fonte do botão flutuante de daltonismo — os dois andam juntos.
 */
export function AcessibilidadePanel() {
  const [pref, setPref] = useState<PreferenciasAcessibilidade>(() => lerAcessibilidade());

  function mudar(parcial: Partial<PreferenciasAcessibilidade>) {
    const nova = { ...pref, ...parcial };
    setPref(nova);
    salvarAcessibilidade(nova);
  }

  return (
    <section id="secao-acessibilidade" aria-label="Acessibilidade" className="glass-card rounded-2xl p-5 scroll-mt-24">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
          <Accessibility size={17} className="text-cyan-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Acessibilidade</h2>
          <p className="text-[11px] text-gray-500">Conforto visual e de movimento, só neste aparelho</p>
        </div>
      </div>

      {/* Tamanho da fonte */}
      <div className="mt-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
          <CaseSensitive size={13} /> Tamanho da letra
        </p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamanho da letra">
          {FONTES.map((f) => {
            const ativo = pref.tamanhoFonte === f.id;
            return (
              <button
                key={f.id}
                role="radio"
                aria-checked={ativo}
                onClick={() => mudar({ tamanhoFonte: f.id })}
                className={`rounded-xl border px-2 py-2 text-center transition-all ${
                  ativo
                    ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-200'
                    : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="block text-sm font-bold">A</span>
                <span className="block text-[11px] font-medium">{f.rotulo}</span>
                <span className="block text-[10px] text-gray-500">{f.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 divide-y divide-white/[0.05]">
        <Interruptor
          ligado={pref.altoContraste}
          aoMudar={(v) => mudar({ altoContraste: v })}
          rotulo="Alto contraste"
          descricao="Textos apagados ficam mais fortes sobre o fundo escuro"
        />
        <Interruptor
          ligado={pref.reduzirMovimento}
          aoMudar={(v) => mudar({ reduzirMovimento: v })}
          rotulo="Reduzir movimento"
          descricao="Desliga animações, brilhos e transições do app"
        />
      </div>

      {/* Daltonismo */}
      <div className="mt-2">
        <label htmlFor="a11y-daltonismo" className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
          <PersonStanding size={13} /> Filtro de daltonismo
        </label>
        <select
          id="a11y-daltonismo"
          value={pref.daltonismo}
          onChange={(e) => mudar({ daltonismo: e.target.value as PreferenciasAcessibilidade['daltonismo'] })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400/50"
        >
          {['', 'Vermelho-Verde', 'Azul-Amarelo', 'Completo'].map((grupo) => (
            <optgroup key={grupo || 'sem'} label={grupo || 'Sem filtro'}>
              {DALTONISMO_OPCOES.filter((o) => o.grupo === grupo).map((o) => (
                <option key={o.tipo} value={o.tipo} className="bg-slate-900">
                  {o.rotulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-600">
        <Contrast size={12} /> Vale na hora, sem conta e sem internet.
      </p>
    </section>
  );
}
