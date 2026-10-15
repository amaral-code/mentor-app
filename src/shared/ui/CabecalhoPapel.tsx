import type { ComponentType } from 'react';
import { LogOut } from 'lucide-react';
import { MoonLogo } from './MoonLogo';

/*
 * Cabeçalho das áreas fora do app do aluno (família, professor,
 * secretaria, psicologia).
 *
 * Os quatro painéis tinham, cada um, uma cópia do mesmo cabeçalho:
 * quadrado azul com a lua, nome em gradiente, "PAINEL DOS PAIS" em
 * maiúsculas espaçadas e um selo com o papel. Agora é um componente, com
 * a marca igual à do app do aluno e o nome da área por extenso.
 */
export function CabecalhoPapel({ area, nome, onSair }: { area: string; nome?: string | null; onSair: () => void }) {
  return (
    <header className="border-b border-linha bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <MoonLogo className="w-7 h-7 shrink-0" />
          <p className="min-w-0 truncate">
            <span className="font-display text-[1.0625rem] font-semibold text-white">Midnight Mentor</span>
            <span className="text-gray-500"> · {area}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {nome && <span className="text-sm text-gray-400 hidden md:block">{nome}</span>}
          <button
            onClick={onSair}
            className="h-10 px-2.5 flex items-center gap-1.5 rounded-md text-sm text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export interface AbaPainel<T extends string> {
  id: T;
  rotulo: string;
  Icone?: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean | 'true' }>;
  /** Número em destaque ao lado do rótulo (ex.: alertas abertos). */
  selo?: number;
}

/*
 * Abas dos painéis: sublinhadas, numa linha que rola no celular. Mesmo
 * desenho das áreas do Mentor, para o app inteiro ter um jeito só de
 * dizer "você está nesta seção".
 */
export function AbasPainel<T extends string>({
  abas, atual, onTrocar, rotulo,
}: { abas: readonly AbaPainel<T>[]; atual: T | null; onTrocar: (id: T) => void; rotulo: string }) {
  return (
    /* Quebra em duas linhas no celular, em vez de rolar de lado: rolando,
       a última aba aparecia cortada no meio da palavra e parecia defeito
       (decisão anterior dos painéis, mantida). */
    <div role="tablist" aria-label={rotulo} className="flex flex-wrap gap-x-1 border-b border-linha">
      {abas.map(({ id, rotulo: r, Icone, selo }) => {
        const ativa = atual === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={ativa}
            onClick={() => onTrocar(id)}
            className={`relative shrink-0 flex items-center gap-2 px-3 py-3 -mb-px text-sm whitespace-nowrap border-b-2 transition-colors ${
              ativa ? 'border-amber-400 text-white font-semibold' : 'border-transparent text-gray-400 hover:text-white font-medium'
            }`}
          >
            {Icone && <Icone size={16} className={ativa ? 'text-amber-400' : ''} aria-hidden="true" />}
            {r}
            {!!selo && selo > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center" aria-label={`${selo} em aberto`}>
                {selo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
