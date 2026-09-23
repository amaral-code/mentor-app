import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Flame, Loader2, Moon, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useBemEstarStore } from '../../stores/bemEstarStore';
import { Modal } from '../../shared/ui/Modal';
import {
  calcularMetricas,
  destaquesDaSemana,
  inicioDaSemana,
  textoLocalDescompressao,
} from '../../shared/lib/decompressionReport';
import { aiAvailable, gerarRelatorioDescompressao } from '../../shared/lib/aiService';
import { bemEstarRepository } from '../../shared/storage/BemEstarRepository';
import { supabaseRepository } from '../../shared/storage/SupabaseRepository';
import type { MetricasDescompressao } from '../../shared/types';

/**
 * RELATORIO DE DESCOMPRESSAO SEMANAL.
 *
 * Substituiu o painel de "dias ativos / atividades / exercicios". A
 * diferenca nao e visual: o relatorio antigo media producao, este mede o
 * que sustenta a producao. Numa sexta-feira ruim, o primeiro e mais uma
 * cobranca; o segundo e a unica informacao acionavel que resta.
 *
 * O texto vem do Gemini com prompt de sistema fixo
 * (SYSTEM_PROMPT_DESCOMPRESSAO) e, se a IA nao responder, de uma versao
 * local escrita sob as mesmas regras - porque uma promessa semanal nao
 * pode depender de rede.
 */

class LimiteDeErro extends Component<{ children: ReactNode }, { erro: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { erro: false };
  }
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    if (this.state.erro) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-300 font-medium">Não foi possível montar o relatório</p>
          <p className="text-sm text-gray-500 mt-1">Seus dados da semana continuam salvos.</p>
          <button onClick={() => this.setState({ erro: false })} className="btn-primary mt-4 text-sm">
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Conteudo() {
  const logs = useAppStore((s) => s.logs);
  const quizResults = useAppStore((s) => s.quizResults);
  const gamification = useAppStore((s) => s.gamification);
  const sono = useAppStore((s) => s.sono);
  const apiKey = useAppStore((s) => s.apiKey);
  const session = useAppStore((s) => s.session);
  const sessoesOffline = useBemEstarStore((s) => s.sessoesOffline);
  const revisoes = useBemEstarStore((s) => s.revisoes);
  const relatorios = useBemEstarStore((s) => s.relatorios);
  const adicionarRelatorio = useBemEstarStore((s) => s.adicionarRelatorio);

  const [texto, setTexto] = useState('');
  const [gerando, setGerando] = useState(true);
  /*
   * Semana ja processada nesta abertura do modal.
   *
   * As metricas sao recalculadas quando o historico de foco chega (carga
   * assincrona), e sem esta trava o efeito rodaria de novo e pediria um
   * segundo paragrafo a IA - dois textos diferentes para a mesma semana,
   * e uma chamada paga a toa.
   */
  const semanaProcessada = useRef<string | null>(null);
  const [sessoesFoco, setSessoesFoco] = useState<{ tipo: string; minutos: number; data: string }[]>([]);

  useEffect(() => {
    supabaseRepository
      .loadSessoesFoco()
      .then(setSessoesFoco)
      // Silencio proposital: sem o historico de pomodoro o relatorio
      // ainda sai, apenas sem a linha de minutos em ciclo de foco.
      .catch(() => {});
  }, []);

  const metricas: MetricasDescompressao = useMemo(
    () =>
      calcularMetricas({
        logs,
        sessoesOffline,
        sessoesFoco,
        quizzes: quizResults,
        // O slider do dashboard guarda o valor do dia; sem serie
        // historica ainda, ele representa a semana.
        registrosSono: [sono],
        streak: gamification.streak,
        revisoesEmDia: revisoes.filter((r) => r.ultimaRevisao && r.ultimaRevisao >= inicioDaSemana()).length,
      }),
    [logs, sessoesOffline, sessoesFoco, quizResults, sono, gamification.streak, revisoes],
  );

  useEffect(() => {
    let cancelado = false;
    const semana = inicioDaSemana();
    const primeiroNome = session?.nome?.split(' ')[0];

    async function montar() {
      if (semanaProcessada.current === semana) return;
      semanaProcessada.current = semana;

      // Ja existe o texto desta semana: nao gasta chamada de IA de novo.
      const existente = relatorios.find((r) => r.semanaInicio === semana);
      if (existente) {
        if (!cancelado) {
          setTexto(existente.textoGerado);
          setGerando(false);
        }
        return;
      }

      let redacao = textoLocalDescompressao(metricas, primeiroNome);
      if (aiAvailable(apiKey)) {
        try {
          redacao = await gerarRelatorioDescompressao(metricas, apiKey, primeiroNome);
        } catch {
          // Fica o texto local, escrito sob as mesmas regras.
        }
      }

      if (cancelado) {
        semanaProcessada.current = null; // desmontou antes de terminar
        return;
      }
      setTexto(redacao);
      setGerando(false);

      try {
        const salvo = await bemEstarRepository.salvarRelatorio(semana, redacao, metricas);
        if (salvo) adicionarRelatorio(salvo);
      } catch {
        // O relatorio ja esta na tela; nao ter sido arquivado nao muda
        // nada para quem esta lendo agora.
      }
    }

    void montar();
    return () => {
      cancelado = true;
    };
  }, [metricas, apiKey]);

  const destaques = destaquesDaSemana(metricas);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {destaques.map((d) => (
          <div key={d.rotulo} className="glass-light rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{d.rotulo}</p>
            <p className="text-2xl font-bold text-white tabular-nums mt-1">{d.valor}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{d.nota}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] to-transparent p-4">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-emerald-400/80 mb-2">
          <Sparkles size={13} /> Sua semana
        </p>
        {gerando ? (
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Lendo o que você fez nesta semana...
          </p>
        ) : (
          <p className="text-sm text-gray-200 leading-relaxed">{texto}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass-light rounded-xl py-3">
          <ShieldCheck size={16} className="text-cyan-400 mx-auto" />
          <p className="text-sm font-bold text-white tabular-nums mt-1">{metricas.minutosOffline}</p>
          <p className="text-[10px] text-gray-500">min offline</p>
        </div>
        <div className="glass-light rounded-xl py-3">
          <Moon size={16} className="text-violet-400 mx-auto" />
          <p className="text-sm font-bold text-white tabular-nums mt-1">
            {metricas.sessoesMadrugada}
          </p>
          <p className="text-[10px] text-gray-500">noites de madrugada</p>
        </div>
        <div className="glass-light rounded-xl py-3">
          <Flame size={16} className="text-amber-400 mx-auto" />
          <p className="text-sm font-bold text-white tabular-nums mt-1">{metricas.streak}</p>
          <p className="text-[10px] text-gray-500">dias seguidos</p>
        </div>
      </div>

      <p className="text-[11px] text-gray-600 text-center leading-relaxed">
        Este relatório não mede acertos. Ele registra o que sustentou a sua semana, e isso também
        chega para quem acompanha você.
      </p>
    </div>
  );
}

export function WeeklyReportModal() {
  const showWeeklyReport = useAppStore((s) => s.showWeeklyReport);
  const setShowWeeklyReport = useAppStore((s) => s.setShowWeeklyReport);
  if (!showWeeklyReport) return null;

  return (
    <Modal
      open={showWeeklyReport}
      onClose={() => setShowWeeklyReport(false)}
      title="Relatorio de descompressao"
    >
      <LimiteDeErro>
        <Conteudo />
      </LimiteDeErro>
    </Modal>
  );
}
