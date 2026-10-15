import { useEffect, useState } from 'react';
import { AbasPainel, CabecalhoPapel } from '../../shared/ui/CabecalhoPapel';
import { BookOpenCheck, KeyRound, Thermometer } from 'lucide-react';
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
    <div className="min-h-screen" style={{ background: '#141310' }}>
      <CabecalhoPapel area="Professor" nome={session?.nome} onSair={logout} />

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
          <div className="painel rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5" role="status">
            <h3 className="text-sm font-bold text-amber-300">Você ainda não está em nenhuma turma</h3>
            <p className="text-sm text-amber-200/80 mt-2 leading-relaxed">
              Os painéis abaixo só mostram as turmas em que você leciona. Peça à secretaria da
              escola para te vincular às suas turmas: ela faz isso na aba Docentes, no painel dela.
            </p>
          </div>
        )}

        {/* Três colunas no celular, com o ícone em cima: em fila, a rolagem
            cortava "Como a turma está" no meio ("a está"). */}
        <AbasPainel
          rotulo="Painel do professor"
          atual={aba}
          onTrocar={setAba}
          abas={ABAS.map(({ id, rotulo, icone }) => ({ id, rotulo, Icone: icone }))}
        />

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
