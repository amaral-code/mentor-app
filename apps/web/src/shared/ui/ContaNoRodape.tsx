import { FeedbackBeta } from './FeedbackBeta';
import { MinhaConta } from './MinhaConta';

/**
 * Conta, privacidade e feedback no fim dos painéis que não têm Perfil
 * (responsável, professor, secretaria, psicólogo). Fechado por padrão:
 * é coisa que se procura, não que se vê todo dia. O aluno encontra o
 * mesmo conteúdo no Perfil.
 */
export function ContaNoRodape() {
  return (
    <details id="conta-no-rodape" className="max-w-5xl mx-auto px-4 md:px-8 pb-10 group">
      <summary className="cursor-pointer text-sm font-bold text-slate-500 hover:text-tinta-900 py-3">
        Sua conta, privacidade e sugestões
      </summary>
      <div className="space-y-5 pt-2">
        <FeedbackBeta />
        <MinhaConta />
      </div>
    </details>
  );
}
