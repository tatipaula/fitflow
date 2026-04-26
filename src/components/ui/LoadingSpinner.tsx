interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  message?: string
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 40 : 24
  const r = px / 2 - 2
  const circ = 2 * Math.PI * r
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}
        style={{ animation: 'kv-spin 0.8s linear infinite', flexShrink: 0 }}>
        <circle cx={px/2} cy={px/2} r={r} fill="none" stroke="var(--ink-4)" strokeWidth="1.5"/>
        <circle cx={px/2} cy={px/2} r={r} fill="none" stroke="var(--accent)" strokeWidth="1.5"
          strokeDasharray={circ} strokeDashoffset={circ * 0.75}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}/>
      </svg>
      {message && (
        <span className="eyebrow">{message}</span>
      )}
    </div>
  )
}
