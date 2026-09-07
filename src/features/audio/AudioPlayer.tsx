import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { formatarTempo, estaConcluido, escolherVozNativa, VELOCIDADE_PADRAO } from '../../shared/lib/audioPills';

interface AudioPlayerProps {
  /** data: URL do mp3 sintetizado, ou null para usar a voz do sistema. */
  src: string | null;
  /** Texto lido pela voz nativa quando nao ha mp3. */
  textoFallback: string;
  duracaoEstimada: number;
  posicaoInicial?: number;
  onProgresso?: (segundos: number, concluido: boolean) => void;
  onFim?: () => void;
}

/**
 * PLAYER DAS PILULAS DE AUDIO.
 *
 * DOIS MOTORES, UMA INTERFACE
 * Quando o worker sintetizou o mp3, toca <audio> - qualidade de locucao
 * neural, funciona com a tela apagada e aparece nos controles do sistema
 * (media session). Sem worker configurado, cai na SpeechSynthesis do
 * proprio aparelho: voz pior, mas de graca, offline e sem chave.
 *
 * A CAIXA DE FALLBACK TEM UM LIMITE HONESTO
 * SpeechSynthesis nao da posicao confiavel nem sobrevive a tela apagada
 * no iOS. Entao, nesse modo, o progresso e estimado pelo tempo decorrido
 * e a interface avisa que o audio para se a tela apagar - melhor dizer
 * do que deixar o aluno descobrir no onibus.
 */
export function AudioPlayer({
  src,
  textoFallback,
  duracaoEstimada,
  posicaoInicial = 0,
  onProgresso,
  onFim,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(posicaoInicial);
  const [duracao, setDuracao] = useState(duracaoEstimada);
  const [velocidade, setVelocidade] = useState(VELOCIDADE_PADRAO);
  const ultimoSalvo = useRef(posicaoInicial);
  const inicioFallback = useRef<number | null>(null);
  /* Vozes do sistema chegam de forma assíncrona (e mudam por idioma
     instalado): guarda a lista para escolher a melhor pt-BR feminina. */
  const [vozesSistema, setVozesSistema] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const carregar = () => setVozesSistema(speechSynthesis.getVoices());
    carregar();
    speechSynthesis.addEventListener('voiceschanged', carregar);
    return () => speechSynthesis.removeEventListener('voiceschanged', carregar);
  }, []);

  const usandoVozNativa = !src;

  // Salva a posicao a cada 15 s de reproducao, nao a cada timeupdate
  // (que dispara 4x por segundo e geraria centenas de upserts).
  function reportar(segundos: number, forcar = false) {
    setPosicao(segundos);
    const concluido = estaConcluido(segundos, duracao);
    if (forcar || Math.abs(segundos - ultimoSalvo.current) >= 15 || concluido) {
      ultimoSalvo.current = segundos;
      onProgresso?.(segundos, concluido);
    }
  }

  useEffect(() => {
    return () => {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    // Troca de pilula: zera tudo e para qualquer voz em curso.
    setTocando(false);
    setPosicao(posicaoInicial);
    ultimoSalvo.current = posicaoInicial;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, [src, textoFallback]);

  // Progresso estimado no modo voz nativa.
  useEffect(() => {
    if (!tocando || !usandoVozNativa) return;
    inicioFallback.current = Date.now() - posicao * 1000;
    const id = window.setInterval(() => {
      const decorrido = (Date.now() - (inicioFallback.current ?? Date.now())) / 1000;
      reportar(Math.min(decorrido, duracao));
      if (decorrido >= duracao) {
        setTocando(false);
        onFim?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [tocando, usandoVozNativa, duracao]);

  function alternar() {
    if (usandoVozNativa) {
      if (tocando) {
        speechSynthesis.pause();
        setTocando(false);
        reportar(posicao, true);
        return;
      }
      if (speechSynthesis.paused && speechSynthesis.speaking) {
        speechSynthesis.resume();
      } else {
        const fala = new SpeechSynthesisUtterance(textoFallback);
        fala.lang = 'pt-BR';
        // Melhor pt-BR feminina instalada (Google/Microsoft/Apple); sem
        // isso o navegador pegava a default — muitas vezes masculina ou
        // até de outro idioma.
        const indice = escolherVozNativa(vozesSistema);
        if (indice >= 0 && vozesSistema[indice]) fala.voice = vozesSistema[indice];
        fala.rate = velocidade;
        fala.pitch = 1.05;
        fala.onend = () => {
          setTocando(false);
          reportar(duracao, true);
          onFim?.();
        };
        speechSynthesis.cancel();
        speechSynthesis.speak(fala);
      }
      setTocando(true);
      return;
    }

    const el = audioRef.current;
    if (!el) return;
    if (tocando) {
      el.pause();
      reportar(el.currentTime, true);
    } else {
      void el.play();
    }
    setTocando(!tocando);
  }

  function pular(segundos: number) {
    const alvo = Math.max(0, Math.min(posicao + segundos, duracao));
    if (usandoVozNativa) {
      // Sem seek real: a voz nativa nao expoe posicao. Reinicia do zero
      // se voltar, ou apenas ajusta o contador se avancar.
      inicioFallback.current = Date.now() - alvo * 1000;
      reportar(alvo, true);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = alvo;
    reportar(alvo, true);
  }

  const progresso = duracao > 0 ? (posicao / duracao) * 100 : 0;

  return (
    <div className="space-y-3">
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = (e.target as HTMLAudioElement).duration;
            if (Number.isFinite(d) && d > 0) setDuracao(d);
            if (posicaoInicial > 0) (e.target as HTMLAudioElement).currentTime = posicaoInicial;
          }}
          onTimeUpdate={(e) => reportar((e.target as HTMLAudioElement).currentTime)}
          onEnded={() => {
            setTocando(false);
            reportar(duracao, true);
            onFim?.();
          }}
        />
      )}

      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500"
          style={{ width: `${progresso}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-500 tabular-nums">
        <span>{formatarTempo(posicao)}</span>
        <span>{formatarTempo(duracao)}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => pular(-15)}
          aria-label="Voltar 15 segundos"
          className="tap-target text-gray-400 hover:text-white"
        >
          <RotateCcw size={20} />
        </button>

        <button
          onClick={alternar}
          aria-label={tocando ? 'Pausar' : 'Tocar'}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 press"
        >
          {tocando ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
        </button>

        <button
          onClick={() => pular(15)}
          aria-label="Avancar 15 segundos"
          className="tap-target text-gray-400 hover:text-white"
        >
          <RotateCw size={20} />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2">
        {[0.85, 1, VELOCIDADE_PADRAO, 1.25, 1.5].map((v) => (
          <button
            key={v}
            onClick={() => {
              setVelocidade(v);
              if (audioRef.current) audioRef.current.playbackRate = v;
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
              velocidade === v ? 'bg-violet-500/15 text-violet-300' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {v}x
          </button>
        ))}
      </div>

      {usandoVozNativa && (
        <p className="text-[11px] text-amber-400/70 text-center leading-snug">
          Voz feminina do próprio aparelho (automática): funciona sem internet, mas para se a tela apagar.
          Com o servidor de audio configurado, a pilula vira mp3 e continua no bolso.
        </p>
      )}
    </div>
  );
}
