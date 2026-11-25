-- Controle de Ponto: responsáveis por departamento (gestores).
-- Cada departamento pode ter um ou mais responsáveis. O responsável vê o resumo, os espelhos e os pedidos
-- só dos funcionários do(s) seu(s) departamento(s) e, se marcado, aprova/recusa os pedidos deles.
-- Não mexe em jornadas, feriados, marcações nem banco (isso continua com o nível Gerenciar do módulo).
-- Quem tem o módulo Controle de Ponto (Ver/Aprovar/Gerenciar) continua vendo todos.
-- O responsável não aprova o próprio pedido. Pode ser rodada mais de uma vez.

CREATE TABLE IF NOT EXISTS public.time_department_managers (
    department_name VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_approve BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (department_name, user_id)
);
CREATE INDEX IF NOT EXISTS idx_time_department_managers_user ON public.time_department_managers(user_id);

ALTER TABLE public.time_department_managers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ponto: leitura" ON public.time_department_managers;
CREATE POLICY "Ponto: leitura" ON public.time_department_managers FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.has_module('timesheet', 1));
DROP POLICY IF EXISTS "Ponto: inclusão" ON public.time_department_managers;
CREATE POLICY "Ponto: inclusão" ON public.time_department_managers FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 3));
DROP POLICY IF EXISTS "Ponto: alteração" ON public.time_department_managers;
CREATE POLICY "Ponto: alteração" ON public.time_department_managers FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 3)) WITH CHECK (public.has_module('timesheet', 3));
DROP POLICY IF EXISTS "Ponto: exclusão" ON public.time_department_managers;
CREATE POLICY "Ponto: exclusão" ON public.time_department_managers FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 3));

DROP TRIGGER IF EXISTS trg_audit_time_department_managers ON public.time_department_managers;
CREATE TRIGGER trg_audit_time_department_managers AFTER INSERT OR UPDATE OR DELETE ON public.time_department_managers
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Departamentos de que a pessoa logada é responsável
CREATE OR REPLACE FUNCTION public.my_managed_departments()
RETURNS TABLE (department_name TEXT, can_approve BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT m.department_name::text, m.can_approve
    FROM public.time_department_managers m
    JOIN public.profiles p ON p.id = m.user_id AND p.is_active = true
    WHERE m.user_id = auth.uid();
$$;

-- A pessoa logada é responsável pelo departamento deste funcionário? (p_approve: com permissão de aprovar)
CREATE OR REPLACE FUNCTION public.time_manages(p_employee UUID, p_approve BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.employees e
        JOIN public.time_department_managers m ON m.department_name = e.department_name
        JOIN public.profiles p ON p.id = m.user_id AND p.is_active = true
        WHERE e.id = p_employee AND m.user_id = auth.uid() AND (NOT p_approve OR m.can_approve)
    );
$$;

-- Pode ver o ponto deste funcionário: ele mesmo, quem tem o módulo, ou o responsável do departamento
CREATE OR REPLACE FUNCTION public.time_can_see(p_employee UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(p_employee = public.my_employee_id(), false)
        OR public.has_module('timesheet', 1)
        OR public.time_manages(p_employee);
$$;

-- Usuários ativos que podem ser escolhidos como responsáveis (tela do RH)
CREATE OR REPLACE FUNCTION public.time_manager_candidates()
RETURNS TABLE (id UUID, full_name TEXT, email TEXT, role TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF NOT public.has_module('timesheet', 3) THEN
        RAISE EXCEPTION 'Sem permissão para definir responsáveis.' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT p.id, p.full_name::text, p.email::text, p.role::text
    FROM public.profiles p WHERE p.is_active = true ORDER BY p.full_name;
END;
$$;

-- Responsáveis com nome e e-mail (tela do RH)
CREATE OR REPLACE FUNCTION public.time_department_managers_list()
RETURNS TABLE (department_name TEXT, user_id UUID, full_name TEXT, email TEXT, can_approve BOOLEAN, is_active BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    IF NOT public.has_module('timesheet', 1) THEN
        RAISE EXCEPTION 'Sem permissão para ver os responsáveis.' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT m.department_name::text, m.user_id, p.full_name::text, p.email::text, m.can_approve, COALESCE(p.is_active, false)
    FROM public.time_department_managers m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    ORDER BY m.department_name, p.full_name;
END;
$$;

-- Leitura: o responsável do departamento também vê
DROP POLICY IF EXISTS "Ponto: leitura" ON public.time_schedules;
CREATE POLICY "Ponto: leitura" ON public.time_schedules FOR SELECT TO authenticated USING (public.time_can_see(employee_id));
DROP POLICY IF EXISTS "Ponto: leitura" ON public.time_punches;
CREATE POLICY "Ponto: leitura" ON public.time_punches FOR SELECT TO authenticated USING (public.time_can_see(employee_id));
DROP POLICY IF EXISTS "Ponto: leitura" ON public.time_requests;
CREATE POLICY "Ponto: leitura" ON public.time_requests FOR SELECT TO authenticated USING (public.time_can_see(employee_id));
DROP POLICY IF EXISTS "Ponto: leitura" ON public.time_bank_entries;
CREATE POLICY "Ponto: leitura" ON public.time_bank_entries FOR SELECT TO authenticated USING (public.time_can_see(employee_id));

-- Lista de funcionários: quem tem o módulo vê todos; o responsável, os do seu departamento
DROP POLICY IF EXISTS "Ponto: leitura de funcionários" ON public.employees;
CREATE POLICY "Ponto: leitura de funcionários" ON public.employees FOR SELECT TO authenticated
    USING (
        public.has_module('timesheet', 1)
        OR department_name IN (SELECT d.department_name FROM public.my_managed_departments() d)
    );

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
    SELECT s.weekday_minutes, s.tolerance_minutes INTO v_sched, v_tol FROM public.time_schedules s WHERE s.employee_id = p_employee;
    v_sched := COALESCE(v_sched, '{0,528,528,528,528,528,0}'::smallint[]);
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

CREATE OR REPLACE FUNCTION public.time_bank_balance(p_employee UUID)
RETURNS TABLE (start_date DATE, days_minutes INTEGER, entries_minutes INTEGER, total_minutes INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
    v_start DATE;
    v_days INTEGER := 0;
    v_entries INTEGER := 0;
BEGIN
    IF NOT public.time_can_see(p_employee) THEN
        RAISE EXCEPTION 'Sem permissão para ver o ponto deste funcionário.' USING ERRCODE = '42501';
    END IF;
    v_start := public.time_start_date(p_employee);
    IF v_start IS NULL THEN
        RAISE EXCEPTION 'Funcionário não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    IF v_start < v_today THEN
        SELECT COALESCE(sum(d.balance_minutes), 0)::int INTO v_days
        FROM public.time_daily(p_employee, v_start, v_today - 1) d;
    END IF;
    SELECT COALESCE(sum(b.minutes), 0)::int INTO v_entries
    FROM public.time_bank_entries b WHERE b.employee_id = p_employee;
    RETURN QUERY SELECT v_start, v_days, v_entries, v_days + v_entries;
END;
$$;

CREATE OR REPLACE FUNCTION public.time_overview(p_from DATE, p_to DATE)
RETURNS TABLE (
    employee_id UUID, full_name TEXT, department TEXT, status TEXT,
    expected_minutes INTEGER, worked_minutes INTEGER, period_balance INTEGER,
    absences INTEGER, incomplete_days INTEGER, bank_total INTEGER, pending_requests INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
    v_all BOOLEAN := public.has_module('timesheet', 1);
    v_deps TEXT[];
BEGIN
    SELECT array_agg(d.department_name) INTO v_deps FROM public.my_managed_departments() d;
    IF NOT v_all AND v_deps IS NULL THEN
        RAISE EXCEPTION 'Sem permissão para ver o controle de ponto.' USING ERRCODE = '42501';
    END IF;
    IF p_to - p_from > 400 THEN
        RAISE EXCEPTION 'Escolha um período de até 1 ano.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    SELECT e.id, e.full_name::text, e.department_name::text, e.status::text,
           COALESCE(m.expected, 0), COALESCE(m.worked, 0), COALESCE(m.balance, 0),
           COALESCE(m.faltas, 0), COALESCE(m.incompletos, 0),
           (SELECT b.total_minutes FROM public.time_bank_balance(e.id) b),
           (SELECT count(*)::int FROM public.time_requests r WHERE r.employee_id = e.id AND r.status = 'pendente')
    FROM public.employees e
    LEFT JOIN LATERAL (
        -- só dias já encerrados (até ontem)
        SELECT sum(d.expected_minutes) FILTER (WHERE d.balance_minutes IS NOT NULL)::int AS expected,
               sum(d.worked_minutes) FILTER (WHERE d.balance_minutes IS NOT NULL)::int AS worked,
               COALESCE(sum(d.balance_minutes), 0)::int AS balance,
               count(*) FILTER (WHERE d.status = 'falta')::int AS faltas,
               count(*) FILTER (WHERE d.status = 'incompleto')::int AS incompletos
        FROM public.time_daily(e.id, p_from, p_to) d
    ) m ON true
    WHERE (v_all OR e.department_name = ANY (v_deps))
      AND (e.status <> 'desligado'
           OR (e.termination_date IS NOT NULL AND e.termination_date >= p_from))
    ORDER BY e.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_time_request(p_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS public.time_requests
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req public.time_requests;
    v_punch UUID;
    v_at TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_req FROM public.time_requests WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
    END IF;
    -- RH (nível Aprovar) ou responsável do departamento com permissão de aprovar
    IF NOT (public.has_module('timesheet', 2) OR public.time_manages(v_req.employee_id, true)) THEN
        RAISE EXCEPTION 'Sem permissão para aprovar pedidos deste funcionário.' USING ERRCODE = '42501';
    END IF;
    IF v_req.status <> 'pendente' THEN
        RAISE EXCEPTION 'Este pedido já foi analisado.' USING ERRCODE = 'P0001';
    END IF;
    IF v_req.employee_id = public.my_employee_id() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Você não pode analisar o seu próprio pedido.' USING ERRCODE = '42501';
    END IF;

    IF p_approve AND v_req.kind = 'ajuste' THEN
        v_at := (v_req.start_date + v_req.punch_time) AT TIME ZONE 'America/Sao_Paulo';
        IF v_at > NOW() THEN
            RAISE EXCEPTION 'O horário do ajuste está no futuro.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.time_punches (employee_id, punched_at, source, note, created_by)
        VALUES (v_req.employee_id, v_at, 'ajuste', LEFT(v_req.reason, 300), auth.uid())
        RETURNING id INTO v_punch;
    END IF;

    UPDATE public.time_requests
       SET status = CASE WHEN p_approve THEN 'aprovado' ELSE 'recusado' END,
           review_note = NULLIF(trim(COALESCE(p_note, '')), ''),
           reviewed_by = auth.uid(),
           reviewed_at = NOW(),
           punch_id = v_punch
     WHERE id = p_id
     RETURNING * INTO v_req;
    RETURN v_req;
END;
$$;

DO $$
DECLARE
    f TEXT;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.my_managed_departments()',
        'public.time_manages(uuid, boolean)',
        'public.time_can_see(uuid)',
        'public.time_manager_candidates()',
        'public.time_department_managers_list()',
        'public.time_daily(uuid, date, date)',
        'public.time_bank_balance(uuid)',
        'public.time_overview(date, date)',
        'public.review_time_request(uuid, boolean, text)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
    END LOOP;
END $$;
