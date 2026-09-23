import { useState, useEffect, useRef } from 'react';
import { PenLine, Zap } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { Modal } from '../../shared/ui/Modal';
import { GlassCard } from '../../shared/ui/GlassCard';
import { AppIcon } from '../../shared/ui/AppIcon';
import { QuizQuestion } from '../../shared/types';
import { askGemini, aiAvailable, gerarMapaMental, buildMindmapMermaid, sanitizarRotuloMermaid } from '../../shared/lib/aiService';

/*
 * mermaid entra por import dinamico.
 *
 * A biblioteca passa de 1 MB e so serve ao mapa mental, um dos quatro
 * recursos deste modal. Importada no topo, ela viajava no chunk inicial e
 * era baixada por todo aluno que abrisse o app, mesmo sem nunca gerar um
 * diagrama.
 *
 * securityLevel 'strict' e explicito porque o codigo do diagrama vem da IA
 * e o SVG resultante e injetado com innerHTML. Em 'strict' o mermaid
 * sanitiza os rotulos e desliga callbacks de clique. E o padrao atual da
 * lib, mas depender de um default para conter conteudo nao confiavel
 * quebra na primeira troca de versao.
 */
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function carregarMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        securityLevel: 'strict',
        htmlLabels: false,
        theme: 'dark',
        themeVariables: { primaryColor: '#f59e0b', primaryTextColor: '#fff', primaryBorderColor: '#f59e0b33', lineColor: '#f59e0b55', fontSize: '14px' },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

type StudioTool = 'resumo' | 'mapa' | 'flashcards' | 'gaps';

export function NotebookStudioModal() {
  const showNotebookStudio = useAppStore((s) => s.showNotebookStudio);
  const setShowNotebookStudio = useAppStore((s) => s.setShowNotebookStudio);
  const notas = useAppStore((s) => s.notas);
  const apiKey = useAppStore((s) => s.apiKey);
  const [activeTool, setActiveTool] = useState<StudioTool>('resumo');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [flashcards, setFlashcards] = useState<QuizQuestion[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);

  const notasList = notas;

  useEffect(() => {
    if (mermaidSvg && mermaidRef.current) {
      mermaidRef.current.innerHTML = mermaidSvg;
    }
  }, [mermaidSvg]);

  async function runTool(tool: StudioTool) {
    setLoading(true);
    setResult('');
    setMermaidSvg('');
    setFlashcards([]);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);

    await new Promise(r => setTimeout(r, 300));

    try {
      if (tool === 'resumo') {
        await generateResumo();
      } else if (tool === 'mapa') {
        await generateMapa();
      } else if (tool === 'flashcards') {
        await generateFlashcards();
      } else if (tool === 'gaps') {
        await generateGaps();
      }
    } catch (e: any) {
      setResult(`Erro: ${e?.message || 'Falha ao processar'}`);
    }
    setLoading(false);
  }

  async function generateResumo() {
    if (notasList.length === 0) {
      setResult('Nenhuma nota salva ainda. Adicione notas ao Caderno para usar esta ferramenta.');
      return;
    }

    if (aiAvailable(apiKey)) {
      try {
        const notasText = notasList.slice(-10).map(n => `• ${n.text}`).join('\n');
        const prompt = `Com base nas seguintes anotações de estudante, gere um resumo executivo bem estruturado com seções claras, destacando os principais conceitos, conexões entre temas e pontos-chave que merecem revisão:\n\n${notasText}`;
        const raw = await callGemini(prompt, apiKey);
        setResult(raw);
        return;
      } catch {}
    }

    const wordFreq: Record<string, number> = {};
    for (const nota of notasList) {
      for (const w of [...new Set(nota.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4))]) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }
    const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const recent = notasList.slice(-5).reverse();
    let out = ' Resumo das Anotações\n\nPalavras-chave mais frequentes:\n';
    out += topWords.map(([w, c]) => `• ${w} (${c}x)`).join('\n');
    out += '\n\nNotas Recentes:\n';
    out += recent.map((n: any) => `• ${new Date(n.data).toLocaleDateString()}: ${n.text.slice(0, 120)}${n.text.length > 120 ? '...' : ''}`).join('\n');
    setResult(out);
  }

  async function generateMapa() {
    if (notasList.length === 0) {
      setResult('Nenhuma nota salva ainda.');
      return;
    }

    /*
     * Mapa via DeepSeek Flash em duas etapas: a IA devolve DADOS em JSON
     * (titulo + ramos) e o CODIGO Mermaid (mindmap) e montado aqui com
     * sanitizacao total. Pedir o codigo pronto ao modelo quebrava a
     * renderizacao com aspas e prosa ao redor - agora o diagrama sai
     * valido por construcao.
     */
    if (aiAvailable(apiKey)) {
      try {
        const dados = await gerarMapaMental(notasList.slice(-10).map(n => n.text), apiKey);
        if (dados && await renderMermaid(buildMindmapMermaid(dados))) {
          setResult(` Mapa mental gerado por IA: ${dados.titulo}`);
          return;
        }
        setResult('A IA não devolveu um mapa válido. Tentando montagem local...');
      } catch (e: any) {
        setResult(`Erro: ${e?.message || 'Falha ao processar'}`);
        return;
      }
    }

    const wordFreq: Record<string, number> = {};
    for (const nota of notasList) {
      for (const w of [...new Set(nota.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4))]) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    }
    const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    let mermaidCode = 'graph TD\n  A[" Meus Estudos"]\n';
    topWords.forEach((w, i) => {
      // Sanitiza como o caminho IA: palavra do usuário crua quebra o
      // diagrama (aspas/colchetes) ou injeta nó no SVG via innerHTML.
      const rotulo = sanitizarRotuloMermaid(w.charAt(0).toUpperCase() + w.slice(1)) || `Conceito ${i + 1}`;
      mermaidCode += `  N${i}["${rotulo}"]\n  A --> N${i}\n`;
    });
    await renderMermaid(mermaidCode);
    setResult(` Mapa mental com ${topWords.length} conceitos principais`);
  }

  async function generateFlashcards() {
    const withContent = notasList.filter((n: any) => n.text.split(/\s+/).length > 3);
    if (withContent.length < 2) {
      setResult('Precisa de pelo menos 2 notas com conteúdo para gerar flashcards.');
      return;
    }

    if (aiAvailable(apiKey)) {
      try {
        const notasText = withContent.slice(-8).map((n: any) => n.text).join('\n---\n');
        const prompt = `Com base nas anotações abaixo, gere 5 flashcards no formato de perguntas e respostas para revisão. Cada flashcard deve ter uma pergunta clara e uma resposta direta. Responda APENAS com um array JSON, sem formatação adicional:\n\n[{"pergunta": "...", "resposta": "..."}, ...]\n\nAnotações:\n${notasText}`;
        const raw = await callGemini(prompt, apiKey);
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          let cards: unknown;
          try {
            cards = JSON.parse(jsonMatch[0]);
          } catch {
            cards = null;
          }
          // Valida campo a campo: sem isso, objeto/string do modelo gerava
          // QuizQuestion com enunciado undefined e quebrava o QuizPage.
          const validos = Array.isArray(cards) ? cards.filter(
            (c): c is { pergunta: string; resposta: string } =>
              !!c && typeof c === 'object' &&
              typeof (c as { pergunta?: unknown }).pergunta === 'string' &&
              (c as { pergunta: string }).pergunta.trim().length > 0 &&
              typeof (c as { resposta?: unknown }).resposta === 'string' &&
              (c as { resposta: string }).resposta.trim().length > 0,
          ) : [];
          if (validos.length > 0) {
            const questions: QuizQuestion[] = validos.map((c, i) => ({
              id: `flash_ai_${Date.now()}_${i}`,
              materia: 'Flashcards IA',
              enunciado: c.pergunta.trim().slice(0, 500),
              alternativas: [c.resposta.trim().slice(0, 300), 'Revise a anotação original', 'Consulte o material de apoio', 'Pergunte ao Mentor'],
              correta: 0,
              explicacao: c.resposta.trim().slice(0, 500),
            }));
            (window as any).__flashcardQuiz = questions;
            setFlashcards(questions);
            setResult(`${questions.length} flashcards gerados por IA!`);
            return;
          }
        }
      } catch {}
    }

    const selected = [...withContent].sort(() => Math.random() - 0.5).slice(0, 4);
    const questions: QuizQuestion[] = selected.map((nota: any, idx: number) => {
      const words = nota.text.split(/\s+/).filter((w: string) => w.length > 4);
      const keyword = words[Math.floor(Math.random() * words.length)] || 'conceito';
      const correct = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      const distractors = withContent.filter((n: any) => n.id !== nota.id)
        .flatMap((n: any) => n.text.split(/\s+/).filter((w: string) => w.length > 4 && w !== keyword))
        .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
        .slice(0, 3)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1));
      while (distractors.length < 3) distractors.push(`Opção ${distractors.length + 2}`);
      const alternatives = [correct, ...distractors].sort(() => Math.random() - 0.5);
      return {
        id: `flash_${Date.now()}_${idx}`,
        materia: 'Flashcards',
        enunciado: `Complete: "A palavra ________ aparece na nota sobre..."`,
        alternativas: alternatives,
        correta: alternatives.indexOf(correct),
        explicacao: `Palavra-chave: "${correct}", extraída das suas anotações.`,
      };
    });
    (window as any).__flashcardQuiz = questions;
    setFlashcards(questions);
    setResult(`${questions.length} flashcards gerados!`);
  }

  async function generateGaps() {
    if (notasList.length === 0) {
      setResult('Nenhuma nota salva ainda.');
      return;
    }

    if (aiAvailable(apiKey)) {
      try {
        const notasText = notasList.slice(-15).map(n => `• ${n.text}`).join('\n');
        const prompt = `Analise estas anotações de estudante e identifique:\n1. Quais conceitos aparecem com frequência (possíveis gaps de entendimento)\n2. Quais tópicos precisam de mais revisão\n3. Sugira 3 áreas de foco prioritário\n\nAnotações:\n${notasText}\n\nResponda em markdown com seções claras.`;
        const raw = await callGemini(prompt, apiKey);
        setResult(raw);
        return;
      } catch {}
    }

    const wordFreq: Record<string, { count: number; notes: string[] }> = {};
    for (const nota of notasList) {
      for (const w of [...new Set(nota.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4))]) {
        if (!wordFreq[w]) wordFreq[w] = { count: 0, notes: [] };
        wordFreq[w].count++;
        wordFreq[w].notes.push(nota.text.slice(0, 80));
      }
    }
    const gaps = Object.entries(wordFreq).filter(([, v]) => v.count >= 2).sort((a, b) => b[1].count - a[1].count);
    if (gaps.length === 0) {
      setResult('Nenhum gap identificado. Continue adicionando anotações!');
      return;
    }
    let out = ' Análise de Gaps\n\nConceitos recorrentes em múltiplas anotações (possíveis gaps de compreensão):\n\n';
    for (const [word, info] of gaps.slice(0, 8)) {
      out += `**${word}** (${info.count}x)\n`;
      for (const note of info.notes.slice(0, 2)) out += `  > "${note}..."\n`;
      out += '\n';
    }
    out += '\n Revise esses tópicos com prioridade. Eles aparecem em várias notas, indicando áreas de estudo ativo.';
    setResult(out);
  }

  async function callGemini(prompt: string, key: string): Promise<string> {
    return askGemini(prompt, null, key);
  }

  async function renderMermaid(code: string): Promise<boolean> {
    try {
      const mermaid = await carregarMermaid();
      const { svg } = await mermaid.render('mmd_' + Date.now(), code);
      if (svg.includes('class="error"') || svg.includes('>Error<') || svg.includes('>error<') || svg.includes('flowchart-error')) {
        setMermaidSvg('');
        return false;
      }
      setMermaidSvg(svg);
      return true;
    } catch {
      setMermaidSvg('');
      return false;
    }
  }

  function goToQuiz() {
    setShowNotebookStudio(false);
    useAppStore.getState().setActiveTab('quiz');
  }

  const tools: { id: StudioTool; label: string; icon: string }[] = [
    { id: 'resumo', label: 'Resumo', icon: 'lista' },
    { id: 'mapa', label: 'Mapa Mental', icon: 'mapaMental' },
    { id: 'flashcards', label: 'Flashcards', icon: 'marcador' },
    { id: 'gaps', label: 'Análise de Gaps', icon: 'bussola' },
  ];

  return (
    <Modal open={showNotebookStudio} onClose={() => setShowNotebookStudio(false)} title=" Notebook AI Studio" fullScreen>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tools.map(t => (
          <button key={t.id} onClick={() => { setActiveTool(t.id); runTool(t.id); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTool === t.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'glass-hover text-gray-400 border border-white/5'
            }`}>
            <AppIcon name={t.icon} size={15} className="inline-block align-[-0.15em] mr-1.5" />{t.label}
          </button>
        ))}
      </div>

      <GlassCard className="mt-5">
        {notasList.length === 0 && !result && !loading && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl mx-auto mb-3"><PenLine size={16} className="inline-block align-[-0.15em] text-amber-400" /></div>
            <p className="text-gray-400">Nenhuma nota salva.</p>
            <p className="text-sm text-gray-500 mt-1">Adicione notas ao Caderno primeiro.</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">Processando suas notas...</p>
          </div>
        )}

        {mermaidSvg && (
          <div className="mb-4 overflow-x-auto bg-black/20 rounded-xl p-4" ref={mermaidRef} />
        )}

        {result && !loading && (
          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed space-y-4">
            {result}

            {flashcards.length > 0 && (
              <div className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Flashcard {flashcardIndex + 1} de {flashcards.length}</span>
                  <div className="flex gap-1">
                    {flashcards.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i === flashcardIndex ? 'bg-amber-400' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>

                <div
                  onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                  className="glass rounded-2xl p-6 text-center cursor-pointer min-h-[160px] flex flex-col items-center justify-center transition-all hover:border-amber-500/20 border border-white/5"
                >
                  {flashcardFlipped ? (
                    <div className="space-y-3">
                      <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Resposta</span>
                      <p className="text-base text-white font-medium">{flashcards[flashcardIndex].alternativas[flashcards[flashcardIndex].correta]}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-xs text-amber-400 font-medium uppercase tracking-wider">Pergunta</span>
                      <p className="text-base text-white font-medium">{flashcards[flashcardIndex].enunciado}</p>
                      <p className="text-xs text-gray-500 mt-2">Clique para ver a resposta</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => { setFlashcardIndex(i => Math.max(0, i - 1)); setFlashcardFlipped(false); }}
                    disabled={flashcardIndex === 0}
                    className="btn-secondary flex-1 text-xs"
                  > Anterior
                  </button>
                  <button
                    onClick={() => { setFlashcardIndex(i => Math.min(flashcards.length - 1, i + 1)); setFlashcardFlipped(false); }}
                    disabled={flashcardIndex === flashcards.length - 1}
                    className="btn-primary flex-1 text-xs"
                  > Próximo 
                  </button>
                </div>

                <button onClick={goToQuiz} className="btn-primary w-full"> Ir para o Quiz com esses flashcards
                </button>
              </div>
            )}

            {(window as any).__flashcardQuiz && flashcards.length === 0 && (
              <button onClick={goToQuiz} className="btn-primary"> Ir para o Quiz
              </button>
            )}
          </div>
        )}

        {!loading && !result && notasList.length > 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Selecione uma ferramenta acima para processar suas anotações.</p>
            {aiAvailable(apiKey) && <p className="text-xs text-amber-400 mt-2"><Zap size={16} className="inline-block align-[-0.15em] text-amber-400" /> IA disponível: resultados mais precisos</p>}
          </div>
        )}
      </GlassCard>
    </Modal>
  );
}
