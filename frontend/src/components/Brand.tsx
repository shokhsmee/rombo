// The Rombo mark — three squares and a slanted block, as on the company's printed documents.
// One drawing for the app (currentColor, follows the theme), print pages and the files in public/brand/.

export function BrandMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <g fill="currentColor">
        <rect x="1" y="1" width="13" height="13" rx="3" />
        <rect x="18" y="1" width="13" height="13" rx="3" />
        <rect x="1" y="18" width="13" height="13" rx="3" />
        <path d="M18 18h9l4 13h-9z" />
      </g>
    </svg>
  );
}

/** Mark + "Rombo" (+ the tagline on documents and the login page). */
export function BrandLogo({ size = 26, tagline = false, className = "" }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark size={size} className="text-accent" />
      <span className="leading-none">
        <b className="block font-semibold tracking-tight text-ink" style={{ fontSize: Math.round(size * 0.62) }}>Rombo</b>
        {tagline && <span className="mt-0.5 block text-2xs text-muted">фабрика сборки окон и дверей</span>}
      </span>
    </span>
  );
}
