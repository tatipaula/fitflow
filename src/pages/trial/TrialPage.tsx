import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '@/lib/analytics'

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLACK = 'var(--ink-0)'
const INK   = 'var(--ink-2)'
const GOLD  = 'var(--accent)'
const PAPER = 'var(--paper)'
const PAP2  = 'var(--paper-2)'
const STONE = 'var(--fg-3)'
const WHITE = 'var(--fg-1)'

// ── Phone animation types ────────────────────────────────────────────────────
type Phase = 'idle' | 'recording' | 'processing' | 'reveal' | 'done'

const PHASES: Phase[] = ['idle', 'recording', 'processing', 'reveal', 'done']

const DURATIONS: Record<Phase, number> = {
  idle:       2800,
  recording:  3400,
  processing: 2200,
  reveal:     4400,
  done:       2000,
}

interface FichaItem { num: string; ex: string; meta: string }

const FICHA: FichaItem[] = [
  { num: '01', ex: 'Agachamento livre', meta: '4×12 · 80kg'  },
  { num: '02', ex: 'Leg Press 45°',     meta: '3×15 · 120kg' },
  { num: '03', ex: 'Remada curvada',    meta: '4×10 · 60kg'  },
  { num: '04', ex: 'Supino plano',      meta: '3×12 · 70kg'  },
]

const N_BARS = 22

function useWaveform(active: boolean) {
  const [bars, setBars] = useState<number[]>(() => Array(N_BARS).fill(6))
  useEffect(() => {
    if (!active) { setBars(Array(N_BARS).fill(6)); return }
    const iv = setInterval(() => {
      setBars(Array.from({ length: N_BARS }, (_, i) => {
        const c = (N_BARS - 1) / 2
        const d = Math.abs(i - c) / c
        return Math.max(5, Math.random() * 44 * (1 - d * 0.52))
      }))
    }, 75)
    return () => clearInterval(iv)
  }, [active])
  return bars
}

// ── Phone screens ─────────────────────────────────────────────────────────────

function IdleScreen() {
  const students = [
    { name: 'Marina R.', sub: 'Treino A · hoje'  },
    { name: 'João S.',   sub: 'Treino B · ontem' },
    { name: 'Carlos M.', sub: 'Treino C · terça' },
  ]
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <span style={mono(9, STONE, { letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16, display: 'block' })}>
        Alunos ativos · 3
      </span>
      <div style={{ flex: 1 }}>
        {students.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: GOLD, flexShrink: 0, opacity: 0.9 }} />
            <div>
              <div style={sans(12, WHITE, { fontWeight: 400, lineHeight: 1.2 })}>{s.name}</div>
              <div style={mono(8.5, STONE, { letterSpacing: '0.06em' })}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', paddingTop: 6 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: `1.5px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${GOLD}`, animation: 'pulseRing 2.2s ease-out infinite' }} />
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: GOLD }} />
        </div>
        <span style={sans(11, STONE)}>Gravar treino</span>
      </div>
    </div>
  )
}

function RecordingScreen({ bars }: { bars: number[] }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 'auto' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e05c4e', animation: 'blink 1s ease infinite', flexShrink: 0 }} />
        <span style={mono(9, STONE, { letterSpacing: '0.12em', textTransform: 'uppercase' })}>
          Gravando · 0:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, margin: 'auto 0' }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 3, height: h, background: GOLD, borderRadius: 2, transition: 'height 0.075s ease', opacity: 0.88 }} />
        ))}
      </div>
      <span style={sans(11, STONE, { fontWeight: 300 })}>Cancelar</span>
    </div>
  )
}

function ProcessingScreen() {
  const [dot, setDot] = useState(1)
  const [prog, setProg] = useState(0)
  useEffect(() => {
    const iv1 = setInterval(() => setDot(d => d >= 3 ? 1 : d + 1), 480)
    const iv2 = setInterval(() => setProg(p => p >= 86 ? p : p + 2), 50)
    return () => { clearInterval(iv1); clearInterval(iv2) }
  }, [])
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={cormorant(19, WHITE, { fontStyle: 'italic', textAlign: 'center', lineHeight: 1.3 })}>
        Montando ficha{'·'.repeat(dot)}
      </div>
      <div style={mono(9, STONE, { letterSpacing: '0.12em', textTransform: 'uppercase' })}>
        Processando áudio
      </div>
      <div style={{ width: 108, height: 2, background: 'rgba(200,169,110,0.15)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${prog}%`, background: GOLD, transition: 'width 0.05s linear', borderRadius: 2 }} />
      </div>
    </div>
  )
}

function FichaScreen({ count }: { count: number }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 8 }}>
        <div style={mono(9, GOLD, { letterSpacing: '0.12em', textTransform: 'uppercase' })}>Treino A · João S.</div>
        <div style={mono(8.5, STONE, { marginTop: 2 })}>{count}/{FICHA.length} exercícios</div>
      </div>
      <div style={{ height: 1, background: 'rgba(200,169,110,0.18)', marginBottom: 10 }} />
      <div style={{ flex: 1 }}>
        {FICHA.slice(0, count).map((line, i) => (
          <div key={i} style={{ marginBottom: 9, animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <span style={mono(8.5, GOLD, { minWidth: 16 })}>{line.num}</span>
              <span style={sans(11.5, WHITE, { fontWeight: 400 })}>{line.ex}</span>
            </div>
            <div style={mono(8.5, STONE, { letterSpacing: '0.06em', paddingLeft: 22, marginTop: 2 })}>{line.meta}</div>
          </div>
        ))}
      </div>
      {count >= FICHA.length && (
        <div style={{
          background: 'rgba(200,169,110,0.08)',
          border: '1px solid rgba(200,169,110,0.22)',
          borderRadius: 8,
          padding: '7px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeInUp 0.4s ease both',
          marginTop: 4,
        }}>
          <span style={sans(11, WHITE, { fontWeight: 400 })}>Enviar para João</span>
          <span style={{ color: GOLD, fontSize: 12 }}>→</span>
        </div>
      )}
    </div>
  )
}

function PhoneCard({ phase, bars, revealCount, today }: { phase: Phase; bars: number[]; revealCount: number; today: string }) {
  return (
    <div style={{
      width: 216,
      height: 432,
      background: '#0d0b0a',
      border: '1px solid rgba(200,169,110,0.16)',
      borderRadius: 30,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
      boxShadow: [
        '0 0 0 1px rgba(0,0,0,0.9)',
        '0 0 50px rgba(200,169,110,0.07)',
        '0 40px 80px rgba(0,0,0,0.35)',
      ].join(', '),
    }}>
      <div style={{ padding: '15px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(200,169,110,0.07)', flexShrink: 0 }}>
        <span style={cormorant(15, WHITE, { fontStyle: 'italic', fontWeight: 300 })}>Kinevia</span>
        <span style={mono(8, STONE, { letterSpacing: '0.1em' })}>{today}</span>
      </div>
      <div style={{ flex: 1, padding: '14px 16px 18px', overflow: 'hidden' }}>
        {phase === 'idle'       && <IdleScreen />}
        {phase === 'recording'  && <RecordingScreen bars={bars} />}
        {phase === 'processing' && <ProcessingScreen />}
        {(phase === 'reveal' || phase === 'done') && <FichaScreen count={revealCount} />}
      </div>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function cormorant(size: number | string, color: string, extra: React.CSSProperties = {}): React.CSSProperties {
  return { fontFamily: "'Cormorant', serif", fontSize: size, color, ...extra }
}
function sans(size: number, color: string, extra: React.CSSProperties = {}): React.CSSProperties {
  return { fontFamily: "'DM Sans', sans-serif", fontSize: size, color, ...extra }
}
function mono(size: number, color: string, extra: React.CSSProperties = {}): React.CSSProperties {
  return { fontFamily: "'JetBrains Mono', monospace", fontSize: size, color, ...extra }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TrialPage() {
  const navigate       = useNavigate()
  const enterTime      = useRef(Date.now())
  const maxDepth       = useRef(0)
  const firedDepths    = useRef(new Set<number>())
  const seenSections   = useRef(new Set<string>())
  const [navSolid, setNavSolid] = useState(false)

  // Phone animation
  const [phase, setPhase]             = useState<Phase>('idle')
  const [revealCount, setRevealCount] = useState(0)
  const bars = useWaveform(phase === 'recording')

  const today = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })
    .toUpperCase()

  // page_view + session_end
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    track('page_view', {
      utm_source:   params.get('utm_source'),
      utm_medium:   params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      viewport_w:   window.innerWidth,
    })
    const onLeave = () => {
      track('session_end', {
        time_on_page_seconds: Math.round((Date.now() - enterTime.current) / 1000),
        max_scroll_depth:     maxDepth.current,
      })
    }
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [])

  // Scroll depth tracking (throttled via requestAnimationFrame)
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const el  = document.documentElement
        const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100)
        maxDepth.current = Math.max(maxDepth.current, pct)
        for (const milestone of [25, 50, 75, 100]) {
          if (pct >= milestone && !firedDepths.current.has(milestone)) {
            firedDepths.current.add(milestone)
            track('scroll_depth', { depth: milestone })
          }
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Section tracking (IntersectionObserver — fires once per section)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const s = entry.target.getAttribute('data-section')
          if (s && !seenSections.current.has(s)) {
            seenSections.current.add(s)
            track('section_view', { section: s })
          }
        }
      },
      { threshold: 0.3 },
    )
    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Nav opacity on scroll
  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Phone phase progression
  useEffect(() => {
    const t = setTimeout(() => {
      const idx  = PHASES.indexOf(phase)
      const next = PHASES[(idx + 1) % PHASES.length]
      if (next === 'idle') setRevealCount(0)
      setPhase(next)
    }, DURATIONS[phase])
    return () => clearTimeout(t)
  }, [phase])

  // Ficha reveal
  useEffect(() => {
    if (phase !== 'reveal') return
    setRevealCount(0)
    const ts = FICHA.map((_, i) => setTimeout(() => setRevealCount(i + 1), i * 780))
    return () => ts.forEach(clearTimeout)
  }, [phase])

  function handleCta(position: string) {
    track('cta_click', { position, label: 'Começar — 15 dias grátis' })
    navigate('/login')
  }

  function CtaStrip({ position, bg = PAPER }: { position: string; bg?: string }) {
    return (
      <div style={{
        background: bg,
        padding: 'clamp(40px, 6vh, 64px) clamp(16px, 5vw, 40px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={() => handleCta(position)}
          style={{
            ...sans(15, PAPER),
            fontWeight: 500,
            background: INK,
            border: 'none', borderRadius: 100,
            padding: '14px 36px', cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Começar — 15 dias grátis
        </button>
        <div style={sans(13, STONE, { fontWeight: 300 })}>
          Sem cartão. R$49/mês depois.
        </div>
      </div>
    )
  }

  return (
    <div style={{ color: INK, overflowX: 'hidden', background: PAPER }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 5vw, 40px)',
        background: navSolid ? 'rgba(10,9,9,0.96)' : 'transparent',
        backdropFilter: navSolid ? 'blur(12px)' : 'none',
        borderBottom: navSolid ? '1px solid rgba(200,169,110,0.1)' : 'none',
        transition: 'background 0.3s',
      }}>
        <span style={cormorant(22, navSolid ? WHITE : INK, { fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.01em' })}>
          Kinevia
        </span>
        <button
          onClick={() => handleCta('nav')}
          style={{
            ...sans(13, navSolid ? BLACK : PAPER),
            fontWeight: 500,
            background: navSolid ? GOLD : INK,
            border: 'none', borderRadius: 100,
            padding: '8px 20px', cursor: 'pointer',
            letterSpacing: '0.01em',
            transition: 'background 0.3s, color 0.3s',
          }}
        >
          Começar
        </button>
      </nav>

      {/* ── HERO — Paper ── */}
      <section
        data-section="hero"
        style={{
          background: PAPER,
          paddingTop:    'clamp(100px, 14vh, 148px)',
          paddingBottom: 'clamp(80px, 12vh, 120px)',
          paddingLeft:   'clamp(16px, 5vw, 40px)',
          paddingRight:  'clamp(16px, 5vw, 40px)',
        }}
      >
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'flex', alignItems: 'center',
          gap: 52, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {/* Copy */}
          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <div style={mono(10, GOLD, { letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 20 })}>
              Software para personal trainers · B2B
            </div>
            <h1 style={cormorant('clamp(36px, 5vw, 58px)', INK, {
              fontWeight: 300,
              lineHeight: 1.05,
              margin: '0 0 20px',
            })}>
              Você grava<br />o treino.<br />
              <em style={{ color: GOLD }}>o Kinevia faz o resto.</em>
            </h1>
            <p style={sans(16, STONE, { fontWeight: 300, lineHeight: 1.8, margin: '0 0 36px', maxWidth: 360 })}>
              Fale a prescrição. O Kinevia transcreve, estrutura e monta a ficha — pronta para o aluno em minutos.
            </p>
            <button
              onClick={() => handleCta('hero')}
              style={{
                ...sans(15, PAPER),
                fontWeight: 500,
                background: INK,
                border: 'none', borderRadius: 100,
                padding: '15px 36px', cursor: 'pointer',
                display: 'block', marginBottom: 12,
                letterSpacing: '0.01em',
              }}
            >
              Começar — 15 dias grátis
            </button>
            <div style={sans(13, STONE, { fontWeight: 300 })}>
              Sem cartão. R$49/mês depois.
            </div>
          </div>

          {/* Phone */}
          <PhoneCard phase={phase} bars={bars} revealCount={revealCount} today={today} />
        </div>
      </section>

      {/* ── COMO FUNCIONA — Ink ── */}
      <section
        data-section="how-it-works"
        style={{
          background: INK,
          padding: 'clamp(64px, 10vh, 100px) clamp(16px, 5vw, 40px)',
          position: 'relative',
        }}
      >
        <div className="hairline-accent" />
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={mono(10, GOLD, { letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 52 })}>
            Como funciona
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 48 }}>
            {[
              { step: '01 · GRAVAR',     desc: 'Grave a prescrição em áudio. Em segundos.' },
              { step: '02 · ESTRUTURAR', desc: 'O Kinevia transcreve e monta a ficha completa.' },
              { step: '03 · ENVIAR',     desc: 'A ficha chega ao aluno, pronta para executar.' },
            ].map(({ step, desc }) => (
              <div key={step}>
                <div style={mono(10, GOLD, { letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 })}>
                  {step}
                </div>
                <div style={{ width: 24, height: 1, background: GOLD, opacity: 0.4, marginBottom: 16 }} />
                <p style={cormorant(24, WHITE, { fontWeight: 300, lineHeight: 1.4, margin: 0 })}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 40, right: 40, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.2 }} />
      </section>

      <CtaStrip position="after-how-it-works" />

      {/* ── JORNADA DO ALUNO — Paper ── */}
      <section
        data-section="athlete-journey"
        style={{
          background: PAPER,
          padding: 'clamp(64px, 10vh, 100px) clamp(16px, 5vw, 40px)',
        }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={mono(10, GOLD, { letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 20 })}>
            A experiência do aluno
          </div>
          <p style={cormorant('clamp(24px, 3.5vw, 36px)', INK, {
            fontWeight: 300,
            lineHeight: 1.35,
            margin: '0 0 56px',
            maxWidth: 560,
          })}>
            O aluno não instala nada. Você envia um link. Ele cria a conta em minutos e já acessa o treino montado por você.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 40 }}>
            {[
              { n: '01', title: 'Link de convite',       desc: 'Você envia, ele abre no celular. Sem App Store. Sem Play Store.' },
              { n: '02', title: 'Onboarding em 3 passos', desc: 'Senha, triagem de saúde, dados físicos. Pronto.' },
              { n: '03', title: 'Ficha estruturada',      desc: 'Exercícios, séries, descanso. Ranking entre alunos. Evolução de carga ao longo do tempo.' },
            ].map(({ n, title, desc }) => (
              <div key={n} style={{ borderTop: '1px solid rgba(28,26,23,0.14)', paddingTop: 20 }}>
                <div style={mono(9, GOLD, { letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 })}>
                  {n}
                </div>
                <div style={sans(15, INK, { fontWeight: 500, marginBottom: 8 })}>
                  {title}
                </div>
                <p style={sans(14, STONE, { fontWeight: 300, lineHeight: 1.65, margin: 0 })}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── O QUE MUDA — Paper-2 ── */}
      <section
        data-section="what-changes"
        style={{
          background: PAP2,
          padding: 'clamp(64px, 10vh, 100px) clamp(16px, 5vw, 40px)',
        }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={mono(10, GOLD, { letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 52 })}>
            O que muda
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0 }}>
            {/* Sem Kinevia */}
            <div style={{ borderRight: '1px solid rgba(28,26,23,0.1)', paddingRight: 48, paddingBottom: 40 }}>
              <div style={mono(10, STONE, { letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 28 })}>
                Sem Kinevia
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { metric: '15–20 min',  label: 'montar uma ficha' },
                  { metric: 'Manual',     label: 'cobrança do aluno' },
                  { metric: 'Nenhum',     label: 'registro de evolução de carga' },
                ].map(({ metric, label }) => (
                  <div key={label}>
                    <div style={cormorant(30, INK, { fontWeight: 300, lineHeight: 1 })}>{metric}</div>
                    <div style={sans(13, STONE, { marginTop: 4 })}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Com Kinevia */}
            <div style={{ paddingLeft: 48, paddingTop: 0 }}>
              <div style={mono(10, GOLD, { letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 28 })}>
                Com Kinevia
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {[
                  { metric: '~2 min',        label: 'montar uma ficha' },
                  { metric: 'Automático',    label: 'lembrete com Pix pronto' },
                  { metric: 'Por exercício', label: 'gráfico de evolução de carga' },
                ].map(({ metric, label }) => (
                  <div key={label}>
                    <div style={cormorant(30, GOLD, { fontStyle: 'italic', fontWeight: 300, lineHeight: 1 })}>{metric}</div>
                    <div style={sans(13, STONE, { marginTop: 4 })}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 52, borderTop: '1px solid rgba(28,26,23,0.1)', paddingTop: 32 }}>
            <p style={sans(16, STONE, { fontWeight: 300, lineHeight: 1.85, maxWidth: 560, margin: 0 })}>
              Montar uma ficha à mão leva de 15 a 20 minutos. Na Kinevia, leva cerca de dois. O tempo que sai do operacional é tempo que você decide como usar — mais alunos, ou menos noites trabalhando.
            </p>
            <p style={sans(15, STONE, { fontWeight: 300, lineHeight: 1.75, maxWidth: 560, margin: '24px 0 0' })}>
              Lembrete de cobrança automático, com o Pix pronto. Você para de esquecer de cobrar o que já ganhou.
            </p>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTO — Paper ── */}
      <section
        data-section="testimonial"
        style={{
          background: PAPER,
          padding: 'clamp(64px, 10vh, 100px) clamp(16px, 5vw, 40px)',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ width: 28, height: 1, background: GOLD, opacity: 0.7, marginBottom: 36 }} />
          <blockquote style={cormorant('clamp(20px, 3vw, 28px)', INK, {
            fontStyle: 'italic',
            fontWeight: 300,
            lineHeight: 1.55,
            margin: '0 0 32px',
          })}>
            "O aplicativo tem facilitado muito minha rotina como personal trainer. Um dos grandes diferenciais é a integração com inteligência artificial, que permite a criação de treinos de forma rápida e prática. Basta enviar um áudio informando os exercícios, número de séries, repetições e observações, e o sistema monta o treino automaticamente, eliminando a necessidade de navegar por diversas abas e realizar digitação manual."
          </blockquote>
          <div style={mono(10, STONE, { letterSpacing: '0.14em', textTransform: 'uppercase' })}>
            Marcos Matias Xavier · Personal Trainer
          </div>
        </div>
      </section>

      <CtaStrip position="after-testimonial" />

      {/* ── PREÇO + CTA — Black ── */}
      <section
        data-section="pricing"
        style={{
          background: BLACK,
          padding: 'clamp(80px, 12vh, 120px) clamp(16px, 5vw, 40px)',
          position: 'relative',
        }}
      >
        <div className="hairline-accent" />
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={cormorant('clamp(36px, 5vw, 52px)', WHITE, {
            fontWeight: 300,
            lineHeight: 1.05,
            margin: '0 0 16px',
          })}>
            Comece com <em style={{ color: GOLD }}>clareza.</em>
          </h2>
          <p style={sans(16, STONE, { fontWeight: 300, lineHeight: 1.65, margin: '0 0 44px' })}>
            15 dias de acesso completo. Sem cartão.
          </p>
          <button
            onClick={() => handleCta('pricing')}
            style={{
              ...sans(15, BLACK),
              fontWeight: 500,
              background: PAPER,
              border: 'none', borderRadius: 100,
              padding: '16px 44px', cursor: 'pointer',
              letterSpacing: '0.01em',
              marginBottom: 16,
              display: 'inline-block',
            }}
          >
            Começar agora
          </button>
          <div style={sans(13, STONE, { fontWeight: 300 })}>
            R$49/mês depois do trial.
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: INK,
        padding: '20px clamp(16px, 5vw, 40px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        borderTop: '1px solid rgba(200,169,110,0.1)',
      }}>
        <span style={cormorant(18, WHITE, { fontStyle: 'italic', fontWeight: 300 })}>Kinevia</span>
        <span style={mono(9, STONE, { letterSpacing: '0.12em' })}>© 2026</span>
      </footer>

      {/* Keyframes */}
      <style>{`
        @keyframes fadeInUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink     { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.75); opacity: 0; } }
      `}</style>
    </div>
  )
}
