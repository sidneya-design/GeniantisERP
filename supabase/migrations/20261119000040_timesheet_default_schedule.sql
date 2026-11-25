-- Controle de Ponto: jornada padrão editável pelo RH (antes fixa no código: 44h, 8h48 seg-sex).
--
-- * time_settings guarda a jornada padrão (minutos por dia, tolerância) e o horário de referência
--   (entrada, saída, intervalo), só para mostrar e preencher a tela. O cálculo usa os minutos por dia.
-- * Novo padrão: segunda a sexta, 09:00 às 18:00 com 1h de intervalo = 8h por dia, 40h semanais.
-- * Jornada do funcionário (time_schedules) com dias/tolerância vazios = segue o padrão.
--   Quem estava com a jornada antiga padrão (8h48 seg-sex, 10 min) passa a seguir o padrão.
-- * Mudar o padrão recalcula também os dias já passados de quem segue o padrão.
--
-- Depende de 20261119000039. Pode ser rodada mais de uma vez.

-- 1. Jornada padrão na configuração geral
ALTER TABLE public.time_settings
    ADD COLUMN IF NOT EXISTS default_weekday_minutes SMALLINT[] NOT NULL DEFAULT '{0,480,480,480,480,480,0}',
    ADD COLUMN IF NOT EXISTS default_tolerance_minutes SMALLINT NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS default_start_time TIME DEFAULT '09:00',
    ADD COLUMN IF NOT EXISTS default_end_time TIME DEFAULT '18:00',
    ADD COLUMN IF NOT EXISTS default_break_minutes SMALLINT DEFAULT 60;

ALTER TABLE public.time_settings DROP CONSTRAINT IF EXISTS time_settings_default_week_check;
ALTER TABLE public.time_settings ADD CONSTRAINT time_settings_default_week_check CHECK (
    array_length(default_weekday_minutes, 1) = 7
    AND 0 <= ALL (default_weekday_minutes) AND 960 >= ALL (default_weekday_minutes)
    AND default_tolerance_minutes BETWEEN 0 AND 60
    AND (default_break_minutes IS NULL OR default_break_minutes BETWEEN 0 AND 600)
);

-- 2. Jornada do funcionário: vazio = segue o padrão
ALTER TABLE public.time_schedules ALTER COLUMN weekday_minutes DROP NOT NULL;
ALTER TABLE public.time_schedules ALTER COLUMN weekday_minutes DROP DEFAULT;
ALTER TABLE public.time_schedules ALTER COLUMN tolerance_minutes DROP NOT NULL;
ALTER TABLE public.time_schedules ALTER COLUMN tolerance_minutes DROP DEFAULT;

UPDATE public.time_schedules SET weekday_minutes = NULL WHERE weekday_minutes = '{0,528,528,528,528,528,0}'::smallint[];
UPDATE public.time_schedules SET tolerance_minutes = NULL WHERE tolerance_minutes = 10;

-- 3. Jornada que vale para o funcionário (própria ou padrão)
CREATE OR REPLACE FUNCTION public.time_effective_schedule(p_employee UUID)
RETURNS TABLE (weekday_minutes SMALLINT[], tolerance_minutes SMALLINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(s.weekday_minutes, t.default_weekday_minutes),
           COALESCE(s.tolerance_minutes, t.default_tolerance_minutes)
    FROM public.time_settings t
    LEFT JOIN public.time_schedules s ON s.employee_id = p_employee
    WHERE t.id = 1;
$$;
REVOKE ALL ON FUNCTION public.time_effective_schedule(UUID) FROM PUBLIC, anon;

-- 4. Funções que usavam a jornada fixa
CREATE OR REPLACE FUNCTION public.my_time_profile()
RETURNS TABLE (
    employee_id UUID, full_name TEXT, department TEXT, role_title TEXT,
    admission_date DATE, status TEXT,
    weekday_minutes SMALLINT[], tolerance_minutes SMALLINT, bank_start_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.id, COALESCE(NULLIF(e.preferential_name, ''), e.full_name)::text, e.department_name::text, e.role_title::text,
           e.admission_date, e.status::text,
           es.weekday_minutes,
           es.tolerance_minutes,
           public.time_start_date(e.id)
    FROM public.employees e
    CROSS JOIN LATERAL public.time_effective_schedule(e.id) es
    WHERE e.id = public.my_employee_id();
$$;

CREATE OR REPLACE FUNCTION public.time_daily(p_employee UUID, p_from DATE, p_to DATE)
RETURNS TABLE (
    work_date DATE, weekday SMALLINT, expected_minutes INTEGER, worked_minutes INTEGER,
    punches TIMESTAMPTZ[], holiday TEXT, absence TEXT, status TEXT, balance_minutes INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_adm DATE;
    v_term DATE;
    v_sched SMALLINT[];
    v_tol INTEGER;
BEGIN
    IF NOT public.time_can_see(p_employee) THEN
        RAISE EXCEPTION 'Sem permissão para ver o ponto deste funcionário.' USING ERRCODE = '42501';
    END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 4000 THEN
        RAISE EXCEPTION 'Período inválido.' USING ERRCODE = '22023';
    END IF;

    SELECT public.time_start_date(e.id), e.termination_date INTO v_adm, v_term FROM public.employees e WHERE e.id = p_employee;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    SELECT es.weekday_minutes, es.tolerance_minutes INTO v_sched, v_tol FROM public.time_effective_schedule(p_employee) es;
    v_sched := COALESCE(v_sched, '{0,480,480,480,480,480,0}'::smallint[]);
    v_tol := COALESCE(v_tol, 10);

    RETURN QUERY
    WITH days AS (
        SELECT g::date AS day
        FROM generate_series(GREATEST(p_from, v_adm), LEAST(p_to, COALESCE(v_term, p_to)), INTERVAL '1 day') g
    ),
    p AS (
        SELECT tp.work_date AS day, tp.punched_at,
               row_number() OVER w AS rn,
               lead(tp.punched_at) OVER w AS nxt
        FROM public.time_punches tp
        WHERE tp.employee_id = p_employee AND tp.work_date BETWEEN p_from AND p_to
        WINDOW w AS (PARTITION BY tp.work_date ORDER BY tp.punched_at)
    ),
    pd AS (
        SELECT p.day, count(*)::int AS n,
               array_agg(p.punched_at ORDER BY p.punched_at) AS arr,
               COALESCE(sum(CASE WHEN p.rn % 2 = 1 AND p.nxt IS NOT NULL
                                 THEN floor(extract(epoch FROM p.nxt - p.punched_at) / 60) END), 0)::int AS worked
        FROM p GROUP BY p.day
    ),
    base AS (
        SELECT d.day,
               h.name::text AS hol,
               (SELECT r.kind FROM public.time_requests r
                 WHERE r.employee_id = p_employee AND r.status = 'aprovado' AND r.kind <> 'ajuste'
                   AND d.day BETWEEN r.start_date AND r.end_date
                 ORDER BY r.created_at DESC LIMIT 1) AS abs_kind,
               v_sched[extract(dow FROM d.day)::int + 1]::int AS sched,
               COALESCE(pd.n, 0) AS n,
               COALESCE(pd.arr, '{}'::timestamptz[]) AS arr,
               COALESCE(pd.worked, 0) AS worked
        FROM days d
        LEFT JOIN public.time_holidays h ON h.holiday_date = d.day
        LEFT JOIN pd ON pd.day = d.day
    ),
    calc AS (
        SELECT b.*,
               CASE WHEN b.hol IS NOT NULL OR b.abs_kind IN ('ferias', 'folga', 'atestado', 'falta_justificada')
                    THEN 0 ELSE b.sched END AS expected
        FROM base b
    )
    SELECT c.day,
           extract(dow FROM c.day)::smallint,
           c.expected,
           c.worked,
           c.arr,
           c.hol,
           c.abs_kind,
           CASE
               WHEN c.day > v_today THEN 'futuro'
               WHEN c.day = v_today THEN 'hoje'
               WHEN c.n % 2 = 1 THEN 'incompleto'
               WHEN c.n = 0 AND c.abs_kind IS NOT NULL THEN 'ausencia'
               WHEN c.n = 0 AND c.hol IS NOT NULL THEN 'feriado'
               WHEN c.n = 0 AND c.expected = 0 THEN 'folga'
               WHEN c.n = 0 THEN 'falta'
               ELSE 'normal'
           END,
           CASE
               WHEN c.day >= v_today THEN NULL
               WHEN abs(c.worked - c.expected) <= v_tol THEN 0
               ELSE c.worked - c.expected
           END
    FROM calc c
    ORDER BY c.day;
END;
$$;
