/**
 * Efeitos sonoros sintetizados via Web Audio API.
 * 100% local, sem arquivos de áudio.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  // Autoplay-policy: o contexto pode nascer suspenso e todo play virava
  // silêncio sem erro. Retomar aqui cobre todos os efeitos de uma vez.
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

export function playClick() {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 800;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

export function playCorrect() {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
}

export function playError() {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

export function playLevelUp() {
  const ctx = getCtx();
  if (!ctx) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.3);
  });
}

export function playAchievement() {
  const ctx = getCtx();
  if (!ctx) return;
  const notes = [784, 784, 880, 880, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.4);
  });
}

/**
 * Voz do Mentor (Web Speech API).
 *
 * Três problemas da versão antiga:
 * 1. Pegava a PRIMEIRA voz 'pt' da lista - quase sempre a robótica
 *    (eSpeak) em vez das naturais (Google/Microsoft).
 * 2. Falava o markdown cru (asteriscos, #, listas) - soava quebrado.
 * 3. Enfileirava o texto inteiro de uma vez: demorava para começar e o
 *    "parar" não respondia no meio de respostas longas.
 */
let vozesPt: SpeechSynthesisVoice[] = [];

function carregarVozes() {
  try {
    vozesPt = window.speechSynthesis?.getVoices().filter((v) =>
      v.lang.toLowerCase().startsWith('pt'),
    ) ?? [];
  } catch {
    vozesPt = [];
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  carregarVozes();
  // As vozes chegam de forma assíncrona no Chrome: sem esse listener a
  // primeira fala sempre caía na voz padrão do sistema.
  window.speechSynthesis.onvoiceschanged = carregarVozes;
}

/** Pontua vozes pt-BR: natural/neural primeiro, robótica por último. */
function escolherMelhorVoz(): SpeechSynthesisVoice | null {
  if (vozesPt.length === 0) carregarVozes();
  if (vozesPt.length === 0) return null;
  const pontuar = (v: SpeechSynthesisVoice): number => {
    const nome = v.name.toLowerCase();
    let pontos = 0;
    if (v.lang.toLowerCase() === 'pt-br') pontos += 10;
    if (v.default) pontos += 2;
    if (/google.*(brasil|portugu)/.test(nome)) pontos += 8;
    if (/natural|neural/.test(nome)) pontos += 6;
    if (/microsoft/.test(nome)) pontos += 4;
    if (/fernanda|camila|vitoria|lucas|daniel|heloisa/.test(nome)) pontos += 3;
    if (/espeak|festival|robot|robson|whisper/.test(nome)) pontos -= 20;
    return pontos;
  };
  return [...vozesPt].sort((a, b) => pontuar(b) - pontuar(a))[0] ?? null;
}

/** Tira o markdown para a fala não ler "asterisco asterisco". */
export function limparParaFala(texto: string): string {
  return texto
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*•\d]+[.)]\s+/gm, '')
    .replace(/[`#|]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Divide em frases (~180 chars): começa a falar na hora e para rápido. */
function fatiarParaFala(texto: string): string[] {
  const frases = texto.match(/[^.!?…\n]+[.!?…]+["”)]?|\S[^.!?…\n]*$/g) ?? [texto];
  const fatias: string[] = [];
  let atual = '';
  for (const f of frases) {
    const parte = f.trim();
    if (!parte) continue;
    if ((atual + ' ' + parte).trim().length > 200 && atual) {
      fatias.push(atual.trim());
      atual = parte;
    } else {
      atual = `${atual} ${parte}`;
    }
  }
  if (atual.trim()) fatias.push(atual.trim());
  // Fala no máximo ~2 min: o resto o aluno lê no chat.
  return fatias.slice(0, 12);
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const limpo = limparParaFala(text);
  if (!limpo) return;
  const voz = escolherMelhorVoz();
  const fatias = fatiarParaFala(limpo);
  fatias.forEach((fatia, i) => {
    const utterance = new SpeechSynthesisUtterance(fatia);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.2;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    if (voz) utterance.voice = voz;
    if (onEnd && i === fatias.length - 1) utterance.onend = onEnd;
    utterance.onerror = () => {};
    synth.speak(utterance);
  });
}

export function stopSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
