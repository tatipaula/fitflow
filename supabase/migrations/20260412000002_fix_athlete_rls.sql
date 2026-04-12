-- Fix: políticas RLS foram escritas assumindo auth.uid() == athletes.id
-- Desde a migration 20260410000001 (athletes_auth_link), o vínculo correto é
-- athletes.auth_user_id = auth.uid(). Todas as políticas de atleta precisam
-- resolver o athletes.id via join antes de comparar com auth.uid().

-- ── workouts ──────────────────────────────────────────────────────────────────
drop policy "athlete: select own workouts" on public.workouts;
create policy "athlete: select own workouts"
  on public.workouts for select
  using (
    exists (
      select 1 from public.athletes a
      where a.id = athlete_id
        and a.auth_user_id = auth.uid()
    )
  );

-- ── exercises ─────────────────────────────────────────────────────────────────
drop policy "athlete: select via workout" on public.exercises;
create policy "athlete: select via workout"
  on public.exercises for select
  using (
    exists (
      select 1
        from public.workouts w
        join public.athletes a on a.id = w.athlete_id
       where w.id = workout_id
         and a.auth_user_id = auth.uid()
    )
  );

-- ── sessions ──────────────────────────────────────────────────────────────────
drop policy "athlete: full access to own sessions" on public.sessions;
create policy "athlete: full access to own sessions"
  on public.sessions for all
  using (
    exists (
      select 1 from public.athletes a
      where a.id = athlete_id
        and a.auth_user_id = auth.uid()
    )
  );

-- ── set_logs ──────────────────────────────────────────────────────────────────
drop policy "athlete: insert own set_logs" on public.set_logs;
create policy "athlete: insert own set_logs"
  on public.set_logs for insert
  with check (
    exists (
      select 1
        from public.sessions s
        join public.athletes a on a.id = s.athlete_id
       where s.id = session_id
         and a.auth_user_id = auth.uid()
    )
  );

drop policy "athlete: select own set_logs" on public.set_logs;
create policy "athlete: select own set_logs"
  on public.set_logs for select
  using (
    exists (
      select 1
        from public.sessions s
        join public.athletes a on a.id = s.athlete_id
       where s.id = session_id
         and a.auth_user_id = auth.uid()
    )
  );

drop policy "athlete: soft-delete own set_logs" on public.set_logs;
create policy "athlete: soft-delete own set_logs"
  on public.set_logs for update
  using (
    exists (
      select 1
        from public.sessions s
        join public.athletes a on a.id = s.athlete_id
       where s.id = session_id
         and a.auth_user_id = auth.uid()
    )
  )
  with check (deleted = true);
