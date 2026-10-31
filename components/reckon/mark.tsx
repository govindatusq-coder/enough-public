/**
 * The Reckon mark: a small champagne point above three thin elliptical
 * ripples that share a centre. Built natively as SVG.
 */
export function ReckonMark({size = 36, tone = 'navy', className}: {size?: number; tone?: 'navy' | 'cream'; className?: string}) {
  const line = tone === 'navy' ? '#0B2545' : '#FCF9F6';
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <circle cx="32" cy="19" r="4.2" fill="#EBD7C0" />
      <ellipse cx="32" cy="36" rx="9" ry="3" stroke={line} strokeWidth="1.1" opacity=".9" />
      <ellipse cx="32" cy="38" rx="17" ry="5.2" stroke={line} strokeWidth="1" opacity=".65" />
      <ellipse cx="32" cy="40.5" rx="26" ry="7.6" stroke={line} strokeWidth=".9" opacity=".4" />
    </svg>
  );
}

export function ReckonWordmark({tagline = true, tone = 'navy'}: {tagline?: boolean; tone?: 'navy' | 'cream'}) {
  return (
    <div className="rk-brand" style={tone === 'cream' ? {color: '#FCF9F6'} : undefined}>
      <ReckonMark size={38} tone={tone} />
      <div>
        <div className="rk-wordmark">Reckon</div>
        {tagline && <div className="rk-tagline" style={tone === 'cream' ? {color: 'rgba(252,249,246,.7)'} : undefined}>Ideas, lived.</div>}
      </div>
    </div>
  );
}
