import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const STATS_PW = import.meta.env.VITE_STATS_PW as string

// ── Types ─────────────────────────────────────────────────────────────────────
interface PageEvent {
  id: string
  session_id: string
  event: string
  data: Record<string, unknown>
  page: string
  referrer: string | null
  created_at: string
}

// ── Tokens ────────────────────────────────────────────────────────────────────
const T = {
  black: 'var(--ink-0)',
  ink:   'var(--ink-2)',
  paper: 'var(--paper)',
  pap2:  'var(--paper-2)',
  gold:  'var(--accent)',
  stone: 'var(--fg-3)',
  white: 'var(--fg-1)',
}

const SECTIONS = [
  { key: 'hero',            label: 'Hero' },
  { key: 'how-it-works',    label: 'Como funciona' },
  { key: 'athlete-journey', label: 'Jornada do aluno' },
  { key: 'what-changes',    label: 'O que muda' },
  { key: 'testimonial',     label: 'Depoimento' },
  { key: 'pricing',         label: 'Preço + CTA' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function uniqueSessions(events: PageEvent[], filterFn?: (e: PageEvent) => boolean): number {
  const subset = filterFn ? events.filter(filterFn) : events
  return new Set(subset.map(e => e.session_id)).size
}

function pct(part: number, total: number): string {
  if (total === 0) return '—'
  return (part / total * 100).toFixed(0) + '%'
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: T.paper, borderRadius: 12, padding: '24px 28px', border: '1px solid rgba(28,26,23,0.1)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 44, color: T.ink, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.stone, fontWeight: 300, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Bar ───────────────────────────────────────────────────────────────────────
function Bar({ value, max, label, count }: { value: number; max: number; label: string; count: number }) {
  const w = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 48px', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.ink }}>{label}</div>
      <div style={{ height: 6, background: 'rgba(28,26,23,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: 'var(--accent)', borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.stone, textAlign: 'right' }}>
        {value}% <span style={{ fontSize: 9, opacity: 0.6 }}>({count})</span>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
// ── Password gate ─────────────────────────────────────────────────────────────
function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput]   = useState('')
  const [wrong, setWrong]   = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  function attempt(e: React.FormEvent) {
    e.preventDefault()
    if (input === STATS_PW) { onAuth() } else { setWrong(true); setInput('') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={attempt} style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Cormorant', serif", fontStyle: 'italic', fontSize: 28, color: 'var(--ink-2)', fontWeight: 300, marginBottom: 8 }}>
          Kinevia
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 32 }}>
          Analytics · acesso restrito
        </div>
        <input
          ref={ref}
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setWrong(false) }}
          placeholder="senha"
          style={{
            width: '100%', padding: '12px 16px',
            fontFamily: "'DM Sans', sans-serif", fontSize: 14,
            background: 'var(--paper)', color: 'var(--ink-2)',
            border: `1px solid ${wrong ? 'oklch(0.68 0.18 25)' : 'rgba(28,26,23,0.2)'}`,
            borderRadius: 8, outline: 'none', marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />
        {wrong && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'oklch(0.68 0.18 25)', marginBottom: 12 }}>
            Senha incorreta.
          </div>
        )}
        <button type="submit" style={{
          width: '100%', padding: '12px',
          fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
          background: 'var(--ink-2)', color: 'var(--fg-1)',
          border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>
          Entrar
        </button>
      </form>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TrialStatsPage() {
  const [authed, setAuthed]   = useState(() => sessionStorage.getItem('stats_ok') === '1')
  const [events, setEvents]   = useState<PageEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [days, setDays]       = useState(14)
  const [error, setError]     = useState<string | null>(null)

  function handleAuth() {
    sessionStorage.setItem('stats_ok', '1')
    setAuthed(true)
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    supabase
      .from('page_events')
      .select('id, session_id, event, data, page, referrer, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setEvents((data as PageEvent[]) ?? [])
        setLoading(false)
      })
  }, [days, authed])

  if (!authed) return <PasswordGate onAuth={handleAuth} />

  // ── Aggregations ────────────────────────────────────────────────────────────
  const total = uniqueSessions(events)

  const ctaSessionCount = uniqueSessions(events, e => e.event === 'cta_click')
  const ctaClickCount   = events.filter(e => e.event === 'cta_click').length

  const ctaByPos: Record<string, number> = {}
  events.filter(e => e.event === 'cta_click').forEach(e => {
    const pos = String(e.data?.position ?? 'unknown')
    ctaByPos[pos] = (ctaByPos[pos] ?? 0) + 1
  })

  const funnel = SECTIONS.map(({ key, label }) => {
    const count = uniqueSessions(events, e => e.event === 'section_view' && e.data?.section === key)
    return { key, label, count, rate: total > 0 ? Math.round(count / total * 100) : 0 }
  })
  const maxFunnel = Math.max(...funnel.map(f => f.rate), 1)

  const depthMap: Record<number, number> = {}
  events.filter(e => e.event === 'scroll_depth').forEach(e => {
    const d = Number(e.data?.depth)
    if ([25, 50, 75, 100].includes(d)) depthMap[d] = (depthMap[d] ?? 0) + 1
  })

  // sessions per day
  const dayMap: Record<string, Set<string>> = {}
  events.filter(e => e.event === 'page_view').forEach(e => {
    const day = e.created_at.slice(0, 10)
    if (!dayMap[day]) dayMap[day] = new Set()
    dayMap[day].add(e.session_id)
  })
  const dayData = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b))

  // referrers
  const refMap: Record<string, number> = {}
  events.filter(e => e.event === 'page_view').forEach(e => {
    const ref = e.referrer ? new URL(e.referrer).hostname : '(direto)'
    refMap[ref] = (refMap[ref] ?? 0) + 1
  })
  const refEntries = Object.entries(refMap).sort(([, a], [, b]) => b - a).slice(0, 6)

  // avg time on page
  const timeEvents = events.filter(e => e.event === 'session_end' && typeof e.data?.time_on_page_seconds === 'number')
  const avgTime = timeEvents.length > 0
    ? Math.round(timeEvents.reduce((s, e) => s + Number(e.data.time_on_page_seconds), 0) / timeEvents.length)
    : null

  return (
    <div style={{ minHeight: '100vh', background: T.pap2, padding: 'clamp(32px, 5vh, 64px) clamp(16px, 5vw, 48px)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant:wght@300&family=DM+Sans:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.stone, marginBottom: 8 }}>
            Kinevia · Analytics
          </div>
          <h1 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 36, color: T.ink, margin: 0, lineHeight: 1 }}>
            /trial — página de vendas
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                background: days === d ? T.ink : 'transparent',
                color: days === d ? T.white : T.stone,
                border: `1px solid ${days === d ? T.ink : 'rgba(28,26,23,0.18)'}`,
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#c0392b' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: T.stone }}>Carregando...</div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
            <StatCard label="Sessões únicas"     value={total} />
            <StatCard label="Cliques no CTA"     value={ctaClickCount} sub={`${pct(ctaSessionCount, total)} das sessões`} />
            <StatCard label="Taxa de conversão"  value={pct(ctaSessionCount, total)} sub={`${ctaSessionCount} sessões clicaram`} />
            {avgTime !== null && (
              <StatCard label="Tempo médio na página" value={avgTime < 60 ? `${avgTime}s` : `${Math.round(avgTime / 60)}min ${avgTime % 60}s`} />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 24 }}>

            {/* ── Funil de seções ── */}
            <div style={{ background: T.paper, borderRadius: 12, padding: '28px 28px', border: '1px solid rgba(28,26,23,0.1)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone, marginBottom: 24 }}>
                Funil de seções — % de sessões que viram
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {funnel.map(f => (
                  <Bar key={f.key} label={f.label} value={f.rate} max={maxFunnel} count={f.count} />
                ))}
              </div>
            </div>

            {/* ── Profundidade de scroll ── */}
            <div style={{ background: T.paper, borderRadius: 12, padding: '28px 28px', border: '1px solid rgba(28,26,23,0.1)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone, marginBottom: 24 }}>
                Profundidade de scroll
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[25, 50, 75, 100].map(d => {
                  const count = depthMap[d] ?? 0
                  const rate  = total > 0 ? Math.round(count / total * 100) : 0
                  return <Bar key={d} label={`Até ${d}%`} value={rate} max={100} count={count} />
                })}
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: T.stone, fontWeight: 300, margin: '20px 0 0', lineHeight: 1.6 }}>
                Cada barra representa a % das sessões que rolaram até aquele ponto.
              </p>
            </div>

            {/* ── Cliques por posição do CTA ── */}
            <div style={{ background: T.paper, borderRadius: 12, padding: '28px 28px', border: '1px solid rgba(28,26,23,0.1)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone, marginBottom: 24 }}>
                Cliques no CTA por posição
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(ctaByPos).sort(([, a], [, b]) => b - a).map(([pos, count]) => (
                    <tr key={pos} style={{ borderBottom: '1px solid rgba(28,26,23,0.06)' }}>
                      <td style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.ink, padding: '10px 0' }}>{pos}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.stone, textAlign: 'right', padding: '10px 0' }}>{count} cliques</td>
                    </tr>
                  ))}
                  {Object.keys(ctaByPos).length === 0 && (
                    <tr><td colSpan={2} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.stone, padding: '10px 0' }}>Sem cliques ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Sessões por dia ── */}
            <div style={{ background: T.paper, borderRadius: 12, padding: '28px 28px', border: '1px solid rgba(28,26,23,0.1)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone, marginBottom: 24 }}>
                Sessões por dia
              </div>
              {dayData.length === 0 ? (
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.stone }}>Sem dados ainda.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {dayData.map(([day, set]) => (
                      <tr key={day} style={{ borderBottom: '1px solid rgba(28,26,23,0.06)' }}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.stone, padding: '9px 0' }}>{day}</td>
                        <td style={{ padding: '9px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ height: 4, width: Math.max(4, set.size * 8), background: 'var(--accent)', borderRadius: 2, maxWidth: 160 }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.ink }}>{set.size}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── Referências de tráfego ── */}
            <div style={{ background: T.paper, borderRadius: 12, padding: '28px 28px', border: '1px solid rgba(28,26,23,0.1)' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone, marginBottom: 24 }}>
                Origem do tráfego (top 6)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {refEntries.map(([ref, count]) => (
                    <tr key={ref} style={{ borderBottom: '1px solid rgba(28,26,23,0.06)' }}>
                      <td style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.ink, padding: '10px 0', wordBreak: 'break-all' }}>{ref}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.stone, textAlign: 'right', padding: '10px 0', whiteSpace: 'nowrap' }}>{count}</td>
                    </tr>
                  ))}
                  {refEntries.length === 0 && (
                    <tr><td colSpan={2} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: T.stone, padding: '10px 0' }}>Sem dados ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* ── Nota ── */}
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300, fontSize: 12, color: T.stone, margin: 0, lineHeight: 1.7, maxWidth: 560 }}>
            Dados brutos em <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>page_events</code> no Supabase. Período: últimos {days} dias.
            Sem cookies de terceiros, sem script externo.
          </p>
        </>
      )}
    </div>
  )
}
