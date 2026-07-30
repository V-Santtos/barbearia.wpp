function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/8 ${className}`} />
  );
}

export function AgendaSettingsSkeleton() {
  return (
    <div className="space-y-5">

      {/* Dias de trabalho */}
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-11 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Início / Fim */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </div>

      {/* Intervalo de descanso */}
      <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-5 w-9 rounded-full" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      {/* Duração por atendimento */}
      <div>
        <Skeleton className="h-3 w-40 mb-3" />
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-14 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Slots gerados */}
      <div className="rounded-xl bg-white/5 p-3">
        <Skeleton className="h-3 w-20 mb-3" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-11 rounded-lg" />
          ))}
        </div>
      </div>

    </div>
  );
}

export function ProfileBlockedPeriodsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Carregando bloqueios">
      {Array.from({ length: Math.max(1, count) }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
        >
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((__, buttonIndex) => (
              <Skeleton key={buttonIndex} className="h-11 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
