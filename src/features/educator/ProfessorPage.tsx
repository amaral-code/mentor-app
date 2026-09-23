import { useEffect, useState } from 'react';
import { BookOpenCheck, KeyRound, LogOut, Moon, Thermometer } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { docenteRepository } from '../../shared/storage/DocenteRepository';
import { EducatorInsights } from './EducatorInsights';
import { TermometroCognitivo } from './TermometroCognitivo';
import { CodigosEscola } from './CodigosEscola';

/**
 * PAINEL DO PROFESSOR.
 *
 * Até aqui o professor abria a MESMA tela da secretaria, com upload de
 * planilha de matrícula, tutorial de cadastro e troca de códigos, coisas
 * que o servidor nem deixa ele fazer. A tela respondia à pergunta da
 * secretaria ("como cadastro a escola?") e não à dele: "como está a
 * minha turma, e o que eu retomo na próxima aula?".
 *
 * As três abas são essas perguntas, na ordem em que ele chega à escola:
 *
 *   COMO ESTÁ    o cansaço da turma hoje, para calibrar a aula;
 *   O QUE REVISAR onde a turma errou nos exercícios do app;
 *   CÓDIGOS      os das turmas dele, para passar em sala.
 *
 * Tudo aqui é agregado e anônimo, e só das turmas em que a secretaria o
 * vinculou (026). Nenhum nome de aluno aparece nesta tela.
 */

type Aba = 'turma' | 'revisar' | 'codigos';

const ABAS: { id: Aba; rotulo: string; icone: typeof Thermometer }[] = [
  { id: 'turma', rotulo: 'Como a turma está', icone: Thermometer },
  { id: 'revisar', rotulo: 'O que revisar', icone: BookOpenCheck },
  { id: 'codigos', rotulo: 'Códigos', icone: KeyRound },
];

export function ProfessorPage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);
  const [aba, setAba] = useState<Aba>('turma');
  // `null` enquanto carrega: sem isso o aviso de "nenhuma turma" piscaria
  // na tela de todo professor no primeiro render.
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void docenteRepository.minhasTurmas().then((t) => vivo && setTurmas(t));
    return () => {
      vivo = false;
    };
  }, []);

  const semTurma = turmas !== null && turmas.length === 0;

  return (
    <div className="min-h-screen" style={{ background: '#0b1120' }}>
      <header className="glass border-b border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/10 shrink-0">
              <Moon size={20} className="text-gray-900" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-white">
                <span className="text-gradient">Midnight Mentor</span>
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wide uppercase">Painel do Professor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">{session?.nome}</span>
            <span className="px-2 py-1 rounded-full bg-sky-500/10 text-sky-300 text-[10px] font-medium border border-sky-500/20">
              Professor(a)
            </span>
            <button
              onClick={logout}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-5 animate-fade-up">
        <div>
          <h2 className="text-xl font-bold text-white">
            {turmas && turmas.length > 0
              ? turmas.length === 1
                ? `Sua turma: ${turmas[0].nome}`
                : `Suas ${turmas.length} turmas`
              : 'Suas turmas'}
          </h2>
          {turmas && turmas.length > 1 && (
            <p className="text-sm text-gray-500 mt-0.5">{turmas.map((t) => t.nome).join(' · ')}</p>
          )}
        </div>

        {semTurma && (
          <div className="glass rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5" role="status">
            <h3 className="text-sm font-bold text-amber-300">Você ainda não está em nenhuma turma</h3>
            <p className="text-sm text-amber-200/80 mt-2 leading-relaxed">
              Os painéis abaixo só mostram as turmas em que você leciona. Peça à secretaria da
              escola para te vincular às suas turmas: ela faz isso na aba Docentes, no painel dela.
            </p>
          </div>
        )}

        {/* Três colunas no celular, com o ícone em cima: em fila, a rolagem
            cortava "Como a turma está" no meio ("a está"). */}
        <div
          role="tablist"
          aria-label="Painel do professor"
          className="grid grid-cols-3 sm:flex gap-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-1 sm:w-fit"
        >
          {ABAS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              role="tab"
              aria-selected={aba === id}
              onClick={() => setAba(id)}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-center leading-tight transition-all min-h-[52px] sm:min-h-[40px] ${
                aba === id
                  ? 'bg-sky-500/15 text-sky-200 border border-sky-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <Icone size={15} /> {rotulo}
            </button>
          ))}
        </div>

        {aba === 'turma' ? (
          <TermometroCognitivo escopo="professor" />
        ) : aba === 'revisar' ? (
          <EducatorInsights />
        ) : (
          <CodigosEscola modo="professor" />
        )}
      </main>
    </div>
  );
}
