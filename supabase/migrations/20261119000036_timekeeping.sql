-- Controle de Ponto: marcações, jornada, feriados, pedidos (ajuste, folga, férias...) e banco de horas.
--
-- Regras:
-- * O funcionário bate o ponto pela função punch_clock(): a hora é sempre a do servidor.
--   Ele não grava nem altera marcações direto na tabela.
-- * Marcação esquecida/errada: o funcionário pede um "ajuste"; o RH aprova e a marcação é criada.
-- * Jornada padrão: 44h semanais, 8h48 de segunda a sexta (o RH ajusta por funcionário).
-- * Tolerância: diferença de até 10 min no dia não conta (art. 58 §1º da CLT; ajustável).
-- * Início do controle: data geral (time_settings, padrão = dia em que esta migration rodou),
--   ou a admissão se for depois, ou uma data própria do funcionário. Dias antes disso não contam,
--   assim quem já trabalhava não começa com "faltas" de antes do sistema.
-- * Banco de horas: saldo diário (trabalhado - previsto) acumulado desde o início do controle,
--   mais lançamentos manuais do RH (ex.: saldo que vinha de outro controle).
-- * Férias, atestado, folga abonada e falta justificada zeram o previsto do dia;
--   "folga do banco" mantém o previsto, então desconta do saldo.
-- * Datas no fuso de Brasília (America/Sao_Paulo).
--
-- Depende de 20261119000035_role_funcionario.sql. Pode ser rodada mais de uma vez.

-- 1. Módulo "timesheet" (gestão do ponto) nos padrões por perfil
INSERT INTO public.role_module_defaults (role, module, level) VALUES
    ('admin', 'timesheet', 3),
    ('adm', 'timesheet', 1),
    ('ti', 'timesheet', 0),
    ('rh', 'timesheet', 3),
    ('financeiro', 'timesheet', 0),
    ('consulta', 'timesheet', 0),
    ('funcionario', 'timesheet', 0)
ON CONFLICT (role, module) DO NOTHING;

-- 2. Usuário com perfil Funcionário precisa estar ligado a um cadastro de funcionário
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_funcionario_employee_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_funcionario_employee_check
    CHECK (role <> 'funcionario' OR employee_id IS NOT NULL);

-- 2. Cadastro de funcionário da pessoa logada
CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT employee_id FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

REVOKE ALL ON FUNCTION public.my_employee_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_employee_id() TO authenticated;

-- 3. Tabelas
CREATE TABLE IF NOT EXISTS public.time_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    start_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Sao_Paulo')::date),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
INSERT INTO public.time_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.time_schedules (
    employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
    -- minutos previstos por dia da semana: [domingo, segunda, ..., sábado]
    weekday_minutes SMALLINT[] NOT NULL DEFAULT '{0,528,528,528,528,528,0}'
        CHECK (array_length(weekday_minutes, 1) = 7 AND 0 <= ALL (weekday_minutes) AND 960 >= ALL (weekday_minutes)),
    tolerance_minutes SMALLINT NOT NULL DEFAULT 10 CHECK (tolerance_minutes BETWEEN 0 AND 60),
    -- início do controle/banco deste funcionário (vazio = início geral ou admissão, o que for depois)
    bank_start_date DATE,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.time_punches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    punched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    work_date DATE GENERATED ALWAYS AS ((punched_at AT TIME ZONE 'America/Sao_Paulo')::date) STORED,
    -- ponto: batido pelo funcionário | ajuste: pedido aprovado | manual: lançado pelo RH
    source TEXT NOT NULL DEFAULT 'ponto' CHECK (source IN ('ponto', 'ajuste', 'manual')),
    note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_punches_emp_date ON public.time_punches(employee_id, work_date, punched_at);
CREATE INDEX IF NOT EXISTS idx_time_punches_date ON public.time_punches(work_date);

CREATE TABLE IF NOT EXISTS public.time_holidays (
    holiday_date DATE PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.time_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('ajuste', 'ferias', 'folga', 'folga_banco', 'atestado', 'falta_justificada')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    -- só para ajuste: horário da marcação que faltou (no dia start_date)
    punch_time TIME,
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado')),
    review_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    punch_id UUID REFERENCES public.time_punches(id) ON DELETE SET NULL,
    created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CHECK (end_date >= start_date),
    CHECK (end_date - start_date <= 366),
    CHECK (kind <> 'ajuste' OR (punch_time IS NOT NULL AND start_date = end_date))
);
CREATE INDEX IF NOT EXISTS idx_time_requests_emp ON public.time_requests(employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_time_requests_status ON public.time_requests(status);

CREATE TABLE IF NOT EXISTS public.time_bank_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    -- positivo = crédito, negativo = débito (ex.: saldo inicial, horas pagas)
    minutes INTEGER NOT NULL CHECK (minutes <> 0 AND abs(minutes) <= 100000),
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_bank_entries_emp ON public.time_bank_entries(employee_id);

-- Feriados nacionais 2026 e 2027 (o RH inclui os estaduais/municipais e pontos facultativos)
INSERT INTO public.time_holidays (holiday_date, name) VALUES
    ('2026-01-01', 'Confraternização Universal'),
    ('2026-04-03', 'Sexta-feira Santa'),
    ('2026-04-21', 'Tiradentes'),
    ('2026-05-01', 'Dia do Trabalho'),
    ('2026-09-07', 'Independência do Brasil'),
    ('2026-10-12', 'Nossa Senhora Aparecida'),
    ('2026-11-02', 'Finados'),
    ('2026-11-15', 'Proclamação da República'),
    ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
    ('2026-12-25', 'Natal'),
    ('2027-01-01', 'Confraternização Universal'),
    ('2027-03-26', 'Sexta-feira Santa'),
    ('2027-04-21', 'Tiradentes'),
    ('2027-05-01', 'Dia do Trabalho'),
    ('2027-09-07', 'Independência do Brasil'),
    ('2027-10-12', 'Nossa Senhora Aparecida'),
    ('2027-11-02', 'Finados'),
    ('2027-11-15', 'Proclamação da República'),
    ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
    ('2027-12-25', 'Natal')
ON CONFLICT (holiday_date) DO NOTHING;

-- Início do controle de ponto de um funcionário
CREATE OR REPLACE FUNCTION public.time_start_date(p_employee UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(s.bank_start_date, GREATEST(e.admission_date, (SELECT t.start_date FROM public.time_settings t WHERE t.id = 1)))
    FROM public.employees e
    LEFT JOIN public.time_schedules s ON s.employee_id = e.id
    WHERE e.id = p_employee;
$$;
REVOKE ALL ON FUNCTION public.time_start_date(UUID) FROM PUBLIC, anon;

-- 4. Regras de acesso (RLS)
ALTER TABLE public.time_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_bank_entries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename, policyname FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY (ARRAY['time_settings', 'time_schedules', 'time_punches', 'time_holidays', 'time_requests', 'time_bank_entries'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Configuração geral: todos leem; RH altera
CREATE POLICY "Ponto: leitura" ON public.time_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ponto: alteração" ON public.time_settings FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 2)) WITH CHECK (public.has_module('timesheet', 2));

-- Jornada: o próprio funcionário vê; RH (ponto) gerencia
CREATE POLICY "Ponto: leitura" ON public.time_schedules FOR SELECT TO authenticated
    USING (employee_id = public.my_employee_id() OR public.has_module('timesheet', 1));
CREATE POLICY "Ponto: inclusão" ON public.time_schedules FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 2));
CREATE POLICY "Ponto: alteração" ON public.time_schedules FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 2)) WITH CHECK (public.has_module('timesheet', 2));
CREATE POLICY "Ponto: exclusão" ON public.time_schedules FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 2));

-- Marcações: funcionário só lê as próprias (grava por punch_clock); RH lança manual
CREATE POLICY "Ponto: leitura" ON public.time_punches FOR SELECT TO authenticated
    USING (employee_id = public.my_employee_id() OR public.has_module('timesheet', 1));
CREATE POLICY "Ponto: inclusão manual" ON public.time_punches FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 2) AND source = 'manual' AND created_by = auth.uid());
CREATE POLICY "Ponto: alteração" ON public.time_punches FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 2)) WITH CHECK (public.has_module('timesheet', 2));
CREATE POLICY "Ponto: exclusão" ON public.time_punches FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 3));

-- Feriados: todos que usam o ERP leem; RH gerencia
CREATE POLICY "Ponto: leitura" ON public.time_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ponto: inclusão" ON public.time_holidays FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 2));
CREATE POLICY "Ponto: alteração" ON public.time_holidays FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 2)) WITH CHECK (public.has_module('timesheet', 2));
CREATE POLICY "Ponto: exclusão" ON public.time_holidays FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 2));

-- Pedidos: funcionário cria os próprios como pendentes; RH cria já aprovados (ex.: férias)
-- Aprovar, recusar e cancelar: só pelas funções review_time_request / cancel_time_request
CREATE POLICY "Ponto: leitura" ON public.time_requests FOR SELECT TO authenticated
    USING (employee_id = public.my_employee_id() OR public.has_module('timesheet', 1));
CREATE POLICY "Ponto: pedido próprio" ON public.time_requests FOR INSERT TO authenticated
    WITH CHECK (
        employee_id = public.my_employee_id()
        AND status = 'pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL AND punch_id IS NULL
        AND created_by = auth.uid()
    );
CREATE POLICY "Ponto: lançamento do RH" ON public.time_requests FOR INSERT TO authenticated
    WITH CHECK (
        public.has_module('timesheet', 2) AND kind <> 'ajuste' AND punch_id IS NULL
        AND created_by = auth.uid()
        AND (status = 'pendente' OR (status = 'aprovado' AND reviewed_by = auth.uid()))
        -- quem é RH não aprova as próprias folgas/férias (Admin pode)
        AND (status = 'pendente' OR employee_id IS DISTINCT FROM public.my_employee_id() OR public.is_admin())
    );
CREATE POLICY "Ponto: exclusão" ON public.time_requests FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 3));

-- Banco de horas (lançamentos manuais)
CREATE POLICY "Ponto: leitura" ON public.time_bank_entries FOR SELECT TO authenticated
    USING (employee_id = public.my_employee_id() OR public.has_module('timesheet', 1));
CREATE POLICY "Ponto: inclusão" ON public.time_bank_entries FOR INSERT TO authenticated
    WITH CHECK (
        public.has_module('timesheet', 2) AND created_by = auth.uid()
        AND (employee_id IS DISTINCT FROM public.my_employee_id() OR public.is_admin())
    );
CREATE POLICY "Ponto: exclusão" ON public.time_bank_entries FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 3));

-- Quem gerencia o ponto precisa ver a lista de funcionários
DROP POLICY IF EXISTS "Ponto: leitura de funcionários" ON public.employees;
CREATE POLICY "Ponto: leitura de funcionários" ON public.employees FOR SELECT TO authenticated
    USING (public.has_module('timesheet', 1));

-- 5. Funções

-- Dados do funcionário logado para a tela "Meu Ponto"
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
           COALESCE(s.weekday_minutes, '{0,528,528,528,528,528,0}'::smallint[]),
           COALESCE(s.tolerance_minutes, 10::smallint),
           public.time_start_date(e.id)
    FROM public.employees e
    LEFT JOIN public.time_schedules s ON s.employee_id = e.id
    WHERE e.id = public.my_employee_id();
$$;

-- Bater o ponto (hora do servidor)
CREATE OR REPLACE FUNCTION public.punch_clock(p_note TEXT DEFAULT NULL)
RETURNS public.time_punches
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_emp UUID := public.my_employee_id();
    v_status TEXT;
    v_row public.time_punches;
BEGIN
    IF v_emp IS NULL THEN
        RAISE EXCEPTION 'Seu usuário não está ligado a um cadastro de funcionário. Fale com o RH.' USING ERRCODE = '42501';
    END IF;
    SELECT status::text INTO v_status FROM public.employees WHERE id = v_emp;
    IF v_status = 'desligado' THEN
        RAISE EXCEPTION 'Cadastro desligado: não é possível registrar ponto.' USING ERRCODE = '42501';
    END IF;
    -- evita marcação dupla por clique repetido
    PERFORM pg_advisory_xact_lock(hashtext('punch_clock:' || v_emp::text));
    IF EXISTS (SELECT 1 FROM public.time_punches WHERE employee_id = v_emp AND punched_at > NOW() - INTERVAL '1 minute') THEN
        RAISE EXCEPTION 'Você registrou o ponto há menos de 1 minuto.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.time_punches (employee_id, punched_at, source, note, created_by)
    VALUES (v_emp, NOW(), 'ponto', NULLIF(LEFT(trim(COALESCE(p_note, '')), 300), ''), auth.uid())
    RETURNING * INTO v_row;
    RETURN v_row;
END;
$$;

-- Espelho diário: previsto, trabalhado, situação e saldo de cada dia
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
    IF NOT (p_employee = public.my_employee_id() OR public.has_module('timesheet', 1)) THEN
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

-- Saldo do banco de horas até ontem
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
    IF NOT (p_employee = public.my_employee_id() OR public.has_module('timesheet', 1)) THEN
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

-- Resumo de todos os funcionários no período (tela do RH)
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
BEGIN
    IF NOT public.has_module('timesheet', 1) THEN
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
    WHERE e.status <> 'desligado'
       OR (e.termination_date IS NOT NULL AND e.termination_date >= p_from)
    ORDER BY e.full_name;
END;
$$;

-- Aprovar ou recusar pedido (RH). Ajuste aprovado cria a marcação.
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
    IF NOT public.has_module('timesheet', 2) THEN
        RAISE EXCEPTION 'Sem permissão para aprovar pedidos de ponto.' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_req FROM public.time_requests WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0002';
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

-- Funcionário cancela o próprio pedido pendente
CREATE OR REPLACE FUNCTION public.cancel_time_request(p_id UUID)
RETURNS public.time_requests
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req public.time_requests;
BEGIN
    UPDATE public.time_requests
       SET status = 'cancelado', reviewed_at = NOW()
     WHERE id = p_id AND status = 'pendente'
       AND (employee_id = public.my_employee_id() OR public.has_module('timesheet', 2))
     RETURNING * INTO v_req;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado ou já analisado.' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_req;
END;
$$;

DO $$
DECLARE
    f TEXT;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.my_time_profile()',
        'public.punch_clock(text)',
        'public.time_daily(uuid, date, date)',
        'public.time_bank_balance(uuid)',
        'public.time_overview(date, date)',
        'public.review_time_request(uuid, boolean, text)',
        'public.cancel_time_request(uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
    END LOOP;
END $$;

-- 6. Auditoria: tudo que o RH altera. Marcação batida pelo próprio funcionário não polui o log.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['time_settings', 'time_schedules', 'time_holidays', 'time_requests', 'time_bank_entries'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
             FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_audit_time_punches_ins ON public.time_punches;
CREATE TRIGGER trg_audit_time_punches_ins AFTER INSERT ON public.time_punches
    FOR EACH ROW WHEN (NEW.source <> 'ponto') EXECUTE FUNCTION public.audit_row_change();
DROP TRIGGER IF EXISTS trg_audit_time_punches_chg ON public.time_punches;
CREATE TRIGGER trg_audit_time_punches_chg AFTER UPDATE OR DELETE ON public.time_punches
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
