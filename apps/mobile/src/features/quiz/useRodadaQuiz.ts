import { useCallback, useRef, useState } from 'react';
import { useAppStore, persistir } from '@mentor/state/appStore';
import { useBemEstarStore } from '@mentor/state/bemEstarStore';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { aiAvailable, explicarErroComTutor, generateQuizStructured, type NivelQuiz } from '@mentor/core/aiService';
import { filtrarIneditas } from '@mentor/core/quizHistory';
import { alvosDeRevisao, notaDoQuiz, questoesDoBancoLocal, xpDoQuiz, type AlvoRevisao } from '@mentor/core/sessaoQuiz';
import type { QuizQuestion, QuizResult } from '@mentor/core/types';
import { anunciar, vibrar } from '../../ui/acessibilidade';

export type Etapa = 'materia' | 'topicos' | 'jogando' | 'resultado';

/**
 * Uma rodada de quiz, com os mesmos efeitos do web: telemetria de fadiga
 * por resposta, placar por tópico (015), revisão espaçada (SM-2) e o
 * histórico antirrepetição.
 */
export function useRodadaQuiz() {
  const [etapa, setEtapa] = useState<Etapa>('materia');
  const [materia, setMateria] = useState('');
  const [topicos, setTopicos] = useState<string[]>([]);
  const [questoes, setQuestoes] = useState<QuizQuestion[]>([]);
  const [indice, setIndice] = useState(0);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [resultado, setResultado] = useState<QuizResult | null>(null);
  const [tutor, setTutor] = useState<{ texto: string; carregando: boolean } | null>(null);
  const [sequencia, setSequencia] = useState(0);
  const inicioQuestao = useRef(Date.now());
  const revisao = useRef<AlvoRevisao | null>(null);
  const finalizado = useRef(false);

  const acertos = questoes.reduce((s, q, i) => s + (respostas[i] === q.correta ? 1 : 0), 0);

  const gerar = useCallback(async (mat: string, tops: string[], quantidade: number, nivel: NivelQuiz, alvoRevisao?: AlvoRevisao | null) => {
    const app = useAppStore.getState();
    let qtd = quantidade;
    if (useBemEstarStore.getState().conteudoDensoBloqueado && qtd > 3) {
      qtd = 3;
      app.setToast('Hoje o bloco vem menor: 3 questões. Seu índice de fadiga está alto.', 'info');
    }
    revisao.current = alvoRevisao ?? null;
    setMateria(mat);
    setTopicos(tops);
    setGerando(true);
    setProgresso('');
    try {
      let historico: { hash: string; preview: string }[] = [];
      try {
        historico = await supabaseRepository.loadHistoricoQuiz(mat, 30);
      } catch {
        /* offline: segue sem a camada antirrepetição do prompt */
      }
      const vistos = new Set(historico.map((h) => h.hash));
      let lista: QuizQuestion[] = [];
      if (aiAvailable(app.apiKey)) {
        try {
          const tema = tops.length === 0 || tops.includes('Geral') ? 'Geral' : tops.join(', ');
          const { questions } = await generateQuizStructured(mat, tema, app.apiKey, qtd, {
            dificuldade: nivel,
            historico: historico.map((h) => h.preview),
            onProgresso: (prontas, total) => setProgresso(`${prontas} de ${total} questões prontas`),
          });
          lista = filtrarIneditas(questions.slice(0, qtd), vistos);
        } catch (e) {
          app.setToast(e instanceof Error ? e.message : 'A IA não gerou as questões.', 'error');
        }
      }
      if (lista.length === 0) {
        lista = questoesDoBancoLocal(mat, qtd, vistos);
        if (lista.length > 0) app.setToast('Sem IA agora: questões do banco do app.', 'info');
      }
      if (lista.length === 0) {
        app.setToast('Não foi possível montar o quiz desta matéria. Tente outra.', 'error');
        setEtapa('topicos');
        return;
      }
      setQuestoes(lista.map((q) => ({ ...q, materia: q.materia || mat })));
      setIndice(0);
      setEscolhida(null);
      setRespostas({});
      setResultado(null);
      setTutor(null);
      setSequencia(0);
      finalizado.current = false;
      inicioQuestao.current = Date.now();
      setEtapa('jogando');
      persistir(
        supabaseRepository.saveQuestoesExibidas(mat, lista.map((q) => ({ topico: q.topico, enunciado: q.enunciado, dificuldade: q.dificuldade }))),
        { mensagem: 'O histórico antirrepetição não foi salvo.' },
      );
    } finally {
      setGerando(false);
      setProgresso('');
    }
  }, []);

  /** A resposta é registrada no toque, como no web: sem "confirmar". */
  const responder = useCallback(
    (idx: number) => {
      if (escolhida !== null) return;
      const q = questoes[indice];
      if (!q) return;
      const acertou = idx === q.correta;
      setEscolhida(idx);
      setRespostas((r) => ({ ...r, [indice]: idx }));
      useBemEstarStore.getState().registrarResposta({
        questionId: q.id,
        materia: q.materia || materia,
        dificuldade: q.dificuldade ?? 'media',
        tempoGastoSegundos: Math.min(900, Math.round((Date.now() - inicioQuestao.current) / 1000)),
        acertou,
      });
      setSequencia((s) => (acertou ? s + 1 : 0));
      void vibrar(acertou ? 'acerto' : 'erro');
      anunciar(acertou ? 'Mandou bem! Resposta certa.' : `Quase lá. A certa é a ${String.fromCharCode(65 + q.correta)}.`);
    },
    [escolhida, questoes, indice, materia],
  );

  const pedirTutor = useCallback(async () => {
    const q = questoes[indice];
    if (!q || escolhida === null || escolhida === q.correta) return;
    setTutor({ texto: '', carregando: true });
    try {
      const texto = await explicarErroComTutor(
        { materia: q.materia || materia, topico: q.topico, enunciado: q.enunciado, alternativas: q.alternativas, escolhida, correta: q.correta, explicacao: q.explicacao },
        useAppStore.getState().apiKey,
      );
      setTutor({ texto, carregando: false });
    } catch {
      setTutor({ texto: 'O tutor não respondeu agora. A explicação acima já mostra o caminho.', carregando: false });
    }
  }, [questoes, indice, escolhida, materia]);

  const finalizar = useCallback(() => {
    if (finalizado.current) return;
    finalizado.current = true;
    const app = useAppStore.getState();
    const total = questoes.length;
    const xp = xpDoQuiz(acertos);
    const res: QuizResult = { materia, acertos, total, xpGanho: xp, timestamp: Date.now() };
    setResultado(res);
    app.addQuizResult(res);
    app.addXP(xp);
    app.addLog({ timestamp: Date.now(), type: 'quiz', description: `Quiz de ${materia}: ${acertos}/${total}`, xp });
    setEtapa('resultado');
    void vibrar('acerto');

    // Placar por tópico (Estatísticas, 015): com a matéria de cada questão.
    persistir(
      Promise.all(questoes.map((q, i) => supabaseRepository.registrarDesempenhoTopico(q.materia || materia, q.topico ?? '', respostas[i] === q.correta))).then(() => undefined),
      { mensagem: 'O placar por tópico não foi salvo.' },
    );
    // Calendário: a nota define quando cada tópico volta (1, 3, 7, 21 dias).
    const nota = notaDoQuiz(acertos, total);
    for (const alvo of alvosDeRevisao(materia, topicos, revisao.current)) {
      void useBemEstarStore.getState().agendarRevisao(alvo.topicoId, alvo.topicoNome, alvo.materia, nota);
    }
    revisao.current = null;
    void useBemEstarStore.getState().descarregarTelemetria();
  }, [questoes, acertos, materia, respostas, topicos]);

  const proxima = useCallback(() => {
    if (indice + 1 < questoes.length) {
      setIndice((i) => i + 1);
      setEscolhida(null);
      setTutor(null);
      inicioQuestao.current = Date.now();
    } else {
      finalizar();
    }
  }, [indice, questoes.length, finalizar]);

  return {
    etapa,
    setEtapa,
    materia,
    setMateria,
    questoes,
    indice,
    questao: questoes[indice] ?? null,
    escolhida,
    respostas,
    acertos,
    gerando,
    progresso,
    resultado,
    tutor,
    sequencia,
    gerar,
    responder,
    proxima,
    pedirTutor,
  };
}
