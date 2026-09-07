import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarHeart, Phone } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useMarketplaceStore } from '../../stores/marketplaceStore';
import { tempoAte } from '../../shared/lib/bookingEngine';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import { HeroSessao } from './components/HeroSessao';
import { Calendario, type DiaCalendario, type FeedbackDia } from './components/Calendario';
import { Diario } from './components/Diario';
import { SessoesLista } from './components/SessoesLista';
import type { SessaoView } from './tipos';

function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function tituloMes(ano: number, mes: number): string {
  const t = new Date(ano, mes, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatarCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `Começa em ${h}h ${m}m ${s}s`;
}

/**
 * Minha Agenda & Sessões (protótipo 1:1 na estrutura, dados reais):
 * hero da próxima consulta, countdown ao vivo, calendário com seleção,
 * diário pré-sessão, lista de sessões e histórico — tudo derivado dos
 * agendamentos do marketplace. Sem consulta: CTA para buscar profissional.
 */
export function AgendaPage() {
  const setToast = useAppStore((s) => s.setToast);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const agendamentos = useMarketplaceStore((s) => s.agendamentos);
  const psicologos = useMarketplaceStore((s) => s.psicologos);
  const carregarConsultas = useMarketplaceStore((s) => s.carregarConsultas);

  const [agora, setAgora] = useState(() => Date.now());
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    carregarConsultas().catch(() => {});
  }, [carregarConsultas]);

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const crpPorId = useMemo(
    () => new Map(psicologos.map((p) => [p.id, p.crp])),
    [psicologos],
  );

  const { proximas, passadas } = useMemo(() => {
    const views: SessaoView[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (const a of agendamentos) {
      if (a.status === 'cancelado') continue;
      const inicio = new Date(a.inicio);
      const fim = new Date(a.fim);
      if (Number.isNaN(inicio.getTime())) continue;
      const dia = new Date(inicio);
      dia.setHours(0, 0, 0, 0);
      views.push({
        id: a.id,
        inicio,
        fim,
        psicologoNome: a.psicologoNome ?? 'Psicólogo(a)',
        crp: crpPorId.get(a.psicologoId) ?? 'CRP —',
        duracaoMinutos: a.duracaoMinutos,
        meetingUrl: a.meetingUrl ?? null,
        status: a.status,
        passada: a.status === 'concluido' || a.status === 'no_show' || fim.getTime() < agora,
        ehHoje: dia.getTime() === hoje.getTime(),
      });
    }
    const prox = views
      .filter((v) => !v.passada && v.fim.getTime() >= agora)
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
    const pass = views
      .filter((v) => v.passada)
      .sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
    return { proximas: prox, passadas: pass };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendamentos, crpPorId, Math.floor(agora / 60000)]);

  const proxima = proximas[0] ?? null;
  /* Sala abre 10 min antes e fecha 30 min depois do fim (regra do bookingEngine). */
  const salaAberta = proxima
    ? agora >= proxima.inicio.getTime() - 10 * 60_000 &&
      agora <= proxima.fim.getTime() + 30 * 60_000
    : false;

  const countdown = proxima
    ? salaAberta
      ? 'Sala aberta agora!'
      : formatarCountdown(proxima.inicio.getTime() - agora)
    : '';

  /* --- Calendário --- */
  const [mesVisivel, setMesVisivel] = useState(() => {
    const base = new Date();
    return { ano: base.getFullYear(), mes: base.getMonth() };
  });
  const [selecionado, setSelecionado] = useState<{ ano: number; mes: number; dia: number } | null>(() => {
    const base = new Date();
    return { ano: base.getFullYear(), mes: base.getMonth(), dia: base.getDate() };
  });
  /* Depois que as consultas chegam, centraliza na próxima sessão — salvo se
     o aluno já navegou/selecionou manualmente. */
  const interagiuRef = useRef(false);
  const primeiraCargaRef = useRef(true);
  useEffect(() => {
    if (!proxima || !primeiraCargaRef.current || interagiuRef.current) return;
    primeiraCargaRef.current = false;
    setMesVisivel({ ano: proxima.inicio.getFullYear(), mes: proxima.inicio.getMonth() });
    setSelecionado({
      ano: proxima.inicio.getFullYear(),
      mes: proxima.inicio.getMonth(),
      dia: proxima.inicio.getDate(),
    });
  }, [proxima]);

  const sessoesNoMes = useMemo(() => {
    const mapa = new Map<string, SessaoView[]>();
    for (const s of [...proximas, ...passadas]) {
      if (s.inicio.getFullYear() !== mesVisivel.ano || s.inicio.getMonth() !== mesVisivel.mes) continue;
      const chave = chaveDia(s.inicio);
      const lista = mapa.get(chave) ?? [];
      lista.push(s);
      mapa.set(chave, lista);
    }
    return mapa;
  }, [proximas, passadas, mesVisivel]);

  const dias: (DiaCalendario | null)[] = useMemo(() => {
    const primeiro = new Date(mesVisivel.ano, mesVisivel.mes, 1).getDay();
    const total = new Date(mesVisivel.ano, mesVisivel.mes + 1, 0).getDate();
    const totalAnterior = new Date(mesVisivel.ano, mesVisivel.mes, 0).getDate();
    const hoje = new Date();
    /* Dias-resíduo do mês anterior (cinzentos, sem clique — como no protótipo). */
    const celulas: (DiaCalendario | null)[] = Array.from({ length: primeiro }, (_, i) => ({
      dia: totalAnterior - primeiro + 1 + i,
      temSessao: false,
      ehHoje: false,
      foraDoMes: true,
    }));
    for (let d = 1; d <= total; d++) {
      const chave = `${mesVisivel.ano}-${mesVisivel.mes}-${d}`;
      const tem = sessoesNoMes.has(chave);
      celulas.push({
        dia: d,
        temSessao: tem,
        ehHoje:
          hoje.getFullYear() === mesVisivel.ano &&
          hoje.getMonth() === mesVisivel.mes &&
          hoje.getDate() === d,
      });
    }
    return celulas;
  }, [mesVisivel, sessoesNoMes]);

  function mudarMes(delta: 1 | -1) {
    /* Fora do updater: setState dentro de updater roda 2x no StrictMode. */
    interagiuRef.current = true;
    const d = new Date(mesVisivel.ano, mesVisivel.mes + delta, 1);
    const proximo = { ano: d.getFullYear(), mes: d.getMonth() };
    setMesVisivel(proximo);
    setToast(`Visualizando ${tituloMes(proximo.ano, proximo.mes)}.`, 'info');
    const hoje = new Date();
    if (hoje.getFullYear() === proximo.ano && hoje.getMonth() === proximo.mes) {
      setSelecionado({ ano: proximo.ano, mes: proximo.mes, dia: hoje.getDate() });
    } else {
      setSelecionado(null);
    }
  }

  function selecionarDia(dia: number) {
    interagiuRef.current = true;
    setSelecionado({ ano: mesVisivel.ano, mes: mesVisivel.mes, dia });
    const chave = `${mesVisivel.ano}-${mesVisivel.mes}-${dia}`;
    const sessao = sessoesNoMes.get(chave)?.[0];
    if (sessao) {
      window.setTimeout(() => {
        document
          .getElementById(`session-card-${sessao.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  }

  const feedback: FeedbackDia = useMemo(() => {
    if (!selecionado) {
      return { titulo: 'Nenhum dia selecionado', detalhe: ' — toque em um dia para ver a programação', tom: 'neutro', confirmado: false };
    }
    const chave = `${selecionado.ano}-${selecionado.mes}-${selecionado.dia}`;
    const sessao = sessoesNoMes.get(chave)?.[0];
    const data = new Date(selecionado.ano, selecionado.mes, selecionado.dia);
    const hoje = new Date();
    const ehHoje =
      hoje.getFullYear() === selecionado.ano &&
      hoje.getMonth() === selecionado.mes &&
      hoje.getDate() === selecionado.dia;
    if (sessao) {
      const hora = sessao.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const rotulo = ehHoje
        ? `Dia ${selecionado.dia} (Hoje)`
        : `Dia ${selecionado.dia}/${String(selecionado.mes + 1).padStart(2, '0')} (${data.toLocaleDateString('pt-BR', { weekday: 'long' })})`;
      return {
        titulo: rotulo,
        detalhe: `: Sessão agendada com ${sessao.psicologoNome} às ${hora}`,
        tom: ehHoje ? 'ambar' : 'emerald',
        confirmado: true,
      };
    }
    return {
      titulo: `Dia ${selecionado.dia} de ${data.toLocaleDateString('pt-BR', { month: 'long' })}`,
      detalhe: ': dia de rotina e estudos focados',
      tom: 'neutro',
      confirmado: false,
    };
  }, [selecionado, sessoesNoMes]);

  const diaSelecionado =
    selecionado && selecionado.ano === mesVisivel.ano && selecionado.mes === mesVisivel.mes
      ? selecionado.dia
      : null;
  const destaqueId = (() => {
    if (!selecionado) return null;
    const chave = `${selecionado.ano}-${selecionado.mes}-${selecionado.dia}`;
    return sessoesNoMes.get(chave)?.[0]?.id ?? null;
  })();

  function entrarNaSala() {
    if (!proxima) return;
    if (!salaAberta) {
      setToast(
        `A sala abre 10 minutos antes da sessão (${tempoAte(proxima.inicio.toISOString(), new Date(agora))}).`,
        'info',
      );
      return;
    }
    setEntrando(true);
    setToast(
      `Conectando com segurança. Preparando sala criptografada com ${proxima.psicologoNome}...`,
      'success',
    );
    window.setTimeout(() => {
      setEntrando(false);
      window.open(proxima.meetingUrl ?? 'https://meet.google.com', '_blank', 'noopener');
    }, 1100);
  }

  function irParaApoio() {
    setActiveTab('cuidado');
  }

  const statusProximo = proxima
    ? proxima.ehHoje
      ? `Hoje às ${proxima.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : proxima.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') +
        ` às ${proxima.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Nenhum agendado';

  return (
    <div className="relative animate-fade-up" data-purpose="student-agenda-main">
      <StarfieldCanvas />
      <div className="fixed top-10 left-1/2 -translate-x-1/2 md:left-64 md:translate-x-0 w-72 md:w-96 h-72 md:h-96 max-w-[100vw] bg-amber-500/5 rounded-full blur-3xl pointer-events-none animate-pulse-slow z-0" aria-hidden="true" />
      <div className="fixed bottom-10 right-0 md:right-10 w-72 md:w-[30rem] h-72 md:h-[30rem] max-w-[100vw] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none animate-pulse-slow z-0" style={{ animationDelay: '-3s' }} aria-hidden="true" />

      <div className="relative z-10">
        <header className="border-b border-white/10 bg-midnight-900/70 backdrop-blur-md px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399] animate-ping" />
              Ambiente Seguro &amp; Criptografado
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-midnight-800 text-slate-300 border border-white/10">
              <BadgeCheck size={14} className="text-amber-400" />
              Profissionais Registrados no CRP
            </span>
          </div>
          <a className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors group" href="tel:188">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" />
            Precisa desabafar agora?{' '}
            <span className="font-semibold text-slate-300 group-hover:underline inline-flex items-center gap-1">
              <Phone size={12} /> Ligue 188 (CVV gratuito)
            </span>
          </a>
        </header>

        <div className="pt-8 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 shadow-sm">
                  Espaço de Acolhimento
                </span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-400">Seu momento seguro de escuta</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                Minha Agenda &amp; Sessões
              </h1>
              <p className="text-sm text-slate-400 max-w-2xl mt-1.5">
                Aqui estão todas as suas conversas confirmadas. Seu espaço privado e confidencial para aliviar o peso da rotina do ENEM, respirar e cuidar de você.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-midnight-850 px-4 py-2.5 rounded-2xl border border-white/10 shadow-sm transition-all hover:border-emerald-500/30 shrink-0">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-ping" />
              <div>
                <p className="text-xs text-slate-400">Próximo compromisso</p>
                <p className="text-sm font-bold text-white flex items-center gap-2 tabular-nums">{statusProximo}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {proxima ? (
            <HeroSessao
              sessao={proxima}
              countdown={countdown}
              salaAberta={salaAberta}
              entrando={entrando}
              onEntrar={entrarNaSala}
            />
          ) : (
            <section
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-midnight-800 via-midnight-850 to-midnight-800 border border-dashed border-midnight-600 p-6 sm:p-8 text-center"
              data-purpose="imminent-session-hero"
            >
              <CalendarHeart size={40} className="mx-auto mb-3 text-emerald-400" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">Você ainda não tem sessões marcadas</h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto mt-2 mb-5">
                Marque seu primeiro momento de escuta com um psicólogo registrado no CRP. É privado, seguro e no seu ritmo.
              </p>
              <button
                onClick={irParaApoio}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-midnight-950 font-extrabold text-sm transition-all hover:-translate-y-0.5 active:scale-95 animate-glow-cta"
              >
                Buscar psicólogo
                <ArrowRight size={16} />
              </button>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <Calendario
                tituloMes={tituloMes(mesVisivel.ano, mesVisivel.mes)}
                dias={dias}
                selecionado={diaSelecionado}
                onSelecionar={selecionarDia}
                feedback={feedback}
                onMesAnterior={() => mudarMes(-1)}
                onMesProximo={() => mudarMes(1)}
              />
              <div className="mt-6">
                <Diario />
              </div>
            </div>
            <div className="lg:col-span-5">
              <SessoesLista
                proximas={proximas}
                passadas={passadas}
                destaqueId={destaqueId}
                onBuscarPsicologo={irParaApoio}
              />
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center text-xs text-slate-500 max-w-4xl mx-auto space-y-1.5" data-purpose="page-footer">
          <p>Midnight Mentor © 2025 • Acolhimento e Orientação Emocional para Estudantes Pré-Vestibular.</p>
          <p className="text-[11px] text-slate-600">
            Todas as sessões são conduzidas por profissionais devidamente registrados e habilitados no Conselho Regional de Psicologia (CRP). Em caso de urgência emocional, ligue 188 (CVV).
          </p>
        </footer>
      </div>
    </div>
  );
}
