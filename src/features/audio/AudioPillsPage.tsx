import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Headphones, Loader2, Sparkles } from 'lucide-react';
import { conteudoRepository } from '../../shared/storage/ConteudoRepository';
import { useAppStore } from '../../stores/appStore';
import { aiAvailable, gerarRoteiroAudio, sintetizarAudio, hasProxy } from '../../shared/lib/aiService';
import { estimarDuracaoSegundos, formatarTempo, VOZES, roteiroLocalEmergencia } from '../../shared/lib/audioPills';
import { safeGet, safeSet } from '../../shared/lib/safeStorage';
import type { ModuloAudio, ProgressoAudio } from '../../shared/types';
import { AudioPlayer } from './AudioPlayer';
import { EmptyState } from '../../shared/ui/EmptyState';

/**
 * PILULAS DE AUDIO - modo "tela desligada".
 *
 * CACHE EM TRES CAMADAS, POR CUSTO
 *   1. roteiro pronto no banco (seed ou gerado por educador);
 *   2. roteiro gerado pela IA e guardado no localStorage do aparelho -
 *      texto e leve e nao muda;
 *   3. mp3 sintetizado, mantido apenas em memoria da sessao. Um data:URL
 *      de 3 minutos tem cerca de 1,5 MB e estouraria a cota do
 *      localStorage em cinco pilulas.
 *
 * Reabrir o app re-sintetiza (fracao de centavo); trocar de pilula e
 * voltar, nao.
 */

const CHAVE_ROTEIRO = 'mm_roteiro_audio_';

export function AudioPillsPage() {
  const apiKey = useAppStore((s) => s.apiKey);
  const setToast = useAppStore((s) => s.setToast);
  const addLog = useAppStore((s) => s.addLog);
  const [modulos, setModulos] = useState<ModuloAudio[]>([]);
  const [progresso, setProgresso] = useState<Record<string, ProgressoAudio>>({});
  const [ativo, setAtivo] = useState<ModuloAudio | null>(null);
  const [roteiro, setRoteiro] = useState('');
  const [audio, setAudio] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [voz, setVoz] = useState(VOZES[0].id);
  const [cacheAudio] = useState(() => new Map<string, string>());

  useEffect(() => {
    setCarregando(true);
    Promise.all([conteudoRepository.listarModulos(), conteudoRepository.carregarProgresso()])
      .then(([m, p]) => {
        setModulos(m);
        setProgresso(p);
      })
      // Silencio proposital: catalogo vazio ja comunica "nao carregou"
      // e o aluno pode tentar de novo puxando a tela.
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const porMateria = useMemo(() => {
    const mapa = new Map<string, ModuloAudio[]>();
    for (const m of modulos) {
      const lista = mapa.get(m.materia) ?? [];
      lista.push(m);
      mapa.set(m.materia, lista);
    }
    return [...mapa.entries()];
  }, [modulos]);

  /** Roteiro completo: cache local -> banco -> IA. */
  async function obterRoteiro(modulo: ModuloAudio): Promise<string> {
    const salvo = safeGet(CHAVE_ROTEIRO + modulo.id);
    if (salvo && salvo.length > 400) return salvo;

    // O seed do banco traz um roteiro-esboco terminado em marcador; se o
    // texto ja for completo, usa direto.
    if (modulo.roteiro && modulo.roteiro.length > 400 && !modulo.roteiro.includes('[roteiro completo')) {
      return modulo.roteiro;
    }

    // Sem IA (offline, sem chave, sem servidor): versão curta de bolso,
    // 100% local — a pílula SEMPRE toca, com a mesma voz. Nunca inventa
    // conteúdo de estudo: avisa que é a curta e guia revisão com o resumo.
    // A curta NÃO vai ao cache: senão, quando a IA voltar, o app
    // continuaria servindo a curta (ela passa no filtro de 400 chars).
    if (!aiAvailable(apiKey)) {
      setToast('Sem conexão com a IA: tocando a versão curta de bolso.', 'info');
      return roteiroLocalEmergencia(modulo.materia, modulo.topico, modulo.resumo);
    }

    try {
      const texto = await gerarRoteiroAudio(modulo.materia, modulo.topico, apiKey);
      safeSet(CHAVE_ROTEIRO + modulo.id, texto);
      return texto;
    } catch {
      setToast('A IA falhou: tocando a versão curta de bolso.', 'info');
      return roteiroLocalEmergencia(modulo.materia, modulo.topico, modulo.resumo);
    }
  }

  async function abrir(modulo: ModuloAudio) {
    setAtivo(modulo);
    setAudio(null);
    setRoteiro('');
    setGerando(true);

    try {
      const texto = await obterRoteiro(modulo);
      setRoteiro(texto);

      const emCache = cacheAudio.get(modulo.id + voz);
      if (emCache) {
        setAudio(emCache);
      } else if (hasProxy()) {
        const { url } = await sintetizarAudio(texto, { voz });
        cacheAudio.set(modulo.id + voz, url);
        setAudio(url);
      }
      // Sem proxy: audio fica null e o player usa a voz do sistema.
    } catch (e: any) {
      setToast(e?.message || 'Não foi possível preparar esta pílula.', 'error');
    } finally {
      setGerando(false);
    }
  }

  function salvarProgresso(modulo: ModuloAudio, segundos: number, concluido: boolean) {
    setProgresso((p) => ({
      ...p,
      [modulo.id]: { moduloId: modulo.id, segundosOuvidos: segundos, concluido },
    }));
    conteudoRepository.salvarProgresso(modulo.id, segundos, concluido).catch(() => {
      // Progresso local continua valendo; o servidor sincroniza depois.
    });
  }

  function concluir(modulo: ModuloAudio) {
    if (progresso[modulo.id]?.concluido) return;
    salvarProgresso(modulo, modulo.duracaoSegundos, true);
    addLog({
      timestamp: Date.now(),
      type: 'atividade',
      description: `Pilula de audio ouvida: ${modulo.titulo}`,
      xp: 15,
    });
    setToast('Pilula concluida. +15 XP', 'success');
  }

  return (
    <div className="space-y-5 animate-fade-up max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-600/10 flex items-center justify-center">
          <Headphones size={20} className="text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-white">Pilulas de Audio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tres minutos por tema. Fone no ouvido, tela apagada.</p>
        </div>
      </div>

      {ativo && (
        <div className="glass rounded-2xl p-5 space-y-4 border border-violet-500/15">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-violet-400/80">{ativo.materia}</p>
            <h2 className="text-lg font-bold text-white mt-0.5">{ativo.titulo}</h2>
            <p className="text-xs text-gray-500 mt-1">{ativo.resumo}</p>
          </div>

          {gerando ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              Preparando o audio desta pílula...
            </div>
          ) : (
            <>
              <AudioPlayer
                src={audio}
                textoFallback={roteiro}
                duracaoEstimada={roteiro ? estimarDuracaoSegundos(roteiro) : ativo.duracaoSegundos}
                posicaoInicial={progresso[ativo.id]?.segundosOuvidos ?? 0}
                onProgresso={(s, c) => salvarProgresso(ativo, s, c)}
                onFim={() => concluir(ativo)}
              />

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.04]">
                <select
                  value={voz}
                  onChange={(e) => {
                    setVoz(e.target.value);
                    setAudio(null);
                  }}
                  aria-label="Voz da locucao"
                  className="bg-transparent text-xs text-gray-400 border border-white/[0.06] rounded-lg px-2 py-1.5"
                >
                  {VOZES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900">
                      {v.nome} ({v.genero})
                    </option>
                  ))}
                </select>

                <button onClick={() => setAtivo(null)} className="btn-ghost text-xs text-gray-500">
                  Fechar
                </button>
              </div>

              {roteiro && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer hover:text-gray-300">Ler o roteiro</summary>
                  <p className="mt-2 leading-relaxed whitespace-pre-line text-gray-400">{roteiro}</p>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {carregando && <p className="text-sm text-gray-500 text-center py-8">Carregando catálogo...</p>}

      {!carregando && modulos.length === 0 && (
        <div className="glass rounded-2xl p-5">
          <EmptyState
            pose="estudando"
            titulo="Nenhuma pílula disponivel"
            descricao="Rode a migração 011 no Supabase para carregar o catálogo inicial de áudios."
          />
        </div>
      )}

      {porMateria.map(([materia, lista]) => (
        <div key={materia} className="glass rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">{materia}</h2>
          <div className="space-y-2">
            {lista.map((m) => {
              const p = progresso[m.id];
              return (
                <button
                  key={m.id}
                  onClick={() => abrir(m)}
                  className="w-full flex items-center gap-3 py-3 px-3 rounded-xl glass-light border border-white/[0.03] hover:border-violet-500/20 text-left press"
                >
                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                    {p?.concluido ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <Sparkles size={16} className="text-violet-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.titulo}</p>
                    <p className="text-[11px] text-gray-500 truncate">{m.topico}</p>
                  </div>
                  <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                    {p && !p.concluido && p.segundosOuvidos > 5
                      ? `${formatarTempo(p.segundosOuvidos)} / ${formatarTempo(m.duracaoSegundos)}`
                      : formatarTempo(m.duracaoSegundos)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
