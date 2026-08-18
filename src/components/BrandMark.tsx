export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup">
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="4" y="7" width="22" height="18" rx="6" />
        <rect x="22" y="23" width="22" height="18" rx="6" />
        <path d="M15 17c15 0 3 15 18 15" />
        <circle className="brand-origin" cx="14" cy="17" r="3" />
        <circle className="brand-destination" cx="34" cy="32" r="3" />
      </svg>
      <span>
        <strong>Incident Shift</strong>
        {!compact && <small>A realistic IT &amp; cyber troubleshooting game</small>}
      </span>
    </span>
  )
}
