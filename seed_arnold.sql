-- Seed de dados de evolução para o atleta Arnold
-- Cria 1 treino seed + 5 exercícios + 24 sessões (2x/semana por 12 semanas) + set_logs com progressão de carga
-- Execute no SQL Editor do Supabase dashboard

DO $$
DECLARE
  v_athlete_id   uuid;
  v_trainer_id   uuid;
  v_workout_id   uuid;
  v_session_id   uuid;
  v_session_date timestamptz;
  v_ex_id        uuid;
  v_ex_ids       uuid[] := ARRAY[]::uuid[];
  v_ex_names     text[]    := ARRAY['Supino reto', 'Agachamento livre', 'Remada curvada', 'Desenvolvimento com halteres', 'Rosca direta'];
  v_ex_weights   numeric[] := ARRAY[60, 80, 50, 30, 20];
  v_week         int;
  v_day          int;
  v_progression  numeric;
  i              int;
BEGIN
  -- Busca o Arnold (case-insensitive)
  SELECT id, trainer_id INTO v_athlete_id, v_trainer_id
  FROM athletes
  WHERE name ILIKE '%Arnold%'
  LIMIT 1;

  IF v_athlete_id IS NULL THEN
    RAISE EXCEPTION 'Atleta "Arnold" não encontrado na base.';
  END IF;

  RAISE NOTICE 'Arnold encontrado: athlete_id=%  trainer_id=%', v_athlete_id, v_trainer_id;

  -- Cria treino seed
  INSERT INTO workouts (trainer_id, athlete_id, status, name, created_at)
  VALUES (v_trainer_id, v_athlete_id, 'ready', '[SEED] Treino Arnold', NOW() - interval '90 days')
  RETURNING id INTO v_workout_id;

  -- Cria 5 exercícios e armazena os IDs
  FOR i IN 1..5 LOOP
    INSERT INTO exercises (workout_id, name, sets, reps, rest_seconds, order_index, weight_kg)
    VALUES (v_workout_id, v_ex_names[i], 4, 10, 60, i - 1, v_ex_weights[i])
    RETURNING id INTO v_ex_id;
    v_ex_ids := v_ex_ids || v_ex_id;
  END LOOP;

  -- Cria 24 sessões: 2x por semana durante 12 semanas com progressão de carga de 2,5%/semana
  FOR v_week IN 0..11 LOOP
    FOR v_day IN 0..1 LOOP  -- dia 0 = segunda, dia 1 = quinta
      v_session_date := NOW() - ((11 - v_week) * 7 + (v_day * 3) + 1) * interval '1 day';
      v_progression  := 1.0 + v_week * 0.025;  -- semana 0 = peso base, semana 11 = +27,5%

      INSERT INTO sessions (workout_id, athlete_id, started_at, completed_at)
      VALUES (v_workout_id, v_athlete_id, v_session_date, v_session_date + interval '70 minutes')
      RETURNING id INTO v_session_id;

      -- 4 séries de cada exercício nesta sessão
      FOR i IN 1..5 LOOP
        INSERT INTO set_logs (session_id, exercise_id, set_number, reps_done, weight_kg, completed_at, deleted)
        VALUES
          (v_session_id, v_ex_ids[i], 1, 10, round((v_ex_weights[i] * v_progression)::numeric, 1), v_session_date + interval '10 min', false),
          (v_session_id, v_ex_ids[i], 2, 10, round((v_ex_weights[i] * v_progression)::numeric, 1), v_session_date + interval '20 min', false),
          (v_session_id, v_ex_ids[i], 3,  8, round((v_ex_weights[i] * v_progression)::numeric, 1), v_session_date + interval '30 min', false),
          (v_session_id, v_ex_ids[i], 4,  6, round((v_ex_weights[i] * v_progression)::numeric, 1), v_session_date + interval '40 min', false);
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seed concluído: 24 sessões, 480 set_logs inseridos para Arnold.';
END $$;
