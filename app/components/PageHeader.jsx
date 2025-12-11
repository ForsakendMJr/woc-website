// app/components/PageHeader.jsx

export default function PageHeader({
  eyebrow = '',
  title,
  kicker,
  children,
  badges = [],
}) {
  return (
    <header className="mb-10 space-y-4">
      {eyebrow && (
        <div className="inline-flex items-center gap-2 woc-pill text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="tracking-wide font-medium">{eyebrow}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {title}
        </h1>
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {badges.map((b) => (
              <span key={b} className="woc-tag">
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      {kicker && (
        <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-2xl">
          {kicker}
        </p>
      )}

      {children && (
        <div className="text-xs sm:text-sm text-[var(--text-muted)] max-w-3xl">
          {children}
        </div>
      )}
    </header>
  );
}
