import type { ReactNode } from 'react';

/**
 * Estado vazio com o mascote.
 *
 * Lista vazia com texto cinza no meio da tela nao diz o que fazer e ainda
 * parece erro de carregamento. Com o sagui e uma frase curta, o vazio vira
 * convite. Como sao varias telas com a mesma necessidade, o componente
 * evita quatro copias divergentes da mesma marcacao.
 */

export type SaguiPose = 'meditando' | 'estudando' | 'pulando' | 'aprovacao' | 'caderno';

const POSE: Record<SaguiPose, string> = {
  meditando: '/assets/sagui_meditando_2.png',
  estudando: '/assets/sagui_estudando_2.png',
  pulando: '/assets/sagui_pulando_2.png',
  aprovacao: '/assets/sagui_aprovacao_2.png',
  caderno: '/assets/sagui_estudando_caderno_2.png',
};

interface EmptyStateProps {
  /** Qual pose combina com o contexto da tela. */
  pose?: SaguiPose;
  titulo: string;
  descricao?: string;
  /** Botao de acao, quando existe um proximo passo obvio. */
  acao?: ReactNode;
  /** Menor, para caber dentro de um card. */
  compacto?: boolean;
}

export function EmptyState({
  pose = 'meditando',
  titulo,
  descricao,
  acao,
  compacto = false,
}: EmptyStateProps) {
  const lado = compacto ? 96 : 128;

  return (
    <div className={`flex flex-col items-center text-center ${compacto ? 'py-6' : 'py-12'}`}>
      <img
        src={POSE[pose]}
        alt=""
        width={lado}
        height={lado}
        loading="lazy"
        draggable={false}
        style={{ width: lado, height: lado }}
        className="object-contain mb-3 opacity-90 motion-safe:animate-float-suave"
        onError={(e) => {
          if (!e.currentTarget.src.endsWith('sagui_meditando_2.png')) {
            e.currentTarget.src = '/assets/sagui_meditando_2.png';
          }
        }}
      />
      <p className={`font-medium text-gray-300 ${compacto ? 'text-sm' : 'text-base'}`}>{titulo}</p>
      {descricao && (
        <p className="text-sm text-gray-500 mt-1 max-w-xs leading-relaxed">{descricao}</p>
      )}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
