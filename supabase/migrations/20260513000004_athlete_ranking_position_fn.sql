create or replace function get_athlete_ranking_position(
  p_trainer_id uuid,
  p_athlete_id uuid
)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  with
  all_athletes as (
    select id from athletes where trainer_id = p_trainer_id
  ),
  session_data as (
    select s.id, s.athlete_id
    from sessions s
    where s.athlete_id in (select id from all_athletes)
      and s.completed_at is not null
  ),
  sessions_count as (
    select athlete_id, count(*)::numeric as sessions
    from session_data
    group by athlete_id
  ),
  load_data as (
    select sd.athlete_id,
      coalesce(sum(sl.reps_done * coalesce(sl.weight_kg, 0)), 0) as total_load
    from set_logs sl
    join session_data sd on sl.session_id = sd.id
    where sl.deleted = false
    group by sd.athlete_id
  ),
  cardio_data as (
    select sd.athlete_id, count(*)::numeric as cardio_count
    from set_logs sl
    join session_data sd on sl.session_id = sd.id
    join exercises e on sl.exercise_id = e.id
    where sl.deleted = false
      and lower(e.name) = any(array[
        'corrida na esteira', 'bicicleta ergométrica', 'corda', 'burpee', 'polichinelo',
        'step', 'elíptico', 'sprint', 'jumping jack', 'mountain climber',
        'pular corda', 'remo ergométrico', 'escada rolante', 'skipping', 'box jump'
      ])
    group by sd.athlete_id
  ),
  checkin_data as (
    select athlete_id, count(*)::numeric as checkins
    from class_checkins
    where trainer_id = p_trainer_id
    group by athlete_id
  ),
  all_stats as (
    select
      a.id,
      coalesce(s.sessions, 0) as sessions,
      coalesce(l.total_load, 0) as total_load,
      coalesce(c.cardio_count, 0) as cardio_exercises,
      coalesce(ch.checkins, 0) as checkins
    from all_athletes a
    left join sessions_count s on s.athlete_id = a.id
    left join load_data l on l.athlete_id = a.id
    left join cardio_data c on c.athlete_id = a.id
    left join checkin_data ch on ch.athlete_id = a.id
  ),
  target as (
    select * from all_stats where id = p_athlete_id
  )
  select jsonb_build_object(
    'sessions_rank',  (select count(*) + 1 from all_stats where sessions > (select sessions from target)),
    'sessions_value', (select sessions from target),
    'load_rank',      (select count(*) + 1 from all_stats where total_load > (select total_load from target)),
    'load_value',     (select total_load from target),
    'cardio_rank',    (select count(*) + 1 from all_stats where cardio_exercises > (select cardio_exercises from target)),
    'cardio_value',   (select cardio_exercises from target),
    'checkins_rank',  (select count(*) + 1 from all_stats where checkins > (select checkins from target)),
    'checkins_value', (select checkins from target),
    'total_athletes', (select count(*) from all_athletes)
  )
$$;
