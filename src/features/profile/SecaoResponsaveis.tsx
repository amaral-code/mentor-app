import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { marketplaceRepository } from '../../shared/storage/MarketplaceRepository';
import { userRepository } from '../../shared/storage/UserRepository';
import { ehMenorDe16, formatarCodigo, validarDataNascimento } from '../../shared/lib/vinculoCodigo';
import type { ResponsavelVinculado } from '../../shared/types';

/**
 * RESPONSAVEIS — a metade do vinculo que fica com o ALUNO.
 *
 * O codigo aparece aqui, e nao no cadastro do responsavel, porque e
 * assim que quem controla o acesso e o dono dos dados: ninguem pede
 * nada, o aluno entrega a quem quiser. Entregar o codigo ja e o
 * consentimento — por isso o vinculo nasce ativo e nao ha "aceitar
 * pedido" nesta tela.
 *
 * O que sobra para o aluno depois disso e o que evita que o codigo vire
 * porta sem volta: ele VE quem entrou, REVOGA quando quiser e troca o
 * codigo que vazou. Trocar o codigo nao expulsa ninguem — sao coisas
 * diferentes e a tela diz isso, porque confundir as duas faria o aluno
 * achar que se livrou de um acompanhamento que continua ativo.
 *
 * A data de nascimento mora nesta secao de proposito: e aqui que o
 * motivo dela (autorizacao do responsavel para falar com psicologo)
 * cabe numa frase.
 */
export function SecaoResponsaveis() {
  const session = useAppStore((s) => s.session);
  const setToast = useAppStore((s) => s.setToast);

  const [codigo, setCodigo] = useState<string | null>(null);
  const [lista, setLista] = useState<ResponsavelVinculado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const [revogando, setRevogando] = useState<string | null>(null);

  const [nascimento, setNascimento] = useState(session?.dataNascimento ?? '');
  const [salvandoData, setSalvandoData] = useState(false);

  useEffect(() => {
    let vivo = true;
    void Promise.all([marketplaceRepository.meuCodigoVinculo(), marketplaceRepository.meusResponsaveis()])
      .then(([c, r]) => {
        if (!vivo) return;
        setCodigo(c);
        setLista(r);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    setNascimento(session?.dataNascimento ?? '');
  }, [session?.dataNascimento]);

  async function copiar() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissao de area de transferencia (http, navegador antigo):
      // o codigo continua legivel na tela, entao so avisa.
      setToast('Copie o código manualmente: ' + formatarCodigo(codigo), 'info');
    }
  }

  async function trocarCodigo() {
    setTrocando(true);
    try {
      const novo = await marketplaceRepository.regenerarCodigoVinculo();
      setCodigo(novo);
      setConfirmandoTroca(false);
      setToast('Código trocado. O antigo não funciona mais.', 'success');
    } catch {
      setToast('Não foi possível trocar o código agora.', 'error');
    } finally {
      setTrocando(false);
    }
  }

  async function revogar(v: ResponsavelVinculado) {
    setRevogando(v.id);
    try {
      await marketplaceRepository.revogarVinculo(v.id);
      setLista((atual) => atual.filter((x) => x.id !== v.id));
      setToast(`${v.nome} não acompanha mais você.`, 'success');
    } catch {
      setToast('Não foi possível remover agora.', 'error');
    } finally {
      setRevogando(null);
    }
  }

  async function salvarNascimento() {
    const validacao = validarDataNascimento(nascimento);
    if (!validacao.ok) {
      setToast(validacao.erro, 'error');
      return;
    }
    setSalvandoData(true);
    const ok = await userRepository.salvarDataNascimento(nascimento);
    setSalvandoData(false);
    if (!ok) {
      setToast('Não foi possível salvar a data agora.', 'error');
      return;
    }
    const nova = await userRepository.getSession();
    if (nova) useAppStore.getState().setSession(nova);
    setToast('Data de nascimento salva.', 'success');
  }

  const menor = ehMenorDe16(session?.dataNascimento);

  return (
    <div id="secao-responsaveis" className="glass-card rounded-2xl p-5 scroll-mt-24">
      <h2 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
        <ShieldCheck size={15} className="text-violet-400" /> Responsáveis
      </h2>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Quem tem seu código vê seu ritmo de estudo e seus sinais de cansaço. Nunca suas
        conversas, seu caderno ou o que você escreve sobre como está se sentindo.
      </p>

      {/* ---------- Código ---------- */}
      <div className="glass-light rounded-xl p-4 border border-white/[0.05]">
        <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">
          Seu código
        </label>
        {carregando ? (
          <div className="h-9 w-40 rounded-lg bg-white/5 animate-pulse" />
        ) : codigo ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xl font-extrabold tracking-[0.2em] text-amber-300 tabular-nums select-all">
              {formatarCodigo(codigo)}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:border-amber-400/40 hover:text-amber-200 transition-all min-h-[40px]"
            >
              {copiado ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Código indisponível. Tente recarregar a página.</p>
        )}

        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Entregue este código a quem você quer que acompanhe seus estudos. Quem digitar
          passa a te acompanhar na hora, então só dê a quem você confia.
        </p>

        {codigo &&
          (confirmandoTroca ? (
            <div className="mt-3 rounded-lg bg-amber-500/[0.07] border border-amber-500/20 p-3">
              {/* A confusao que esta frase evita: trocar o codigo NAO
                  remove quem ja entrou. */}
              <p className="text-xs text-amber-200/90 leading-relaxed">
                O código atual para de funcionar. Quem <strong>já</strong> acompanha você
                continua na lista abaixo. Para tirar alguém, use “Remover”.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={trocarCodigo}
                  disabled={trocando}
                  className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-semibold text-amber-200 min-h-[40px] disabled:opacity-60"
                >
                  {trocando ? 'Trocando…' : 'Trocar mesmo assim'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoTroca(false)}
                  className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 min-h-[40px]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoTroca(true)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-amber-400 transition-colors mt-3 min-h-[40px]"
            >
              <RefreshCw size={13} /> Gerar um código novo
            </button>
          ))}
      </div>

      {/* ---------- Quem acompanha ---------- */}
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-5 mb-2">
        Quem acompanha você
      </h3>
      {carregando ? (
        <div className="h-14 rounded-xl bg-white/5 animate-pulse" />
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-500 glass-light rounded-xl px-3 py-4 flex items-center gap-2">
          <UserPlus size={15} className="text-gray-600 shrink-0" />
          Ninguém ainda. Enquanto a lista estiver vazia, só você vê seus dados.
        </p>
      ) : (
        <ul className="space-y-2">
          {lista.map((v) => (
            <li
              key={v.id}
              className="glass-light rounded-xl px-3 py-3 flex items-center justify-between gap-3 border border-white/[0.04]"
            >
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{v.nome}</p>
                <p className="text-xs text-gray-500 truncate">{v.email}</p>
              </div>
              <button
                type="button"
                onClick={() => revogar(v)}
                disabled={revogando === v.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 border border-white/10 hover:border-red-500/40 hover:text-red-300 transition-all min-h-[40px] shrink-0 disabled:opacity-50"
              >
                <Trash2 size={13} />
                {revogando === v.id ? 'Removendo…' : 'Remover'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ---------- Data de nascimento ---------- */}
      <h3 className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-5 mb-2">
        Data de nascimento
      </h3>
      <p className="text-xs text-gray-500 mb-2 leading-relaxed">
        Só decide uma coisa: quem tem menos de 16 anos precisa da autorização de um
        responsável para falar com um psicólogo pelo app (LGPD).
        {menor && ' Sem data informada, o app pede essa autorização por segurança.'}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          aria-label="Data de nascimento"
          value={nascimento}
          onChange={(e) => setNascimento(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white outline-none focus:border-amber-400/40 min-h-[44px]"
        />
        <button
          type="button"
          onClick={salvarNascimento}
          disabled={salvandoData || !nascimento || nascimento === (session?.dataNascimento ?? '')}
          className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-gray-200 hover:border-amber-400/40 transition-all min-h-[44px] disabled:opacity-40"
        >
          {salvandoData ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
