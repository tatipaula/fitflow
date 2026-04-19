import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { FFLogo, FFButton, FFTag, FFAvatar, FFIcon } from '@/components/ui'
import { getAthleteWorkouts, getExercises, startSession, completeSession, logSet, getAthleteSessions } from '@/lib/api'
import { getYouTubeEmbedUrl } from '@/lib/youtube'
import type { Workout, Exercise, SessionWithLogs } from '@/types'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type AthleteTab = 'treinos' | 'evolucao'
type RestTimer = { remaining: number; total: number }

export default function WorkoutPage() {
  const { athlete, clearAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [availableWorkouts, setAvailableWorkouts] = useState<Workout[]>([])
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const [expandedExId, setExpandedExId] = useState<string | null>(null)
  const [currentSetByEx, setCurrentSetByEx] = useState<Record<string, number>>({})
  const [repsByEx, setRepsByEx] = useState<Record<string, string>>({})
  const [weightByEx, setWeightByEx] = useState<Record<string, string>>({})
  const [setsDone, setSetsDone] = useState<Set<string>>(new Set())
  const [savingSet, setSavingSet] = useState(false)

  const [restTimer, setRestTimer] = useState<RestTimer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tab, setTab] = useState<AthleteTab>('treinos')
  const [sessions, setSessions] = useState<SessionWithLogs[]>([])

  useEffect(() => {
    if (!athlete) { setLoading(false); return }
    async function load() {
      const allWorkouts = await getAthleteWorkouts(athlete!.id)
      const ready = allWorkouts.filter((w) => w.status === 'ready')
      setAvailableWorkouts(ready)
      if (ready.length === 1) await selectWorkout(ready[0])
      const s = await getAthleteSessions(athlete!.id)
      setSessions(s)
      setLoading(false)
    }
    load()
  }, [athlete])

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) {
      if (restTimer?.remaining === 0) setRestTimer(null)
      return
    }
    timerRef.current = setTimeout(() => {
      setRestTimer((t) => t ? { ...t, remaining: t.remaining - 1 } : null)
    }, 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [restTimer])

  async function selectWorkout(w: Workout) {
    setWorkout(w)
    const ex = await getExercises(w.id)
    setExercises(ex)
    const initSets: Record<string, number> = {}
    const initReps: Record<string, string> = {}
    const initWeights: Record<string, string> = {}
    ex.forEach((e) => {
      initSets[e.id] = 1
      initReps[e.id] = String(e.reps)
      initWeights[e.id] = e.weight_kg ? String(e.weight_kg) : ''
    })
    setCurrentSetByEx(initSets)
    setRepsByEx(initReps)
    setWeightByEx(initWeights)
  }

  function resetWorkout() {
    setWorkout(null)
    setExercises([])
    setStarted(false)
    setSessionId(null)
    setSetsDone(new Set())
    setExpandedExId(null)
    setRestTimer(null)
  }

  async function handleStart() {
    if (!workout || !athlete) return
    setStarting(true); setStartError(null)
    const session = await startSession(workout.id, athlete.id)
    if (!session) { setStartError('Não foi possível iniciar. Tente novamente.'); setStarting(false); return }
    setSessionId(session.id)
    setStarted(true); setStarting(false)
    if (exercises.length > 0) setExpandedExId(exercises[0].id)
  }

  async function handleLogSet(ex: Exercise) {
    if (!sessionId || savingSet) return
    setSavingSet(true)
    const setNum = currentSetByEx[ex.id] ?? 1

    const result = await logSet({
      session_id: sessionId,
      exercise_id: ex.id,
      set_number: setNum,
      reps_done: parseInt(repsByEx[ex.id] ?? '0') || 0,
      weight_kg: weightByEx[ex.id] ? parseFloat(weightByEx[ex.id]) : undefined,
    })

    if (result) {
      const key = `${ex.id}-${setNum}`
      setSetsDone((prev) => new Set([...prev, key]))
      const isLastSet = setNum >= ex.sets

      if (ex.rest_seconds > 0) {
        setRestTimer({ remaining: ex.rest_seconds, total: ex.rest_seconds })
      }

      if (!isLastSet) {
        setCurrentSetByEx((prev) => ({ ...prev, [ex.id]: setNum + 1 }))
        setRepsByEx((prev) => ({ ...prev, [ex.id]: String(ex.reps) }))
        setWeightByEx((prev) => ({ ...prev, [ex.id]: ex.weight_kg ? String(ex.weight_kg) : '' }))
      } else {
        const currIdx = exercises.findIndex((e) => e.id === ex.id)
        const nextEx = exercises[currIdx + 1]
        setExpandedExId(nextEx ? nextEx.id : null)
      }
    }
    setSavingSet(false)
  }

  async function handleComplete() {
    if (!sessionId) return
    setCompleting(true)
    await completeSession(sessionId)
    setCompleted(true); setCompleting(false)
  }

  const allExsDone = useMemo(
    () => exercises.length > 0 && exercises.every((ex) =>
      Array.from({ length: ex.sets }, (_, s) => s + 1).every((s) => setsDone.has(`${ex.id}-${s}`))
    ),
    [exercises, setsDone]
  )

  const lastWeightByName = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of sessions) {
      for (const log of s.set_logs) {
        if (!log.deleted && log.weight_kg !== null && !(log.exercises.name in map)) {
          map[log.exercises.name] = log.weight_kg
        }
      }
    }
    return map
  }, [sessions])

  const volumeData = useMemo(() =>
    [...sessions].reverse().slice(-8).map((s) => {
      const vol = s.set_logs.filter((l) => !l.deleted).reduce((sum, l) => sum + l.reps_done * (l.weight_kg ?? 1), 0)
      return { date: new Date(s.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), volume: Math.round(vol) }
    }), [sessions])

  const weeklyData = useMemo(() => {
    const byWeek: Record<string, number> = {}
    sessions.forEach((s) => {
      const d = new Date(s.started_at)
      const week = `S${Math.ceil(d.getDate() / 7)}`
      byWeek[week] = (byWeek[week] ?? 0) + 1
    })
    return Object.entries(byWeek).slice(-6).map(([week, count]) => ({ week, count }))
  }, [sessions])

  const exerciseLoadData = useMemo(() => {
    const map: Record<string, { best: number; last: number }> = {}
    sessions.forEach((s) => {
      s.set_logs.filter((l) => !l.deleted && l.weight_kg !== null).forEach((l) => {
        const name = l.exercises.name
        if (!map[name]) map[name] = { best: 0, last: 0 }
        map[name].last = l.weight_kg!
        map[name].best = Math.max(map[name].best, l.weight_kg!)
      })
    })
    return Object.entries(map).map(([name, { best, last }]) => ({ name, best, last }))
  }, [sessions])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner size="lg" message="Carregando..."/>
    </div>
  )

  // ── Completed ─────────────────────────────────────────────────────────────
  if (completed) return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          {FFIcon.check(28, 'var(--accent)')}
        </div>
        <div className="display" style={{ fontSize: 36, marginBottom: 8 }}>Treino concluído!</div>
        <p style={{ fontSize: 14, color: 'var(--fg-2)', marginBottom: 28, lineHeight: 1.6 }}>
          Ótimo trabalho, {athlete?.name?.split(' ')[0] ?? ''}!
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FFButton variant="primary" size="lg" style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => {
              if (athlete) { const s = await getAthleteSessions(athlete.id); setSessions(s) }
              setCompleted(false); resetWorkout()
            }}>
            {availableWorkouts.length > 1 ? 'Escolher próximo treino' : 'Voltar'}
          </FFButton>
          <FFButton variant="ghost" size="md" style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => {
              if (athlete) { const s = await getAthleteSessions(athlete.id); setSessions(s) }
              setCompleted(false); resetWorkout(); setTab('evolucao')
            }}>
            Ver minha evolução
          </FFButton>
        </div>
      </div>
    </div>
  )

  // ── Bottom nav ────────────────────────────────────────────────────────────
  const navItems: { key: AthleteTab; label: string; icon: (size: number, color: string) => React.ReactNode }[] = [
    { key: 'treinos', label: 'Treinos', icon: FFIcon.dumbbell },
    { key: 'evolucao', label: 'Evolução', icon: FFIcon.flame },
  ]

  const bottomNav = (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40 }}>
      {restTimer && (
        <div style={{ padding: '10px 20px', background: 'var(--ink-3)', borderTop: '1px solid var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {FFIcon.clock(15, 'var(--accent)')}
            <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Descansando</span>
          </div>
          <div className="num" style={{ fontSize: 22, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {String(Math.floor(restTimer.remaining / 60)).padStart(1, '0')}:{String(restTimer.remaining % 60).padStart(2, '0')}
          </div>
          <button onClick={() => setRestTimer(null)} style={{ fontSize: 11, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            Pular
          </button>
        </div>
      )}
      <div style={{ display: 'flex', background: 'rgba(14,13,11,0.94)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--ink-4)', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
        {navItems.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: tab === key ? 'var(--accent)' : 'var(--fg-3)' }}>
            {icon(20, tab === key ? 'var(--accent)' : 'var(--fg-4)')}
            <span style={{ fontSize: 10, letterSpacing: '0.06em', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Header ────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  const pageHeader = (label: string) => (
    <div style={{ padding: '54px 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <FFLogo size={22}/>
        <div className="eyebrow">{label}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={handleSignOut} style={{ fontSize: 11, color: 'var(--fg-1)', background: 'none', border: '1px solid var(--fg-2)', borderRadius: 999, padding: '4px 12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
          Sair
        </button>
        <FFAvatar name={athlete?.name ?? 'A'} size={32} tone="warm"/>
      </div>
    </div>
  )

  // ── EVOLUTION TAB ─────────────────────────────────────────────────────────
  if (tab === 'evolucao') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-0)', paddingBottom: 90 }}>
        {pageHeader('Evolução')}

        {sessions.length === 0 ? (
          <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
            Complete treinos para ver sua evolução.
          </div>
        ) : (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

            {volumeData.length > 1 && (
              <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', padding: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 2 }}>Volume total</div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>Carga × reps por sessão</div>
                <div style={{ overflow: 'hidden' }}>
                <ResponsiveContainer width="99%" height={120}>
                  <LineChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-4)" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fill: 'var(--fg-4)', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill: 'var(--fg-4)', fontSize: 9, fontFamily: 'JetBrains Mono' }} width={32} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: 'var(--fg-2)' }} itemStyle={{ color: 'var(--accent)' }}/>
                    <Line type="monotone" dataKey="volume" stroke="var(--accent)" strokeWidth={2} dot={false} name="vol"/>
                  </LineChart>
                </ResponsiveContainer>
                </div>
              </div>
            )}

            {weeklyData.length > 0 && (
              <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', padding: 18 }}>
                <div className="eyebrow" style={{ marginBottom: 2 }}>Frequência semanal</div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>Treinos por semana</div>
                <div style={{ overflow: 'hidden' }}>
                <ResponsiveContainer width="99%" height={100}>
                  <BarChart data={weeklyData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-4)" vertical={false}/>
                    <XAxis dataKey="week" tick={{ fill: 'var(--fg-4)', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill: 'var(--fg-4)', fontSize: 9, fontFamily: 'JetBrains Mono' }} width={20} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: 'var(--fg-2)' }} itemStyle={{ color: 'var(--fg-2)' }}/>
                    <Bar dataKey="count" fill="var(--fg-4)" radius={[3, 3, 0, 0]} name="treinos"/>
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>
            )}

            {exerciseLoadData.length > 0 && (
              <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', padding: 18, marginBottom: 8 }}>
                <div className="eyebrow" style={{ marginBottom: 16 }}>Evolução de carga</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {exerciseLoadData.map(({ name, best, last }) => {
                    const pct = best > 0 ? Math.round((last / best) * 100) : 100
                    return (
                      <div key={name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{name}</span>
                          <span className="num" style={{ fontSize: 11, color: 'var(--fg-3)' }}>{last} kg</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--ink-4)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s ease' }}/>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: "'JetBrains Mono', monospace" }}>0 kg</span>
                          <span style={{ fontSize: 9, color: 'var(--fg-4)', fontFamily: "'JetBrains Mono', monospace" }}>máx {best} kg</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {bottomNav}
      </div>
    )
  }

  // ── TREINOS TAB ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-0)', paddingBottom: 90 }}>
      {pageHeader('Treinos')}

      {!workout ? (
        availableWorkouts.length === 0 ? (
          <div style={{ padding: '80px 24px', textAlign: 'center' }}>
            <div className="display" style={{ fontSize: 28, marginBottom: 12 }}>Nenhum treino disponível.</div>
            <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6 }}>Aguarde seu personal trainer criar um treino para você.</p>
          </div>
        ) : (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <div className="display" style={{ fontSize: 28, lineHeight: 1 }}>
                Escolha seu <span style={{ fontStyle: 'italic' }}>treino</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 8 }}>
                {availableWorkouts.length} ficha{availableWorkouts.length !== 1 ? 's' : ''} disponível{availableWorkouts.length !== 1 ? 'is' : ''}
              </div>
            </div>
            {availableWorkouts.map((w) => (
              <button key={w.id} onClick={() => selectWorkout(w)}
                style={{ width: '100%', textAlign: 'left', background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-lg)', padding: '18px 20px', cursor: 'pointer', color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.4 }}/>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {FFIcon.dumbbell(20, 'var(--accent)')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.name ?? 'Treino sem nome'}
                  </div>
                  <div className="num" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
                    {new Date(w.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </div>
                </div>
                {FFIcon.chevR(14, 'var(--fg-4)')}
              </button>
            ))}
          </div>
        )
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>

          {/* Workout header card */}
          <div style={{ background: 'var(--ink-2)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-xl)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.6 }}/>
            <div style={{ padding: '20px 20px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <FFTag tone="accent">TREINO DE HOJE</FFTag>
                {availableWorkouts.length > 1 && !started && (
                  <button onClick={resetWorkout}
                    style={{ fontSize: 11, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                    {FFIcon.chevL(10, 'var(--fg-3)')} Trocar ficha
                  </button>
                )}
              </div>
              <div className="display" style={{ fontSize: 26, marginTop: 0, lineHeight: 1 }}>
                {workout.name ?? 'Ficha do Dia'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-3)' }}>
                {new Date(workout.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ink-4)' }}>
                {[
                  { k: 'Exercícios', v: String(exercises.length) },
                  { k: 'Séries', v: String(exercises.reduce((s, e) => s + e.sets, 0)) },
                  { k: 'Total reps', v: String(exercises.reduce((s, e) => s + e.sets * e.reps, 0)) },
                ].map((m, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>{m.v}</div>
                    <div className="eyebrow" style={{ marginTop: 1 }}>{m.k}</div>
                  </div>
                ))}
              </div>
            </div>

            {!started && (
              <div style={{ padding: '14px 20px', background: 'var(--ink-3)', borderTop: '1px solid var(--ink-4)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                {startError && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{startError}</span>}
                <button onClick={handleStart} disabled={starting}
                  style={{ height: 40, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? 0.6 : 1 }}>
                  {starting ? 'Iniciando...' : 'Iniciar treino'}
                </button>
              </div>
            )}

            {started && allExsDone && (
              <div style={{ padding: '14px 20px', background: 'color-mix(in oklch, var(--accent), black 80%)', borderTop: '1px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--accent)' }}>Todos os exercícios concluídos!</span>
                <button onClick={handleComplete} disabled={completing}
                  style={{ height: 40, padding: '0 24px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 13, fontWeight: 600, cursor: completing ? 'not-allowed' : 'pointer', opacity: completing ? 0.6 : 1 }}>
                  {completing ? 'Salvando...' : 'Concluir'}
                </button>
              </div>
            )}
          </div>

          {/* Exercise accordion */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {exercises.map((ex, i) => {
              const exSetsDone = Array.from({ length: ex.sets }, (_, s) => s + 1).filter((s) => setsDone.has(`${ex.id}-${s}`))
              const isAllDone = exSetsDone.length >= ex.sets
              const isExpanded = expandedExId === ex.id && started && !isAllDone
              const currentSet = currentSetByEx[ex.id] ?? 1

              return (
                <div key={ex.id} style={{
                  background: 'var(--ink-2)',
                  border: `1px solid ${isExpanded ? 'var(--fg-4)' : isAllDone ? 'color-mix(in oklch, var(--accent), black 60%)' : 'var(--ink-4)'}`,
                  borderRadius: 'var(--r-lg)',
                  overflow: 'hidden',
                  opacity: isAllDone && !isExpanded ? 0.6 : 1,
                  transition: 'opacity 0.2s, border-color 0.2s',
                }}>
                  {/* Header row */}
                  <button
                    onClick={() => started && !isAllDone ? setExpandedExId(isExpanded ? null : ex.id) : undefined}
                    style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', color: 'var(--fg-1)', cursor: started && !isAllDone ? 'pointer' : 'default', textAlign: 'left' }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isAllDone ? 'var(--accent)' : 'var(--ink-4)'}`, background: isAllDone ? 'var(--accent-soft)' : 'transparent' }}>
                      {isAllDone
                        ? FFIcon.check(11, 'var(--accent)')
                        : <span className="num" style={{ fontSize: 9, color: 'var(--fg-3)' }}>{String(i + 1).padStart(2, '0')}</span>
                      }
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isAllDone ? 'var(--fg-2)' : 'var(--fg-1)' }}>{ex.name}</div>
                      <div className="num" style={{ marginTop: 2, fontSize: 10, color: 'var(--fg-3)', display: 'flex', gap: 6 }}>
                        <span>{ex.sets}×{ex.reps}</span>
                        {ex.weight_kg && <><span>·</span><span>{ex.weight_kg}kg</span></>}
                        {ex.rest_seconds > 0 && <><span>·</span><span>{ex.rest_seconds}s desc</span></>}
                      </div>
                    </div>

                    {started && (
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                        {Array.from({ length: ex.sets }, (_, s) => s + 1).map((s) => (
                          <div key={s} style={{ width: 6, height: 6, borderRadius: '50%', background: setsDone.has(`${ex.id}-${s}`) ? 'var(--accent)' : 'var(--ink-4)', transition: 'background 0.2s' }}/>
                        ))}
                      </div>
                    )}

                    {started && !isAllDone && (
                      <div style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                        {FFIcon.chevR(12, 'var(--fg-4)')}
                      </div>
                    )}
                  </button>

                  {/* Expanded: set logging */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--ink-4)', padding: '16px 16px 18px' }}>
                      {ex.youtube_video_id && (
                        <div style={{ marginBottom: 14, aspectRatio: '16/9', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                          <iframe src={getYouTubeEmbedUrl(ex.youtube_video_id)} title={ex.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }}/>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div className="eyebrow">Série {currentSet} de {ex.sets}</div>
                        {exSetsDone.length > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {exSetsDone.length}/{ex.sets} ✓
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Reps</div>
                          <input type="number" min="0" value={repsByEx[ex.id] ?? ''}
                            onChange={(e) => setRepsByEx((p) => ({ ...p, [ex.id]: e.target.value }))}
                            style={{ width: '100%', height: 48, padding: '0 12px', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 18, color: 'var(--fg-1)', outline: 'none', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}/>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 6, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>Kg</div>
                          <input type="number" min="0" step="0.5" value={weightByEx[ex.id] ?? ''}
                            onChange={(e) => setWeightByEx((p) => ({ ...p, [ex.id]: e.target.value }))}
                            placeholder={lastWeightByName[ex.name] ? String(lastWeightByName[ex.name]) : '0'}
                            style={{ width: '100%', height: 48, padding: '0 12px', background: 'var(--ink-3)', border: '1px solid var(--ink-4)', borderRadius: 'var(--r-md)', fontSize: 18, color: 'var(--fg-1)', outline: 'none', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}/>
                        </div>
                      </div>

                      <button onClick={() => handleLogSet(ex)} disabled={savingSet || !repsByEx[ex.id]}
                        style={{ width: '100%', height: 50, borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: savingSet || !repsByEx[ex.id] ? 'not-allowed' : 'pointer', opacity: savingSet || !repsByEx[ex.id] ? 0.5 : 1 }}>
                        {FFIcon.check(16, 'var(--accent-ink)')}
                        {savingSet ? 'Salvando...' : `Concluir série — ${repsByEx[ex.id] ?? ''} reps${weightByEx[ex.id] ? `, ${weightByEx[ex.id]} kg` : ''}`}
                      </button>

                      {ex.notes && (
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>{ex.notes}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {bottomNav}
    </div>
  )
}
