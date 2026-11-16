import { useState } from 'react';
import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { privacidadeRepository } from '@mentor/api/PrivacidadeRepository';
import { confirmacaoValida, LINKS_LEGAIS, nomeArquivoExportacao, oQueAExclusaoFaz, PALAVRA_EXCLUSAO } from '@mentor/core/privacidade';
import { useAppStore } from '@mentor/state/appStore';

/**
 * Sua conta e seus dados (LGPD, issue #70). Vale para TODOS os papéis:
 * as lojas exigem exclusão dentro do app, e o direito é de qualquer
 * titular, não só do aluno.
 *
 * Excluir pede a palavra digitada (o servidor confere a mesma) porque
 * não há volta: um toque sem querer não pode apagar um ano de estudo.
 */
export function MinhaConta() {
  const papel = useAppStore((s) => s.session?.role ?? 'student');
  const setToast = useAppStore((s) => s.setToast);
  const [baixando, setBaixando] = useState(false);
  const [abrirExclusao, setAbrirExclusao] = useState(false);
  const [palavra, setPalavra] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    setBaixando(true);
    try {
      const dados = await privacidadeRepository.exportarMeusDados();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivoExportacao();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast('Seus dados foram baixados.', 'success');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Não deu para baixar agora.', 'error');
    } finally {
      setBaixando(false);
    }
  }

  async function excluir() {
    if (!confirmacaoValida(palavra)) return;
    setExcluindo(true);
    setErro(null);
    try {
      await privacidadeRepository.excluirConta();
      // Recarrega do zero: a sessão e o que está na memória eram da conta apagada.
      window.location.replace('/');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para excluir agora.');
      setExcluindo(false);
    }
  }

  return (
    <section id="secao-minha-conta" className="cartao p-5 scroll-mt-24 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Sua conta e seus dados</h2>

      <div className="flex flex-wrap gap-3 text-sm">
        <a className="inline-flex items-center gap-1 font-bold text-ceu-600 hover:underline" href={LINKS_LEGAIS.privacidade} target="_blank" rel="noopener">
          Política de privacidade <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
        <a className="inline-flex items-center gap-1 font-bold text-ceu-600 hover:underline" href={LINKS_LEGAIS.termos} target="_blank" rel="noopener">
          Termos de uso <ExternalLink className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-600 leading-relaxed">
          Baixe uma cópia de tudo o que o app guarda sobre você, num arquivo que abre em qualquer computador.
        </p>
        <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={baixar} disabled={baixando}>
          <Download className="w-4 h-4" aria-hidden />
          {baixando ? 'Preparando...' : 'Baixar meus dados'}
        </button>
      </div>

      <div className="border-t-2 border-slate-100 pt-4 space-y-3">
        {!abrirExclusao ? (
          <button type="button" className="text-sm font-bold text-red-600 hover:underline" onClick={() => setAbrirExclusao(true)}>
            Excluir minha conta
          </button>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-red-700">Excluir minha conta</h3>
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
              {oQueAExclusaoFaz(papel).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <label className="block text-sm text-slate-700">
              Para confirmar, digite <strong>{PALAVRA_EXCLUSAO}</strong>
              <input
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm"
                value={palavra}
                onChange={(e) => setPalavra(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </label>
            {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-perigo inline-flex items-center gap-2"
                onClick={excluir}
                disabled={!confirmacaoValida(palavra) || excluindo}
              >
                <Trash2 className="w-4 h-4" aria-hidden />
                {excluindo ? 'Excluindo...' : 'Excluir para sempre'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setAbrirExclusao(false);
                  setPalavra('');
                  setErro(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
