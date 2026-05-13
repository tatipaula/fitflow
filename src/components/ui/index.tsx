import type { CSSProperties, ReactNode } from 'react'

// ─── Logo ───────────────────────────────────────────────────────────────────

export function KVLogo({ size = 28, color = 'var(--fg-1)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18.5" stroke={color} strokeWidth="1"/>
      <path d="M13 12 L13 28" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13 20 L20 12" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13 20 L20 28" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M22 16 L25 24 L28 16" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function KVWordmark({ size = 18, color = 'var(--fg-1)' }: { size?: number; color?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8,
      fontFamily: 'var(--f-display)', fontSize: size * 1.4, color, letterSpacing: -0.01 }}>
      <KVLogo size={size * 1.3} color={color}/>
      <span style={{ fontStyle: 'italic', fontWeight: 300, fontFamily: "'Cormorant', Georgia, serif", letterSpacing: '0.06em' }}>Kinevia</span>
    </div>
  )
}

// ─── Button ─────────────────────────────────────────────────────────────────

interface KVButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'light'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  iconRight?: ReactNode
  style?: CSSProperties
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function KVButton({
  children, variant = 'primary', size = 'md',
  icon, iconRight, style = {}, onClick, disabled, type = 'button',
}: KVButtonProps) {
  const sizes = { sm: { h: 32, px: 14, fs: 12 }, md: { h: 42, px: 18, fs: 13 }, lg: { h: 52, px: 24, fs: 14 } }
  const s = sizes[size]
  const variants = {
    primary:   { bg: 'var(--accent)',  fg: 'var(--accent-ink)', bd: 'transparent' },
    secondary: { bg: 'transparent',   fg: 'var(--fg-1)',        bd: 'var(--ink-4)' },
    ghost:     { bg: 'transparent',   fg: 'var(--fg-2)',        bd: 'transparent' },
    light:     { bg: 'var(--paper)',   fg: 'var(--ink-0)',       bd: 'transparent' },
  }
  const v = variants[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: s.h, padding: `0 ${s.px}px`,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: v.bg, color: v.fg,
        border: `1px solid ${v.bd}`, borderRadius: 999,
        fontSize: s.fs, fontWeight: 500, letterSpacing: 0.02,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      <span>{children}</span>
      {iconRight}
    </button>
  )
}

// ─── Tag ────────────────────────────────────────────────────────────────────

interface KVTagProps {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'outline'
  style?: CSSProperties
}

export function KVTag({ children, tone = 'neutral', style = {} }: KVTagProps) {
  const tones = {
    neutral: { bg: 'var(--ink-3)', fg: 'var(--fg-2)', bd: 'var(--ink-4)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent)', bd: 'transparent' },
    success: { bg: 'color-mix(in oklch, var(--success), black 70%)', fg: 'var(--success)', bd: 'transparent' },
    outline: { bg: 'transparent', fg: 'var(--fg-3)', bd: 'var(--ink-4)' },
  }
  const t = tones[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 22, padding: '0 10px',
      background: t.bg, color: t.fg,
      border: `1px solid ${t.bd}`, borderRadius: 999,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500,
      letterSpacing: 0.08, textTransform: 'uppercase',
      ...style,
    }}>{children}</span>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────

interface KVCardProps {
  children: ReactNode
  elevated?: boolean
  style?: CSSProperties
}

export function KVCard({ children, elevated = false, style = {} }: KVCardProps) {
  return (
    <div style={{
      background: elevated ? 'var(--ink-3)' : 'var(--ink-2)',
      border: '1px solid var(--ink-4)',
      borderRadius: 'var(--r-lg)',
      padding: 20,
      ...style,
    }}>{children}</div>
  )
}

// ─── Meter ───────────────────────────────────────────────────────────────────

export function KVMeter({ value = 0.5, color = 'var(--accent)', height = 2 }: { value?: number; color?: string; height?: number }) {
  return (
    <div style={{ height, background: 'var(--ink-4)', borderRadius: 999, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(1, Math.max(0, value)) * 100}%`, background: color, transition: 'width 0.5s ease' }} />
    </div>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function KVDivider({ label, style = {} }: { label?: string; style?: CSSProperties }) {
  if (!label) return <div style={{ height: 1, background: 'var(--ink-4)', ...style }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <div style={{ flex: 1, height: 1, background: 'var(--ink-4)' }}/>
      <span className="eyebrow">{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--ink-4)' }}/>
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function KVAvatar({ name = 'AB', size = 36, tone = 'default', src }: { name?: string; size?: number; tone?: 'default' | 'warm' | 'cool' | 'accent'; src?: string | null }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const bgs: Record<string, string> = {
    default: 'linear-gradient(135deg, #2A2823, #1A1816)',
    warm:    'linear-gradient(135deg, #3D3326, #1F1A15)',
    cool:    'linear-gradient(135deg, #1E2228, #0E1014)',
    accent:  'var(--accent)',
  }
  if (src) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', border: '1px solid var(--ink-4)', overflow: 'hidden', flexShrink: 0 }}>
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bgs[tone],
      border: '1px solid var(--ink-4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Instrument Serif', serif", fontSize: size * 0.42,
      color: tone === 'accent' ? 'var(--accent-ink)' : 'var(--fg-1)',
      fontStyle: 'italic', flexShrink: 0,
    }}>{initials}</div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

export const KVIcon = {
  mic: (s = 18, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4">
      <rect x="9" y="3" width="6" height="12" rx="3"/>
      <path d="M5 11v1a7 7 0 0014 0v-1M12 19v3M8 22h8" strokeLinecap="round"/>
    </svg>
  ),
  play: (s = 18, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M7 5v14l12-7z"/></svg>
  ),
  pause: (s = 18, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <rect x="6" y="5" width="4" height="14" rx="1"/>
      <rect x="14" y="5" width="4" height="14" rx="1"/>
    </svg>
  ),
  check: (s = 18, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6"/>
    </svg>
  ),
  chevR: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6"/>
    </svg>
  ),
  chevL: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6"/>
    </svg>
  ),
  plus: (s = 18, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  spark: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></svg>
  ),
  dots: (s = 16, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
    </svg>
  ),
  arrow: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  ),
  flame: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M12 2s4 4 4 8a4 4 0 11-8 0c0-2 2-4 2-4s0 2 2 2c0-3-2-4-2-6z"/>
    </svg>
  ),
  clock: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" strokeLinecap="round"/>
    </svg>
  ),
  dumbbell: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round">
      <rect x="2" y="9" width="3" height="6" rx="0.5"/>
      <rect x="19" y="9" width="3" height="6" rx="0.5"/>
      <rect x="5" y="10.5" width="2" height="3"/>
      <rect x="17" y="10.5" width="2" height="3"/>
      <path d="M7 12h10"/>
    </svg>
  ),
  stop: (s = 16, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
  ),
}
