import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { marketplaceRepository } from '../../shared/storage/MarketplaceRepository';
import { CODIGO_TAMANHO, codigoValido, normalizarCodigo, soHexadecimal } from '../../shared/lib/vinculoCodigo';

/**
 * ENTRADA PELO CODIGO DO ESTUDANTE — lado do responsavel.
 *
 * Substitui o pedido por email como caminho principal. A diferenca nao e
 * de ergonomia: com o email, qualquer pessoa que conheca o endereco do
 * estudante dispara um pedido e ele so reage. Com o codigo, ninguem pede
 * nada — o estudante decide antes e entrega a quem quiser.
 *
 * Por isso aqui nao ha espera: o vinculo nasce ativo. O estudante recebe
 * uma notificacao (a funcao `vincular_por_codigo` a cria) e pode remover
 * quando quiser — vinculo silencioso seria vigilancia.
 *
 * O campo normaliza o que foi digitado do mesmo jeito que o banco
 * compara: quem copiou "A1B2 C3D4" da tela do filho nao pode receber
 * "codigo invalido" por causa do espaco.
 */

/** O banco responde igual para codigo inexistente e para nao-aluno, de
 *  proposito (evita descobrir codigo valido por tentativa e erro). A
 *  traducao preserva isso: uma mensagem so para os dois casos. */
function mensagemDoErro(e: unknown): string {
  const bruto = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (bruto.includes('codigo invalido')) {
    return 'Código não encontrado. Confira com o estudante, que pode ter gerado um novo.';
  }
  if (bruto.includes('apenas responsaveis')) {
    return 'Esta conta não é de responsável. Entre com a conta de responsável para vincular.';
  }
  if (bruto.includes('nao autenticado')) return 'Sua sessão expirou. Entre de novo.';
  return 'Não foi possível vincular agora. Tente novamente em instantes.';
}

interface Props {
  /** Chamado apos vincular, para o painel recarregar a lista. */
  aoVincular: () => void;
  /** `destaque` e a tela de quem ainda nao tem nenhum filho vinculado. */
  variante?: 'destaque' | 'compacto';
}

export function EntrarPorCodigo({ aoVincular, variante = 'compacto' }: Props) {
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  async function vincular() {
    if (!codigoValido(codigo) || enviando) return;
    setEnviando(true);
    setErro('');
    setOk('');
    try {
      await marketplaceRepository.vincularPorCodigo(codigo, 'responsavel');
      setCodigo('');
      setOk('Pronto! O estudante já aparece no seu painel.');
      aoVincular();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  /* Aviso local, sem ida ao servidor: o codigo vem de um md5, entao
     letra fora de A-F e sempre erro de leitura ("G" por "6", "O" por
     "0"). Dizer isso na hora poupa uma tentativa perdida. */
  const aviso = codigo && !soHexadecimal(codigo)
    ? 'O código só tem números e letras de A a F. Confira: é fácil trocar “O” por “0”.'
    : '';

  const destaque = variante === 'destaque';

  return (
    <div>
      <h2
        className={`font-bold text-white flex items-start gap-2 ${
          destaque ? 'text-lg' : 'text-sm font-semibold text-gray-300'
        }`}
      >
        <KeyRound size={destaque ? 18 : 15} className="text-violet-400 shrink-0 mt-[3px]" />
        {destaque ? 'Entre com o código do estudante' : 'Vincular outro estudante'}
      </h2>
      {destaque && (
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          O estudante abre <strong className="text-gray-200">Perfil → Responsáveis</strong> no
          app dele e te passa o código de 8 caracteres. Só ele pode gerar esse código, e é
          assim que a decisão de ser acompanhado fica com quem está sendo acompanhado.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <input
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={CODIGO_TAMANHO}
          aria-label="Código do estudante"
          aria-invalid={!!erro}
          value={codigo}
          onChange={(e) => {
            setCodigo(normalizarCodigo(e.target.value));
            setErro('');
            setOk('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && void vincular()}
          placeholder="A1B2C3D4"
          className="flex-1 px-3 py-2.5 rounded-xl glass-light border border-white/[0.05] text-sm text-white tracking-[0.2em] uppercase placeholder:tracking-normal placeholder:text-gray-600 outline-none focus:border-violet-500/40 min-h-[44px]"
        />
        <button
          onClick={vincular}
          disabled={!codigoValido(codigo) || enviando}
          className={`${destaque ? 'btn-primary' : 'btn-secondary'} px-5 text-sm min-h-[44px] disabled:opacity-40`}
        >
          {enviando ? 'Vinculando…' : 'Vincular'}
        </button>
      </div>

      {aviso && !erro && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 rounded-xl px-3 py-2 mt-2">{aviso}</p>
      )}
      {erro && (
        <p role="alert" className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2 mt-2">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="text-xs text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2 mt-2">
          {ok}
        </p>
      )}
    </div>
  );
}
