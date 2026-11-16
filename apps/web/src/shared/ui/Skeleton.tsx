/**
 * Skeletons de carregamento.
 *
 * Substituem o spinner: um bloco com a forma aproximada do conteudo diz ao
 * usuario o que esta vindo, enquanto o spinner so diz "espere". Isso reduz
 * a percepcao de lentidao sem mudar o tempo real.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Placeholder de pagina inteira, usado no Suspense do AppShell. */
export function PageSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in" role="status" aria-label="Carregando">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40 max-w-[60%]" />
          <Skeleton className="h-3 w-24 max-w-[35%]" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      <Skeleton className="h-48" />
      <span className="sr-only">Carregando conteúdo</span>
    </div>
  );
}

/** Linhas de lista (ranking, ligas, caderno). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando lista">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
      <span className="sr-only">Carregando lista</span>
    </div>
  );
}
