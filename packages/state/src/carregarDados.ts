/**
 * Carga dos dados do usuário depois do login.
 *
 * Morava dentro do `App.tsx` do web. Saiu para cá porque o celular faz
 * exatamente a mesma carga, e duas cópias divergem: a primeira tabela
 * esquecida num dos lados vira "meu XP sumiu no celular".
 *
 * Só fala com stores e repositórios, nada de tela. Quem chama decide o
 * teto de tempo (`comTimeout`) e o aviso de conexão lenta.
 */
import { useAppStore } from './appStore';
import { useStoreStore } from './storeStore';
import { useBemEstarStore } from './bemEstarStore';
import { supabaseRepository } from '@mentor/api/SupabaseRepository';
import { hidratarCache } from '@mentor/api/rankingEngine';
import { safeGet } from '@mentor/core/safeStorage';

/** Professores embutidos no `appStore`: as personas do banco entram depois deles. */
const PERSONAS_EMBUTIDAS = ['mentor_enem', 'prof_matematica', 'prof_portugues', 'prof_ciencias', 'prof_humanas'];

export async function carregarDadosDoUsuario(): Promise<void> {
  const app = useAppStore.getState;

  // allSettled: se 1 das 11 tabelas falhar, as outras 10 ainda entram na
  // tela. Antes um erro isolado zerava o app com cara de "perdi tudo".
  const nomes = ['gam', 'logs', 'notas', 'conversas', 'personas', 'desafios', 'prefs', 'escolas', 'turmas', 'quizzes', 'humor'] as const;
  const resultados = await Promise.allSettled([
    supabaseRepository.loadGamification(),
    supabaseRepository.loadLogs(),
    supabaseRepository.loadNotas(),
    supabaseRepository.loadConversas(),
    supabaseRepository.loadPersonas(),
    supabaseRepository.loadDesafios(),
    supabaseRepository.loadPreferencias(),
    supabaseRepository.loadEscolas(),
    supabaseRepository.loadTurmas(),
    // Sem eles o histórico de quiz ficava sempre vazio, e por isso o
    // Mentor nunca sabia qual matéria retomar.
    supabaseRepository.loadQuizResults(),
    supabaseRepository.loadHumor(),
  ]);
  const valor = <T,>(i: number, padrao: T): T =>
    resultados[i].status === 'fulfilled' ? (resultados[i] as PromiseFulfilledResult<T>).value : padrao;
  const falhas = resultados.map((r, i) => (r.status === 'rejected' ? nomes[i] : null)).filter(Boolean);
  if (falhas.length > 0) {
    console.warn('[boot] tabelas nao carregadas:', falhas.join(', '));
    app().setToast(`Alguns dados não carregaram (${falhas.join(', ')}). O resto está normal.`, 'info');
  }
  const gam = valor<Awaited<ReturnType<typeof supabaseRepository.loadGamification>>>(0, null);
  const logs = valor(1, app().logs);
  const notas = valor(2, app().notas);
  const conversas = valor(3, app().conversas);
  const personas = valor(4, [] as Awaited<ReturnType<typeof supabaseRepository.loadPersonas>>);
  const desafios = valor(5, app().challengeResults);
  const prefs = valor<Awaited<ReturnType<typeof supabaseRepository.loadPreferencias>>>(6, null);
  const escolas = valor(7, [] as Awaited<ReturnType<typeof supabaseRepository.loadEscolas>>);
  const turmas = valor(8, [] as Awaited<ReturnType<typeof supabaseRepository.loadTurmas>>);
  const quizzes = valor(9, app().quizResults);
  const humor = valor(10, [] as Awaited<ReturnType<typeof supabaseRepository.loadHumor>>);

  // Inventário da loja e cache de escolas/turmas: sem carregar, item já
  // comprado voltava a aparecer como disponível a cada recarga.
  void useStoreStore.getState().carregar();
  // Telemetria, carteira de foco, revisões e relatórios do bem-estar.
  // Fora do allSettled porque nenhuma tela do boot depende deles.
  void useBemEstarStore.getState().carregarTudo();
  hidratarCache({ escolas, turmas });

  if (gam) app().updateGamification(gam);
  app().setLogs(logs);
  app().setNotas(notas);
  /*
   * Threads do Mentor (016): abre a mais recente; sem nenhuma, cai no
   * fluxo legado (mensagens sem thread). A saudação do chat assume
   * sozinha quando a thread ativa chega vazia.
   */
  app().setConversas(conversas);
  const ativa = conversas[0]?.id ?? null;
  app().setChatMessages(
    ativa ? await supabaseRepository.loadChat(100, ativa) : await supabaseRepository.loadChat(),
  );
  useAppStore.setState({ conversaAtivaId: ativa });
  if (personas.length > 0) {
    const embutidas = app().personas.filter((p) => PERSONAS_EMBUTIDAS.includes(p.id));
    app().setPersonas([...embutidas, ...personas]);
  }
  useAppStore.setState({ challengeResults: desafios, quizResults: quizzes });
  if (humor.length > 0) {
    useAppStore.setState({ moodHistory: humor, currentMood: humor[humor.length - 1].mood });
  }
  if (prefs) {
    useAppStore.setState({
      challengeSeenTutorial: !!prefs.desafio_tutorial,
      isMuted: !!prefs.mudo,
    });
    if (prefs.persona_ativa_id) app().setActivePersonaId(String(prefs.persona_ativa_id));
  }
  // Tour do aluno: conta nova (ou que nunca completou) cai no passo a
  // passo na primeira entrada. Só estudantes. Backup local cobre conta
  // recém-criada sem linha de preferências (ou offline).
  const papel = app().session?.role;
  const tourVisto = !!prefs?.tutorial_completo || safeGet('mm_tour_visto') === '1';
  if (papel === 'student' && !tourVisto) {
    useAppStore.setState({ showTutorial: true, tutorialStep: 0 });
  }
}
