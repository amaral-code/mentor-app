import { useEffect, useState, useRef } from 'react';
import { Check, ClipboardList, Copy, Download, Info, KeyRound, LogOut, Moon, PenLine, Plus, RefreshCw, Sparkles, Trash2, TriangleAlert, Upload, Users } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { safeGet, safeSet } from '../../shared/lib/safeStorage';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import { hasProxy } from '../../shared/lib/aiService';
import { EducatorInsights } from './EducatorInsights';
import { TermometroCognitivo } from './TermometroCognitivo';
import { ProfessoresDaTurma } from './ProfessoresDaTurma';
import { docenteRepository } from '../../shared/storage/DocenteRepository';
import { n8nWebhookUrl } from '../../shared/lib/runtimeConfig';
import Papa from 'papaparse';

interface CSVRow {
  'Nome do Aluno': string;
  'Sala': string;
  'Email do Responsável': string;
  'Telefone do Responsável': string;
  /** Coluna opcional: "Aluno" (padrão) ou "Docente". */
  Tipo?: string;
}

/** Uma linha da tabela manual (id local, nunca vai ao servidor). */
interface LinhaManual {
  id: string;
  nome: string;
  sala: string;
  email: string;
  telefone: string;
  /** Aluno usa o email do responsável; docente usa o próprio email. */
  tipo: 'student' | 'teacher';
}

/** Resultado por linha da importação com contas (relatório da secretaria). */
interface ResultadoImportacao {
  linha: number;
  nome: string;
  tipo: string;
  ok: boolean;
  login?: string;
  turma?: string | null;
  codigoTurma?: string | null;
  erro?: string;
  emailEnviado?: boolean;
  senhaTemporaria?: string;
  loginResponsavel?: string;
  senhaResponsavel?: string;
}

type ModoEntrada = 'csv' | 'tabela';

const CHAVE_RASCUNHO = 'mm_educador_tabela';
const CHAVE_TUTORIAL = 'mm_educador_tutorial_visto';
const COLUNAS_ESPERADAS = ['Nome do Aluno', 'Sala', 'Email do Responsável', 'Telefone do Responsável'];

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Aceita '(' no início: o formato BR "(11) 99999-8888" era rejeitado.
const FONE_OK = /^[+\d(][\d\s().-]{7,24}$/;

function gerarIdLinha() { return `al_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

/** Roteiro do guia interativo: cada passo ilumina a área da tela onde agir. */
interface PassoTutorial {
  titulo: string;
  texto: string;
  /** Ao entrar no passo, a tela troca sozinha para este modo. */
  modo?: ModoEntrada;
  /** id do elemento destacado + rolado até ele. */
  alvo?: string;
}

const PASSOS_TUTORIAL: PassoTutorial[] = [
  {
    titulo: 'Bem-vindo ao Onboarding de Turmas',
    texto: 'Aqui você cadastra os alunos para criar as contas automaticamente. Este guia leva menos de 1 minuto e mostra exatamente onde clicar, passo a passo.',
  },
  {
    titulo: 'Passo 1: escolha como cadastrar',
    texto: 'Use Upload CSV para turmas grandes (planilha pronta) ou Tabela manual para poucos alunos ou ajustes rápidos. Dá para trocar de modo a hora que quiser, sem perder nada.',
    alvo: 'edu-modo-tabs',
  },
  {
    titulo: 'Passo 2: se for CSV, baixe o modelo e envie',
    texto: 'Baixe o modelo, preencha uma linha por aluno (nome, sala, email e telefone do responsável) e arraste o arquivo para a área de upload. O app valida tudo antes de enviar.',
    modo: 'csv',
    alvo: 'edu-upload',
  },
  {
    titulo: 'Passo 3: se for tabela, adicione e preencha',
    texto: 'Clique em + Adicionar aluno e preencha os 4 campos. Borda vermelha significa campo inválido, então passe o olho antes de enviar. O rascunho salva sozinho neste navegador: pode continuar depois.',
    modo: 'tabela',
    alvo: 'edu-tabela',
  },
  {
    titulo: 'Passo 4: confira e envie',
    texto: 'Revise a lista e clique em Enviar para processamento. Só entram na fila de criação de contas as linhas 100% válidas.',
    modo: 'tabela',
    alvo: 'edu-enviar',
  },
];

function linhaVazia(): LinhaManual {
  return { id: gerarIdLinha(), nome: '', sala: '', email: '', telefone: '', tipo: 'student' };
}

/** Erros de validação de uma linha (vazio = válida). Mesmas regras do CSV. */
function validarLinha(l: LinhaManual): string[] {
  const erros: string[] = [];
  const rotulo = l.tipo === 'teacher' ? 'do docente' : 'do aluno';
  if (!l.nome.trim()) erros.push(`Informe o nome ${rotulo}.`);
  if (l.tipo === 'student' && !l.sala.trim()) erros.push('Informe a sala.');
  if (!EMAIL_OK.test(l.email.trim())) {
    erros.push(l.tipo === 'teacher' ? 'Email do docente inválido.' : 'Email do responsável inválido.');
  }
  if (l.tipo === 'student' && l.telefone.trim() && !FONE_OK.test(l.telefone.trim())) {
    erros.push('Telefone do responsável inválido.');
  }
  return erros;
}

function paraCSVRow(l: LinhaManual): CSVRow {
  return {
    'Nome do Aluno': l.nome.trim().slice(0, 120),
    'Sala': l.sala.trim().slice(0, 20),
    'Email do Responsável': l.email.trim().slice(0, 120),
    'Telefone do Responsável': l.telefone.trim().slice(0, 25),
  };
}

/** Linha (CSV ou tabela) no formato que o worker importa. */
function paraImportacao(
  r: CSVRow | LinhaManual,
): { nome: string; sala: string; email: string; telefone: string; tipo: 'student' | 'teacher' } {
  if ('id' in r) {
    const l = r as LinhaManual;
    return { nome: l.nome.trim(), sala: l.sala.trim(), email: l.email.trim(), telefone: l.telefone.trim(), tipo: l.tipo };
  }
  const c = r as CSVRow & { Tipo?: string };
  return {
    nome: c['Nome do Aluno'].trim(),
    sala: c.Sala.trim(),
    email: c['Email do Responsável'].trim(),
    telefone: c['Telefone do Responsável'].trim(),
    tipo: /docente|professor|teacher/i.test(String(c.Tipo || '')) ? 'teacher' : 'student',
  };
}

export function EducatorPage() {
  const session = useAppStore((s) => s.session);
  const logout = useAppStore((s) => s.logout);
  /** EPICO 3: `/educador/dashboard` do spec = esta aba no SPA. */
  const [aba, setAba] = useState<'turmas' | 'insights' | 'termometro' | 'professores'>('turmas');
  /* `null` enquanto carrega: sem isso o aviso de "nenhuma turma" pisca
     na tela de todo professor no primeiro render. */
  const [turmasDoEscopo, setTurmasDoEscopo] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoEntrada>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Tabela manual ---- */
  const [linhas, setLinhas] = useState<LinhaManual[]>(() => {
    try {
      const bruto = safeGet(CHAVE_RASCUNHO);
      if (!bruto) return [linhaVazia()];
      const arr = JSON.parse(bruto);
      if (!Array.isArray(arr) || arr.length === 0) return [linhaVazia()];
      return arr
        .filter((r: any) => r && typeof r === 'object')
        .slice(0, 500)
        .map((r: any) => ({
          id: typeof r.id === 'string' ? r.id : gerarIdLinha(),
          nome: String(r.nome ?? '').slice(0, 120),
          sala: String(r.sala ?? '').slice(0, 20),
          email: String(r.email ?? '').slice(0, 120),
          telefone: String(r.telefone ?? '').slice(0, 25),
          tipo: r.tipo === 'teacher' ? ('teacher' as const) : ('student' as const),
        }));
    } catch {
      return [linhaVazia()];
    }
  });
  const [tentouEnviarTabela, setTentouEnviarTabela] = useState(false);

  /* ---- Tutorial passo a passo: aberto até o primeiro "Entendi" ---- */
  const [tutorialAberto, setTutorialAberto] = useState(() => safeGet(CHAVE_TUTORIAL) !== '1');
  const [passoTutorial, setPassoTutorial] = useState(0);
  const [destaque, setDestaque] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void docenteRepository.minhasTurmas().then((t) => vivo && setTurmasDoEscopo(t.length));
    return () => {
      vivo = false;
    };
  }, []);

  // Rascunho da tabela sobrevive ao F5 (só neste navegador).
  useEffect(() => {
    safeSet(CHAVE_RASCUNHO, JSON.stringify(linhas));
  }, [linhas]);

  function fecharTutorial() {
    setTutorialAberto(false);
    setPassoTutorial(0);
    setDestaque(null);
    safeSet(CHAVE_TUTORIAL, '1');
  }

  function reabrirTutorial() {
    setPassoTutorial(0);
    setTutorialAberto(true);
  }

  function proximoPasso() {
    if (passoTutorial >= PASSOS_TUTORIAL.length - 1) fecharTutorial();
    else setPassoTutorial((p) => p + 1);
  }

  function passoAnterior() {
    setPassoTutorial((p) => Math.max(0, p - 1));
  }

  /* Guia interativo: cada passo troca o modo sozinho e ilumina a área onde
     agir (com rolagem suave). Sem isso o tutorial era uma lista estática
     longe dos botões — o usuário lia e depois tinha que achar onde clicar. */
  useEffect(() => {
    if (!tutorialAberto) {
      setDestaque(null);
      return;
    }
    const passo = PASSOS_TUTORIAL[passoTutorial];
    if (passo.modo) setModo(passo.modo);
    if (!passo.alvo) {
      setDestaque(null);
      return;
    }
    setDestaque(passo.alvo);
    const t = window.setTimeout(() => {
      document.getElementById(passo.alvo!)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [tutorialAberto, passoTutorial]);

  /** Anel de destaque da etapa atual do guia. */
  const clsDestaque = (id: string) =>
    destaque === id ? 'ring-2 ring-cyan-400/70 shadow-[0_0_25px_rgba(34,211,238,0.25)]' : '';

  /** Modelo .csv pronto para baixar, com cabeçalho e exemplo. */
  function baixarModeloCSV() {
    const conteudo = `\uFEFF${[...COLUNAS_ESPERADAS, 'Tipo'].join(',')}\nMaria Silva,3A,responsavel@email.com,(11) 99999-8888,Aluno\n`;
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-alunos.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleFile(file: File) {
    setError('');
    setSent(false);
    setParsedData([]);
    // `accept` e extensão são burláveis (drag-drop ignora): checa tipo real
    // e tamanho. PII de menores: 2MB bastam para milhares de linhas.
    const tipoOk = file.type === '' || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    if (!file.name.toLowerCase().endsWith('.csv') || !tipoOk) {
      setError('Formato inválido. Envie apenas arquivos .csv');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 2MB.');
      return;
    }
    setFile(file);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      worker: file.size > 512 * 1024,
      chunkSize: 1024 * 1024,
      preview: 1,
      complete(results) {
        const colunas = results.meta.fields ?? [];
        const faltando = COLUNAS_ESPERADAS.filter((c) => !colunas.includes(c));
        if (faltando.length > 0) {
          setError(`Colunas ausentes no CSV: ${faltando.join(', ')}`);
          return;
        }
        const rows: CSVRow[] = results.data
          .filter((row: any) => row['Nome do Aluno'] && row['Nome do Aluno'].trim())
          .map((row: any) => ({
            'Nome do Aluno': String(row['Nome do Aluno'] || '').trim().slice(0, 120),
            'Sala': String(row['Sala'] || '').trim().slice(0, 20),
            'Email do Responsável': String(row['Email do Responsável'] || '').trim().slice(0, 120),
            'Telefone do Responsável': String(row['Telefone do Responsável'] || '').trim().slice(0, 25),
            ...(row.Tipo ? { Tipo: String(row.Tipo).slice(0, 20) } : {}),
          }))
          // Docente usa o próprio email e não precisa de telefone; aluno sim.
          .filter((r) => {
            if (!EMAIL_OK.test(r['Email do Responsável'])) return false;
            const eDocente = /docente|professor|teacher/i.test(String(r.Tipo || ''));
            return eDocente || FONE_OK.test(r['Telefone do Responsável']);
          });
        if (rows.length === 0) {
          setError('Nenhuma linha válida. Confira as colunas e os formatos de email/telefone do responsável.');
          return;
        }
        setParsedData(rows);
      },
      error(err) {
        setError('Erro ao ler o arquivo: ' + err.message);
      },
    });
  }

  function atualizarLinha<K extends keyof Omit<LinhaManual, 'id'>>(id: string, campo: K, valor: LinhaManual[K]) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function adicionarLinha() {
    if (linhas.length >= 500) {
      setError('Limite de 500 alunos por envio. Envie e comece outra lista.');
      return;
    }
    setError('');
    setLinhas((prev) => [...prev, linhaVazia()]);
  }

  function removerLinha(id: string) {
    setLinhas((prev) => (prev.length <= 1 ? [linhaVazia()] : prev.filter((l) => l.id !== id)));
  }

  function limparTabela() {
    setLinhas([linhaVazia()]);
    setTentouEnviarTabela(false);
    setError('');
  }

  /* ---- Códigos confidenciais da escola ---- */
  const [escolaCod, setEscolaCod] = useState<{ id: string; nome: string; codigo: string } | null>(null);
  const [turmasCod, setTurmasCod] = useState<{ id: string; nome: string; codigo: string }[]>([]);
  const [carregandoCodigos, setCarregandoCodigos] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<{
    escola?: string;
    codigoInstituicao?: string;
    criados?: number;
    emailsEnviados?: number;
    emailConfigurado?: boolean;
    normalizadoPorIA?: boolean;
    resultados?: ResultadoImportacao[];
  } | null>(null);

  const podeGerenciar = session?.role === 'educator' || session?.role === 'admin';

  useEffect(() => {
    const escolaId = session?.escolaId;
    if (!escolaId) return;
    setCarregandoCodigos(true);
    Promise.all([supabaseRepository.loadEscolas(), supabaseRepository.loadTurmas()])
      .then(([escolas, turmas]) => {
        const e = (escolas as { id: string; nome: string; codigo_instituicao?: string }[]).find((x) => x.id === escolaId) ?? null;
        setEscolaCod(e ? { id: e.id, nome: e.nome, codigo: e.codigo_instituicao ?? 'sem código' } : null);
        setTurmasCod(
          (turmas as { id: string; nome: string; escolaId: string; codigo?: string }[])
            .filter((t) => t.escolaId === escolaId)
            .map((t) => ({ id: t.id, nome: t.nome, codigo: t.codigo ?? 'sem código' })),
        );
      })
      .catch(() => {})
      .finally(() => setCarregandoCodigos(false));
  }, [session?.escolaId]);

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopiado(chave);
    window.setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 2000);
  }

  async function regenerarTurma(id: string) {
    if (!podeGerenciar || !confirm('Gerar um novo código para esta turma? O antigo para de funcionar na hora.')) return;
    try {
      const novo = await supabaseRepository.regenerarCodigoTurma(id);
      setTurmasCod((prev) => prev.map((t) => (t.id === id ? { ...t, codigo: novo } : t)));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível gerar um novo código.');
    }
  }

  async function regenerarInstituicao() {
    if (!podeGerenciar || !escolaCod || !confirm('Gerar um novo código da instituição? Todos os convites com o antigo param de funcionar.')) return;
    try {
      const novo = await supabaseRepository.regenerarCodigoInstituicao(escolaCod.id);
      setEscolaCod({ ...escolaCod, codigo: novo });
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível gerar um novo código.');
    }
  }

  async function sendToWebhook() {
    // Criar contas é ato da secretaria: docente só visualiza códigos.
    if (!podeGerenciar) {
      setError('Só a secretaria pode criar contas. Peça à secretaria da escola.');
      return;
    }
    const linhasEnvio: CSVRow[] =
      modo === 'csv' ? parsedData : linhas.filter((l) => validarLinha(l).length === 0).map(paraCSVRow);
    if (linhasEnvio.length === 0) {
      if (modo === 'tabela') setTentouEnviarTabela(true);
      return;
    }
    setSending(true);
    setError('');
    setRelatorio(null);
    try {
      // Caminho principal: worker cria as contas com IA + envia convites
      // (login, senha temporária, link mágico e códigos) por email.
      // Atenção: usa as linhas ORIGINAIS (paraImportacao), não as CSV —
      // o mapeamento para CSV derrubava o `tipo` e todo docente virava aluno.
      if (hasProxy()) {
        const origem = modo === 'csv'
          ? parsedData
          : linhas.filter((l) => validarLinha(l).length === 0);
        const imp = await supabaseRepository.importarTurma(origem.map(paraImportacao));
        if (!imp.ok) throw new Error(imp.erro || 'Falha na importação.');
        setRelatorio({
          escola: imp.escola,
          codigoInstituicao: imp.codigoInstituicao,
          criados: imp.criados,
          emailsEnviados: imp.emailsEnviados,
          emailConfigurado: imp.emailConfigurado,
          normalizadoPorIA: imp.normalizadoPorIA,
          resultados: imp.resultados,
        });
        setSent(true);
        setFile(null);
        setParsedData([]);
        if (modo === 'tabela') {
          setLinhas([linhaVazia()]);
          setTentouEnviarTabela(false);
        }
        return;
      }

      // Reserva: webhook N8N legado (ou simulação sem webhook).
      const payload = {
        turma: linhasEnvio[0]?.Sala || 'Não informada',
        alunos: linhasEnvio,
        enviadoEm: new Date().toISOString(),
        remetente: session?.nome || 'Educador',
      };

      if (n8nWebhookUrl()) {
        const res = await fetch(n8nWebhookUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Webhook retornou ${res.status}`);
      } else {
        // Simulate when no webhook configured
        await new Promise(r => setTimeout(r, 1500));
      }
      setSent(true);
      setFile(null);
      setParsedData([]);
      if (modo === 'tabela') {
        setLinhas([linhaVazia()]);
        setTentouEnviarTabela(false);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao enviar para o webhook');
    } finally {
      setSending(false);
    }
  }

  const linhasValidas = linhas.filter((l) => validarLinha(l).length === 0).length;
  const linhasComErro = modo === 'tabela' && tentouEnviarTabela ? linhas.filter((l) => validarLinha(l).length > 0).length : 0;

  return (
    <div className="min-h-screen" style={{ background: '#0b1120' }}>
      {/* Header */}
      <header className="glass border-b border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Moon size={20} className="text-gray-900" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white">
                <span className="text-gradient">Midnight Mentor</span>
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wide uppercase">Painel Educacional</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden md:block">{session?.nome}</span>
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20"> Educacional
            </span>
            <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6 animate-fade-up">
        {/* EPICO 3: abas Onboarding | Insights | Termometro (dashboard em lote). */}
        {/* `w-fit` sozinho estourava a largura no celular: com a quarta aba
            (Docentes) a fila passa de 390px e empurrava a pagina inteira
            para o lado. Rola na horizontal em vez de vazar. */}
        <div role="tablist" aria-label="Painel educacional" className="flex gap-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] p-1 w-fit max-w-full overflow-x-auto">
          {(podeGerenciar
            ? (['turmas', 'insights', 'termometro', 'professores'] as const)
            : (['turmas', 'insights', 'termometro'] as const)
          ).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={aba === t}
              onClick={() => setAba(t)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                aba === t ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {t === 'turmas'
                ? 'Onboarding'
                : t === 'insights'
                  ? 'Insights da turma'
                  : t === 'termometro'
                    ? 'Termômetro'
                    : 'Docentes'}
            </button>
          ))}
        </div>

        {/* Professor recem-criado nao tem turma nenhuma ate a secretaria
            vincular (migration 026). Sem este aviso, o painel dele fica
            vazio e parece defeito do app. */}
        {!podeGerenciar && turmasDoEscopo === 0 && (
          <div className="glass rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5" role="status">
            <h2 className="text-sm font-bold text-amber-300">Você ainda não está em nenhuma turma</h2>
            <p className="text-sm text-amber-200/80 mt-2 leading-relaxed">
              Os painéis abaixo só mostram dados das turmas em que você leciona. Peça à
              secretaria da escola para te vincular às suas turmas: é na aba Docentes, no
              painel dela.
            </p>
          </div>
        )}

        {aba === 'professores' ? (
          <ProfessoresDaTurma />
        ) : aba === 'insights' ? (
          <EducatorInsights />
        ) : aba === 'termometro' ? (
          <TermometroCognitivo />
        ) : (
        <>
        {/* Welcome */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-cyan-600/10 flex items-center justify-center text-lg">
            <Users size={20} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Onboarding de Turmas</h2>
            <p className="text-sm text-gray-500 mt-0.5">Cadastre os alunos por planilha CSV ou direto na tabela.</p>
          </div>
        </div>

        {/* Tutorial passo a passo: uma etapa por vez, iluminando onde agir.
            Fixo no topo (sticky) para acompanhar a rolagem até a área. */}
        <div className="glass rounded-2xl border border-cyan-500/10 overflow-hidden sticky top-2 z-10 bg-[#0d1426]/95 backdrop-blur">
          <button
            onClick={() => (tutorialAberto ? fecharTutorial() : reabrirTutorial())}
            aria-expanded={tutorialAberto}
            className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
          >
            <Info size={16} className="text-cyan-400 shrink-0" />
            <span className="text-sm font-semibold text-white flex-1">
              Como usar? Guia passo a passo
              {tutorialAberto && (
                <span className="ml-2 text-[11px] font-normal text-cyan-300">
                  Passo {passoTutorial + 1} de {PASSOS_TUTORIAL.length}
                </span>
              )}
            </span>
            <span className={`text-gray-500 transition-transform ${tutorialAberto ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {tutorialAberto && (
            <div className="px-5 pb-5 pt-1 space-y-3">
              {/* Progresso: barra + bolinhas clicáveis */}
              <div className="flex items-center gap-2" role="tablist" aria-label="Etapas do tutorial">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${((passoTutorial + 1) / PASSOS_TUTORIAL.length) * 100}%` }}
                  />
                </div>
                {PASSOS_TUTORIAL.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === passoTutorial}
                    aria-label={`Ir para o passo ${i + 1}`}
                    onClick={() => setPassoTutorial(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === passoTutorial ? 'bg-cyan-300 scale-110' : i < passoTutorial ? 'bg-emerald-400/70 hover:brightness-110' : 'bg-white/15 hover:bg-white/25'
                    }`}
                  />
                ))}
              </div>

              {/* Etapa atual */}
              <div aria-live="polite" className="rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15 p-3.5">
                <p className="text-sm font-semibold text-white">{PASSOS_TUTORIAL[passoTutorial].titulo}</p>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{PASSOS_TUTORIAL[passoTutorial].texto}</p>
                {passoTutorial === 2 && (
                  <button onClick={baixarModeloCSV} className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-semibold hover:brightness-110 transition-all">
                    <Download size={13} /> Baixar modelo CSV
                  </button>
                )}
              </div>

              {/* Navegação */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={passoAnterior}
                  disabled={passoTutorial === 0}
                  className="px-3.5 py-2 rounded-xl bg-white/5 text-gray-300 border border-white/10 text-xs font-semibold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Voltar
                </button>
                <button
                  onClick={fecharTutorial}
                  className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Pular tutorial
                </button>
                <button
                  onClick={proximoPasso}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-cyan-500/20"
                >
                  {passoTutorial === 0 ? 'Começar →' : passoTutorial === PASSOS_TUTORIAL.length - 1 ? 'Concluir ✓' : 'Próximo →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mode tabs */}
        <div id="edu-modo-tabs" className={`flex items-center gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] w-fit scroll-mt-24 transition-shadow ${clsDestaque('edu-modo-tabs')}`} role="tablist" aria-label="Modo de cadastro">
          <button
            role="tab"
            aria-selected={modo === 'csv'}
            onClick={() => { setModo('csv'); setError(''); setSent(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              modo === 'csv' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <Upload size={15} /> Upload CSV
          </button>
          <button
            role="tab"
            aria-selected={modo === 'tabela'}
            onClick={() => { setModo('tabela'); setError(''); setSent(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              modo === 'tabela' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <PenLine size={15} /> Tabela manual
          </button>
        </div>

        {/* Códigos confidenciais: instituição + turmas (só a secretaria vê) */}
        <div className="glass rounded-2xl p-5 border border-amber-500/10">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={15} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Códigos confidenciais</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            O aluno digita esses códigos no Perfil para entrar. Não poste em grupo aberto: quem tiver o código entra.
          </p>
          {carregandoCodigos ? (
            <p className="text-xs text-gray-500">Carregando códigos…</p>
          ) : !escolaCod ? (
            <p className="text-xs text-amber-300">Sua conta ainda não está vinculada a uma escola. Fale com o administrador.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-black/25 border border-white/[0.06] px-3 py-2.5">
                <div className="flex-1 min-w-[140px]">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Instituição • {escolaCod.nome}</p>
                  <p className="text-base font-mono font-bold text-amber-300 tracking-[0.2em]">{escolaCod.codigo}</p>
                </div>
                <button
                  onClick={() => void copiar(escolaCod.codigo, 'inst')}
                  aria-label="Copiar código da instituição"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-all"
                >
                  {copiado === 'inst' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copiado === 'inst' ? 'Copiado!' : 'Copiar'}
                </button>
                {podeGerenciar && (
                  <button
                    onClick={() => void regenerarInstituicao()}
                    title="Gerar um novo código (o antigo para de funcionar)"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-500 hover:text-amber-300 transition-all"
                  >
                    <RefreshCw size={13} /> Trocar
                  </button>
                )}
              </div>
              {turmasCod.length === 0 ? (
                <p className="text-xs text-gray-500">Nenhuma turma cadastrada para esta escola ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {turmasCod.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                      <span className="text-gray-200 flex-1 truncate">{t.nome}</span>
                      <code className="font-mono font-bold text-cyan-300 tracking-[0.15em] text-sm">{t.codigo}</code>
                      <button
                        onClick={() => void copiar(t.codigo, t.id)}
                        aria-label={`Copiar código da turma ${t.nome}`}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                      >
                        {copiado === t.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                      {podeGerenciar && (
                        <button
                          onClick={() => void regenerarTurma(t.id)}
                          title="Gerar novo código (o antigo para de funcionar)"
                          aria-label={`Gerar novo código para a turma ${t.nome}`}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-300 hover:bg-white/10 transition-all"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!podeGerenciar && (
                <p className="text-[11px] text-gray-600">Você visualiza os códigos como docente. Criar contas e trocar códigos é papel da secretaria.</p>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="glass rounded-2xl p-5 text-sm text-gray-400 space-y-1">
          <p className="text-amber-400 font-medium mb-2"><ClipboardList size={16} className="inline-block align-[-0.15em] text-gray-400" /> {modo === 'csv' ? 'Formato do CSV' : 'Campos da tabela'}</p>
          <p>{modo === 'csv' ? 'O arquivo deve conter as colunas (nesta ordem). Coluna extra opcional: Tipo (Aluno ou Docente).' : 'Cada linha precisa dos dados abaixo. Marque Docente quando for professor (usa o próprio email).'}</p>
          <code className="block bg-black/30 rounded-lg px-3 py-2 text-xs text-gray-300 mt-2"> Nome do Aluno,Sala,Email do Responsável,Telefone do Responsável[,Tipo]
          </code>
          <p className="text-xs text-gray-500 mt-2"> Ex: <code className="bg-white/5 px-1 rounded">João Silva,3A,joao.responsavel@email.com,(11) 99999-8888</code>
          </p>
        </div>

        {modo === 'csv' ? (
          <>
            {/* Upload Area */}
            <div
              id="edu-upload"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={`glass rounded-2xl p-8 text-center cursor-pointer transition-all border-2 border-dashed scroll-mt-24 ${clsDestaque('edu-upload')} ${
                dragOver ? 'border-emerald-400/40 bg-emerald-500/5' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-sm text-gray-300 font-medium">
                {file ? file.name : 'Arraste o CSV aqui ou clique para selecionar'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Formatos aceitos: .csv (máx. 2MB)</p>
              <button
                onClick={(e) => { e.stopPropagation(); baixarModeloCSV(); }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 text-cyan-300 border border-white/10 text-xs font-semibold hover:bg-white/10 transition-all"
              >
                <Download size={13} /> Baixar modelo CSV
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Manual table */}
            <div id="edu-tabela" className={`glass rounded-2xl p-5 space-y-3 scroll-mt-24 transition-shadow ${clsDestaque('edu-tabela')}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Alunos na lista</h3>
                  <p className="text-xs text-gray-500">
                    {linhasValidas} válido{linhasValidas !== 1 ? 's' : ''} de {linhas.length} • rascunho salvo neste navegador
                  </p>
                </div>
                <button onClick={limparTabela} className="text-[11px] text-gray-500 hover:text-red-400 transition-colors">
                  Limpar tudo
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {linhas.map((l, i) => {
                  const erros = validarLinha(l);
                  const mostrarErros = tentouEnviarTabela && erros.length > 0;
                  const borda = (ok: boolean) => (mostrarErros && !ok ? 'border-red-500/60' : 'border-white/10');
                  return (
                    <div key={l.id} className={`rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-2 ${mostrarErros ? 'border-red-500/30' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-gray-600 w-6">{i + 1}.</span>
                        <select
                          value={l.tipo}
                          onChange={(e) => atualizarLinha(l.id, 'tipo', e.target.value as 'student' | 'teacher')}
                          aria-label={`Tipo da linha ${i + 1}: aluno ou docente`}
                          title="Aluno usa email do responsável; docente usa o próprio email"
                          className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-400/40 shrink-0"
                        >
                          <option value="student" className="bg-slate-900">Aluno</option>
                          <option value="teacher" className="bg-slate-900">Docente</option>
                        </select>
                        <input
                          value={l.nome}
                          onChange={(e) => atualizarLinha(l.id, 'nome', e.target.value)}
                          placeholder={l.tipo === 'teacher' ? 'Nome do docente' : 'Nome do Aluno'}
                          aria-label={`Nome ${i + 1}`}
                          maxLength={120}
                          className={`flex-1 min-w-0 bg-white/5 border rounded-lg px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-400/40 ${borda(!!l.nome.trim())}`}
                        />
                        <input
                          value={l.sala}
                          onChange={(e) => atualizarLinha(l.id, 'sala', e.target.value)}
                          placeholder="Sala"
                          aria-label={`Sala ${i + 1}`}
                          maxLength={20}
                          disabled={l.tipo === 'teacher'}
                          className={`w-20 bg-white/5 border rounded-lg px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-400/40 disabled:opacity-30 ${borda(l.tipo === 'teacher' || !!l.sala.trim())}`}
                        />
                        <button
                          onClick={() => removerLinha(l.id)}
                          title="Remover aluno"
                          aria-label={`Remover aluno ${i + 1}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-8">
                        <input
                          value={l.email}
                          onChange={(e) => atualizarLinha(l.id, 'email', e.target.value)}
                          placeholder={l.tipo === 'teacher' ? 'Email do docente' : 'Email do Responsável'}
                          aria-label={`Email ${i + 1}`}
                          inputMode="email"
                          maxLength={120}
                          className={`flex-1 min-w-[150px] bg-white/5 border rounded-lg px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-400/40 ${borda(EMAIL_OK.test(l.email.trim()))}`}
                        />
                        <input
                          value={l.telefone}
                          onChange={(e) => atualizarLinha(l.id, 'telefone', e.target.value)}
                          placeholder="(11) 99999-8888"
                          aria-label={`Telefone ${i + 1}`}
                          inputMode="tel"
                          maxLength={25}
                          disabled={l.tipo === 'teacher'}
                          className={`flex-1 min-w-[130px] sm:max-w-40 bg-white/5 border rounded-lg px-2.5 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-400/40 disabled:opacity-30 ${borda(l.tipo === 'teacher' || !l.telefone.trim() || FONE_OK.test(l.telefone.trim()))}`}
                        />
                      </div>
                      {mostrarErros && (
                        <p className="text-[11px] text-red-400 pl-8">{erros.join(' ')}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={adicionarLinha}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-white/15 text-sm text-gray-300 hover:border-emerald-400/40 hover:text-emerald-300 transition-all"
              >
                <Plus size={15} /> Adicionar aluno
              </button>

              {linhasComErro > 0 && (
                <p className="text-xs text-amber-400">
                  {linhasComErro} linha{linhasComErro !== 1 ? 's' : ''} com erro. Só linhas válidas serão enviadas.
                  Corrija os campos com borda vermelha.
                </p>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/10 flex items-center gap-2">
            <span><TriangleAlert size={16} className="inline-block align-[-0.15em] text-amber-400" /></span>
            <span>{error}</span>
          </div>
        )}

        {/* Preview (CSV) */}
        {modo === 'csv' && parsedData.length > 0 && !sent && (
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Pré-visualização</h3>
                <p className="text-xs text-gray-500">{parsedData.length} aluno{parsedData.length !== 1 ? 's' : ''} encontrado{parsedData.length !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400"> Sala: {parsedData[0]?.Sala || 'não informada'}
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {parsedData.slice(0, 10).map((row, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-400 py-1.5 px-2 rounded-lg hover:bg-white/[0.02]">
                  <span className="text-gray-600 w-5">{i + 1}.</span>
                  <span className="text-gray-200 flex-1">{row['Nome do Aluno']}</span>
                  <span className="text-gray-500 w-32 truncate">{mascararEmail(row['Email do Responsável'])}</span>
                </div>
              ))}
              {parsedData.length > 10 && (
                <p className="text-xs text-gray-600 text-center pt-1">...e mais {parsedData.length - 10} aluno{parsedData.length - 10 !== 1 ? 's' : ''}</p>
              )}
            </div>
            <button onClick={sendToWebhook} disabled={sending} className="btn-primary w-full flex items-center justify-center gap-2">
              {sending ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {hasProxy() ? 'Criando contas…' : 'Enviando...'}</>
              ) : (
                <><Sparkles size={16} /> {hasProxy() ? 'Criar contas e enviar convites' : 'Enviar para processamento'}</>
              )}
            </button>
          </div>
        )}

        {/* Send (tabela) */}
        {modo === 'tabela' && !sent && (
          <button
            id="edu-enviar"
            onClick={() => {
              if (linhasValidas === 0) setTentouEnviarTabela(true);
              sendToWebhook();
            }}
            disabled={sending || linhasValidas === 0}
            className={`btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 scroll-mt-24 transition-shadow ${clsDestaque('edu-enviar')}`}
          >
            {sending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {hasProxy() ? 'Criando contas…' : 'Enviando...'}</>
            ) : (
              <><Sparkles size={16} /> {hasProxy() ? `Criar contas e convidar` : 'Enviar'} {linhasValidas > 0 ? `${linhasValidas} aluno${linhasValidas !== 1 ? 's' : ''} ` : ''}{hasProxy() ? '' : 'para processamento'}</>
            )}
          </button>
        )}

        {/* Success */}
        {sent && (
          <div className="glass rounded-2xl p-8 text-center animate-scale-in border border-emerald-500/20">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Contas em processamento!</h3>
            <p className="text-sm text-gray-400 mb-6">
              {relatorio
                ? `${relatorio.criados ?? 0} conta${(relatorio.criados ?? 0) !== 1 ? 's' : ''} criada${(relatorio.criados ?? 0) !== 1 ? 's' : ''} em ${relatorio.escola ?? 'sua escola'} • ${relatorio.emailsEnviados ?? 0} convite${(relatorio.emailsEnviados ?? 0) !== 1 ? 's' : ''} por email${relatorio.normalizadoPorIA ? ' • revisado pela IA' : ''}.`
                : 'Alunos enviados para a fila de criação de contas.'}
            </p>
            {relatorio?.resultados && relatorio.resultados.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1.5 text-left mb-6">
                {relatorio.resultados.map((r) => (
                  <div key={`${r.linha}-${r.nome}`} className={`rounded-xl border px-3 py-2 text-xs ${r.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                    <p className="text-gray-200 font-medium">
                      {r.linha}. {r.nome} <span className="text-gray-500">({r.tipo === 'teacher' ? 'docente' : 'aluno'})</span>
                    </p>
                    {r.ok ? (
                      <div className="mt-1 space-y-0.5 text-gray-400">
                        <p>Login: <code className="text-cyan-300 break-all">{r.login}</code>{r.turma ? ` • Turma ${r.turma} (${r.codigoTurma})` : ''}</p>
                        <p>{r.emailEnviado ? 'Convite enviado por email com senha temporária e códigos.' : 'Email não configurado: repasse manual em sigilo.'}</p>
                        {r.senhaTemporaria && (
                          <p className="text-amber-300">Senha temporária: <code className="break-all">{r.senhaTemporaria}</code>
                            {r.loginResponsavel && <> • Resp: <code className="break-all">{r.loginResponsavel}</code> / <code className="break-all">{r.senhaResponsavel}</code></>}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-red-300 mt-0.5">Falhou: {r.erro}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { setSent(false); setFile(null); setParsedData([]); setRelatorio(null); }} className="btn-secondary"> Enviar outra turma
            </button>
          </div>
        )}

        {!n8nWebhookUrl() && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 text-xs text-amber-400 flex items-center gap-2">
            <TriangleAlert size={14} className="shrink-0" />
            <span>Webhook não configurado. Defina <code className="bg-black/30 px-1 rounded">N8N_WEBHOOK_URL</code> nas Environment Variables do projeto para enviar os dados.</span>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}

/** Email/telefone mascarados no preview (evita shoulder-surfing em sala). */
function mascararEmail(email: string): string {
  const [user, dom] = email.split('@');
  if (!dom) return '***';
  return `${(user || '').slice(0, 2)}***@${dom}`;
}
