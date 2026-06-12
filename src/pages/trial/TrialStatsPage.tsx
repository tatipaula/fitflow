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

const fmtBRL = (n: number): string =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontFamily: "'DM Sans', sans-serif", fontSize: 14,
  background: 'var(--paper-2)', color: 'var(--ink-2)',
  border: '1px solid rgba(28,26,23,0.2)', borderRadius: 8,
  outline: 'none', boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
  background: 'var(--ink-2)', color: 'var(--fg-1)',
  border: 'none', borderRadius: 8, cursor: 'pointer',
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

// ── Mini stat (custo) ──────────────────────────────────────────────────────────
function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: T.pap2, borderRadius: 10, padding: '16px 18px', border: '1px solid rgba(28,26,23,0.08)' }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.stone, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: 28, color: T.ink, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: T.stone, fontWeight: 300, marginTop: 5 }}>
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

  // Investimento em anúncios (entrada manual)
  const [spend, setSpend]             = useState<{ spend_date: string; amount_brl: number }[]>([])
  const [activation, setActivation]   = useState<{ new_trainers: number; activated_trainers: number; athletes_total: number } | null>(null)
  const [campaign, setCampaign]       = useState<{ sent: number; opened: number; clicked: number; created_demo: number } | null>(null)
  const [reloadKey, setReloadKey]     = useState(0)
  const [formDate, setFormDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [formAmount, setFormAmount]   = useState('')
  const [saving, setSaving]           = useState(false)

  function handleAuth() {
    sessionStorage.setItem('stats_ok', '1')
    setAuthed(true)
  }

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    const sinceDate = new Date(Date.now() - days * 86_400_000)
    const since    = sinceDate.toISOString()
    const sinceDay = since.slice(0, 10)

    Promise.all([
      supabase
        .from('page_events')
        .select('id, session_id, event, data, page, referrer, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase
        .from('ad_spend')
        .select('spend_date, amount_brl')
        .gte('spend_date', sinceDay)
        .order('spend_date', { ascending: false }),
      supabase.rpc('validation_activation', { p_days: days }),
      supabase.rpc('campaign_funnel', { p_campaign: 'demo-announce' }),
    ]).then(([ev, sp, act, camp]) => {
      if (ev.error) { setError(ev.error.message); setLoading(false); return }
      setEvents((ev.data as PageEvent[]) ?? [])
      setSpend((sp.data as { spend_date: string; amount_brl: number }[]) ?? [])
      setActivation((Array.isArray(act.data) ? act.data[0] : act.data) ?? null)
      setCampaign((Array.isArray(camp.data) ? camp.data[0] : camp.data) ?? null)
      setLoading(false)
    })
  }, [days, authed, reloadKey])

  async function saveSpend(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(formAmount.replace(',', '.'))
    if (isNaN(amt) || amt < 0) return
    setSaving(true)
    const { error: err } = await supabase
      .from('ad_spend')
      .upsert({ spend_date: formDate, amount_brl: amt }, { onConflict: 'spend_date' })
    setSaving(false)
    if (err) { setError(err.message); return }
    setFormAmount('')
    setReloadKey(k => k + 1)
  }

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

  // ── Ativação (trainers que cadastraram aluno) ─────────────────────────────────
  const newTrainers       = activation?.new_trainers ?? null
  const activatedTrainers = activation?.activated_trainers ?? null
  const activationRate    = newTrainers && newTrainers > 0 && activatedTrainers != null
    ? Math.round(activatedTrainers / newTrainers * 100) : null

  // ── Custos (gasto manual × funil) ─────────────────────────────────────────────
  const totalSpend       = spend.reduce((s, r) => s + Number(r.amount_brl), 0)
  const costPerSession   = total > 0          ? totalSpend / total          : null
  const costPerLead      = ctaSessionCount > 0 ? totalSpend / ctaSessionCount : null
  const costPerSignup    = newTrainers && newTrainers > 0       ? totalSpend / newTrainers       : null
  const costPerActivated = activatedTrainers && activatedTrainers > 0 ? totalSpend / activatedTrainers : null

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
            {newTrainers !== null && (
              <StatCard
                label="Trainers ativados"
                value={`${activatedTrainers ?? 0}/${newTrainers}`}
                sub={`${activationRate != null ? activationRate + '% ativação · ' : ''}${activation?.athletes_total ?? 0} alunos cadastrados`}
              />
            )}
          </div>

          {/* ── Investimento em anúncios ── */}
          <div style={{ background: T.paper, borderRadius: 12, padding: '28px', border: '1px solid rgba(28,26,23,0.1)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone }}>
                Investimento em anúncios — Meta Ads
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.stone, fontWeight: 300 }}>
                Gasto digitado manualmente · janela de {days}d
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
              <MiniStat label="Gasto total"        value={totalSpend > 0 ? fmtBRL(totalSpend) : '—'} sub={`${spend.length} dia(s) lançado(s)`} />
              <MiniStat label="Custo por sessão"    value={costPerSession != null ? fmtBRL(costPerSession) : '—'} sub={`${total} sessões`} />
              <MiniStat label="Custo por lead"      value={costPerLead != null ? fmtBRL(costPerLead) : '—'} sub={`${ctaSessionCount} clicaram no CTA`} />
              <MiniStat label="Custo por cadastro"  value={costPerSignup != null ? fmtBRL(costPerSignup) : '—'} sub={newTrainers != null ? `${newTrainers} novos trainers` : 'sem dado'} />
              <MiniStat label="Custo por ativado"   value={costPerActivated != null ? fmtBRL(costPerActivated) : '—'} sub={activatedTrainers != null ? `${activatedTrainers} cadastraram aluno` : 'sem dado'} />
            </div>

            <form onSubmit={saveSpend} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', borderTop: '1px solid rgba(28,26,23,0.08)', paddingTop: 20 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.stone }}>Dia</span>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.stone }}>Gasto do dia (R$)</span>
                <input type="text" inputMode="decimal" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0,00" style={{ ...inputStyle, width: 120 }} />
              </label>
              <button type="submit" disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.stone, fontWeight: 300, alignSelf: 'center' }}>
                Salvar o mesmo dia sobrescreve o valor anterior.
              </span>
            </form>

            {spend.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                <tbody>
                  {spend.map(r => (
                    <tr key={r.spend_date} style={{ borderBottom: '1px solid rgba(28,26,23,0.06)' }}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.stone, padding: '8px 0' }}>{r.spend_date}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.ink, textAlign: 'right', padding: '8px 0' }}>{fmtBRL(Number(r.amount_brl))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Campanha de email — Aluno de teste ── */}
          <div style={{ background: T.paper, borderRadius: 12, padding: '28px', border: '1px solid rgba(28,26,23,0.1)', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.stone }}>
                Campanha de email — Aluno de teste
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: T.stone, fontWeight: 300 }}>
                Enviada em 12/06 aos treinadores sem alunos
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <MiniStat label="Enviados"               value={String(campaign?.sent ?? 0)} />
              <MiniStat label="Abriram"                value={String(campaign?.opened ?? 0)} sub={`${pct(campaign?.opened ?? 0, campaign?.sent ?? 0)} dos enviados`} />
              <MiniStat label="Clicaram no CTA"        value={String(campaign?.clicked ?? 0)} sub={`${pct(campaign?.clicked ?? 0, campaign?.sent ?? 0)} dos enviados`} />
              <MiniStat label="Criaram aluno de teste" value={String(campaign?.created_demo ?? 0)} sub={`${pct(campaign?.created_demo ?? 0, campaign?.sent ?? 0)} de conversão`} />
            </div>
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
