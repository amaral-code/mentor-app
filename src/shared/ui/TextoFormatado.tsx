import { Fragment, memo, useMemo, type ReactNode } from 'react';

/**
 * Renderiza a marcação leve que a IA devolve.
 *
 * O modelo responde com markdown (`**negrito**`, `*itálico*`, `` `código` ``)
 * e o chat exibia isso como texto puro, então o aluno via os asteriscos na
 * tela. A biblioteca `marked` estava no package.json mas nunca foi
 * importada, e trazê-la de volta significaria HTML gerado por IA indo para
 * `dangerouslySetInnerHTML`: um caminho de XSS por 4 kB de recurso.
 *
 * Este parser devolve NÓS REACT, nunca HTML. Não existe superfície de
 * injeção: o texto continua sendo texto, só muda o estilo.
 */

const PADRAO = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

function formatarLinha(linha: string, chave: string): ReactNode {
  const partes = linha.split(PADRAO).filter(Boolean);

  return partes.map((parte, i) => {
    const k = `${chave}-${i}`;
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={k} className="font-semibold text-white">{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith('*') && parte.endsWith('*')) {
      return <em key={k}>{parte.slice(1, -1)}</em>;
    }
    if (parte.startsWith('`') && parte.endsWith('`')) {
      return (
        <code key={k} className="px-1 py-0.5 rounded bg-white/10 text-[0.92em] font-mono">
          {parte.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={k}>{parte}</Fragment>;
  });
}

interface TextoFormatadoProps {
  texto: string;
  className?: string;
}

export const TextoFormatado = memo(function TextoFormatado({ texto, className = '' }: TextoFormatadoProps) {
  // Parse memorizado: sem isso, cada tick do streaming (24ms) e cada tecla
  // no input do chat reprocessava TODAS as mensagens da conversa — custo
  // O(mensagens x ticks) com regex em cada render do pai.
  const linhas = useMemo(() => texto.split('\n'), [texto]);

  return (
    /* break-words e o que impede a bolha de estourar: sem ele, uma URL ou
       um termo longo empurra o container e a pagina inteira passa a rolar
       de lado. min-w-0 e o par necessario dentro de flex. */
    <p className={`whitespace-pre-wrap break-words min-w-0 ${className}`}>
      {linhas.map((linha, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {formatarLinha(linha, `l${i}`)}
        </Fragment>
      ))}
    </p>
  );
});
