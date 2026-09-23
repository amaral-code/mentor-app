import { useEffect, useRef, useState } from 'react';
import { Camera, FileImage, Loader2, RefreshCw, ScanLine, TriangleAlert } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { prepararFotoRedacao, formatarBytes } from '../../shared/lib/imagePrep';
import {
  COMPETENCIAS,
  corrigirRedacaoPorFoto,
  paraEssayCorrection,
  temEndpointDeRedacao,
  type ResultadoCorrecaoFoto,
} from '../../shared/lib/essayScan';
import { aiAvailable } from '../../shared/lib/aiService';

/**
 * CORRECAO DE REDACAO MANUSCRITA.
 *
 * O caso de uso e concreto: o aluno escreve no caderno (como escreve na
 * prova) e nao quer digitar tudo de novo so para receber nota. Ele
 * fotografa a folha e recebe transcricao + correcao pelas 5 competencias.
 *
 * DECISOES DE INTERFACE
 * - A foto e tratada ANTES de subir (imagePrep): 4 MB viram ~400 kB, e o
 *   ganho aparece na tela - em 4G, saber que ja comprimiu e a diferenca
 *   entre esperar e desistir.
 * - A tela final e dividida porque a transcricao PRECISA ser conferivel:
 *   se o OCR leu errado, a nota esta avaliando outro texto, e o aluno tem
 *   que poder ver isso lado a lado com a propria letra.
 * - Foto ilegivel nao vira "0 de 1000". Zero seria uma avaliacao da
 *   redacao; o problema foi a foto, e a tela diz isso e pede outra.
 */

interface RedacaoFotoProps {
  tema: string;
  /** Leva a transcricao para o editor de texto, para revisar e reenviar. */
  onUsarTranscricao: (texto: string) => void;
}

const CORES_NOTA = (nota: number) =>
  nota >= 160 ? '#10b981' : nota >= 120 ? '#f59e0b' : nota >= 80 ? '#f97316' : '#ef4444';

export function RedacaoFoto({ tema, onUsarTranscricao }: RedacaoFotoProps) {
  // Seletores atomicos: o processamento da foto atualiza etapa/previa varias
  // vezes; assinar o store inteiro faria cada uma dessas atualizacoes
  // re-renderizar junto com qualquer outro update global.
  const apiKey = useAppStore((s) => s.apiKey);
  const setToast = useAppStore((s) => s.setToast);
  const addXP = useAppStore((s) => s.addXP);
  const addLog = useAppStore((s) => s.addLog);
  const setLastCorrection = useAppStore((s) => s.setLastCorrection);

  const [previa, setPrevia] = useState<string | null>(null);
  const [info, setInfo] = useState<{ antes: number; depois: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState('');
  const [resultado, setResultado] = useState<ResultadoCorrecaoFoto | null>(null);

  const inputCamera = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  /* URL temporária da prévia: sem revoke, cada foto vazava um blob. */
  const previaUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (previaUrlRef.current) URL.revokeObjectURL(previaUrlRef.current);
  }, []);

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    // Allowlist explícita (o `accept` do input é só sugestão: drag-drop e
    // alguns Android ignoram). SVG vetado de propósito: pode carregar
    // script/active content; o re-encode do imagePrep neutraliza, mas a
    // validação aqui barra antes de qualquer processamento.
    const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (arquivo && !MIMES_FOTO.includes(arquivo.type)) {
      setToast('Formato não aceito. Use JPG ou PNG.', 'error');
      evento.target.value = '';
      return;
    }
    if (arquivo && arquivo.size > 8 * 1024 * 1024) {
      setToast('Imagem muito grande. Máximo 8MB.', 'error');
      evento.target.value = '';
      return;
    }
    evento.target.value = ''; // permite reenviar a MESMA foto depois
    if (!arquivo) return;

    if (!aiAvailable(apiKey)) {
      setToast('Configure a IA no Perfil para corrigir por foto.', 'error');
      return;
    }

    setResultado(null);
    setEnviando(true);
    setEtapa('Preparando a foto...');

    try {
      const preparada = await prepararFotoRedacao(arquivo);
      setInfo({ antes: preparada.bytesAntes, depois: preparada.bytesDepois });
      if (previaUrlRef.current) URL.revokeObjectURL(previaUrlRef.current);
      previaUrlRef.current = URL.createObjectURL(preparada.arquivo);
      setPrevia(previaUrlRef.current);

      setEtapa(temEndpointDeRedacao() ? 'Enviando e lendo a letra...' : 'Lendo a letra...');
      const correcao = await corrigirRedacaoPorFoto(preparada.arquivo, { tema, apiKey });
      setResultado(correcao);

      if (correcao.ilegivel) {
        setToast('Nao consegui ler a folha. Tente outra foto com mais luz.', 'error');
        return;
      }

      // Mesma recompensa da redacao digitada - o esforco foi o mesmo, e
      // maior: ele escreveu a mao.
      const xp = correcao.total_score >= 600 ? 100 : 50;
      addXP(xp);
      addLog({
        timestamp: Date.now(),
        type: 'essay',
        description: `Redação do caderno corrigida: ${correcao.total_score}/1000`,
        xp,
      });
      setLastCorrection(paraEssayCorrection(correcao));
      setToast(`Correção pronta: ${correcao.total_score}/1000`, 'success');
    } catch (erro: any) {
      setToast(erro?.message || 'Nao foi possivel corrigir esta foto.', 'error');
    } finally {
      setEnviando(false);
      setEtapa('');
    }
  }

  function recomecar() {
    if (previaUrlRef.current) {
      URL.revokeObjectURL(previaUrlRef.current);
      previaUrlRef.current = null;
    }
    setResultado(null);
    setPrevia(null);
    setInfo(null);
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/15 to-cyan-600/10 flex items-center justify-center shrink-0">
          <ScanLine size={18} className="text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-300">Escreveu no caderno?</h2>
          <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
            Fotografe a folha: a IA transcreve a sua letra e corrige pelas 5 competências do ENEM.
          </p>
        </div>
      </div>

      {!resultado && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => inputCamera.current?.click()}
              disabled={enviando}
              className="btn-primary !py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Camera size={16} /> Tirar foto
            </button>
            <button
              onClick={() => inputArquivo.current?.click()}
              disabled={enviando}
              className="btn-secondary !py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileImage size={16} /> Carregar do caderno
            </button>
          </div>

          {/* capture="environment" abre a camera traseira direto no celular;
              no desktop o mesmo input vira seletor de arquivo. */}
          <input
            ref={inputCamera}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={aoEscolher}
            className="hidden"
          />
          <input ref={inputArquivo} type="file" accept="image/*" onChange={aoEscolher} className="hidden" />

          <p className="text-[11px] text-gray-600 leading-relaxed">
            Dica: folha inteira no enquadramento, luz de cima e sem sombra da própria mão. A imagem é
            reduzida e tratada no seu aparelho antes de subir.
          </p>
        </>
      )}

      {enviando && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 size={15} className="animate-spin" />
          {etapa}
          {info && (
            <span className="text-[11px] text-gray-600">
              ({formatarBytes(info.antes)} → {formatarBytes(info.depois)})
            </span>
          )}
        </div>
      )}

      {resultado?.ilegivel && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <TriangleAlert size={14} /> Não consegui ler esta foto
          </p>
          <p className="text-xs text-amber-200/70 mt-1.5 leading-relaxed">
            A nota não foi calculada. O problema foi a imagem, não o seu texto. Tente de novo com mais
            luz, sem sombra e com a folha reta.
          </p>
          <button onClick={recomecar} className="btn-secondary !px-3 !py-2 text-xs mt-3 inline-flex items-center gap-1.5">
            <RefreshCw size={13} /> Tirar outra foto
          </button>
        </div>
      )}

      {resultado && !resultado.ilegivel && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---------------- Lado A: imagem + transcricao ---------------- */}
          <div className="space-y-3 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">Sua folha</p>

            {(previa || resultado.image_url) && (
              <a
                href={resultado.image_url || previa || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden border border-white/[0.06]"
              >
                <img
                  src={previa || resultado.image_url || ''}
                  alt="Foto da redação enviada"
                  className="w-full h-auto max-h-72 object-contain bg-black/30"
                  onError={(e) => {
                    // URL assinada do Supabase expira em 7 dias: tenta a outra
                    // fonte antes de mostrar ícone quebrado.
                    const alternativa = e.currentTarget.src === previa ? resultado.image_url : previa;
                    if (alternativa && e.currentTarget.src !== alternativa) {
                      e.currentTarget.src = alternativa;
                    } else {
                      e.currentTarget.style.display = 'none';
                    }
                  }}
                />
              </a>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] uppercase tracking-wider text-gray-500">Transcrição (OCR)</p>
                <button
                  onClick={() => onUsarTranscricao(resultado.transcription)}
                  className="text-[11px] text-amber-400 hover:text-amber-300"
                >
                  Editar no campo de texto
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                  {resultado.transcription}
                </p>
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">
                Confira a transcrição: se a IA leu errado, a nota avaliou outro texto.
              </p>
            </div>
          </div>

          {/* ---------------- Lado B: nota e competencias ---------------- */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Correção ENEM</p>
              <span className="text-[11px] text-gray-500 truncate max-w-[60%]" title={resultado.detected_theme}>
                {resultado.detected_theme}
              </span>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 p-4 text-center">
              <p className="text-4xl font-extrabold text-white tabular-nums">{resultado.total_score}</p>
              <p className="text-[11px] text-gray-500">de 1000</p>
            </div>

            <div className="space-y-2">
              {COMPETENCIAS.map((c, i) => {
                const nota = resultado.scores[c.chave];
                const cor = CORES_NOTA(nota.score);
                return (
                  <details key={c.chave} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                    <summary className="flex items-center justify-between cursor-pointer list-none gap-2">
                      <span className="text-xs text-gray-300 truncate">
                        C{i + 1}. {c.titulo}
                      </span>
                      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: cor }}>
                        {nota.score}
                      </span>
                    </summary>
                    <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden my-2">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${(nota.score / 200) * 100}%`, background: cor }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{nota.feedback}</p>
                  </details>
                );
              })}
            </div>

            {resultado.strengths.length > 0 && (
              <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-3">
                <p className="text-[11px] font-semibold text-emerald-300 mb-1.5">O que já funciona</p>
                <ul className="space-y-1">
                  {resultado.strengths.map((s) => (
                    <li key={s} className="text-[11px] text-emerald-100/80 leading-snug">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.actionable_improvements.length > 0 && (
              <div className="rounded-xl bg-sky-500/[0.06] border border-sky-500/15 p-3">
                <p className="text-[11px] font-semibold text-sky-300 mb-1.5">Na próxima redação</p>
                <ul className="space-y-1">
                  {resultado.actionable_improvements.map((s) => (
                    <li key={s} className="text-[11px] text-sky-100/80 leading-snug">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={recomecar} className="btn-secondary w-full !py-2.5 text-xs inline-flex items-center justify-center gap-1.5">
              <RefreshCw size={13} /> Corrigir outra folha
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
