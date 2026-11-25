-- Controle de Ponto: níveis próprios do módulo "timesheet".
--   1 Ver       = vê resumo, espelhos e pedidos de todos
--   2 Aprovar   = + aprova/recusa pedidos (ex.: chefe de setor)
--   3 Gerenciar = + jornadas, feriados, início do controle, marcações, férias lançadas e banco de horas (RH/Admin)
-- Antes, o nível 2 já permitia mexer em jornadas, feriados e marcações. Agora isso exige o nível 3.
-- Padrões dos perfis não mudam (Admin e RH = 3, ADM = 1). Pode ser rodada mais de uma vez.

-- Configuração geral
DROP POLICY IF EXISTS "Ponto: alteração" ON public.time_settings;
CREATE POLICY "Ponto: alteração" ON public.time_settings FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 3)) WITH CHECK (public.has_module('timesheet', 3));

-- Jornadas
DROP POLICY IF EXISTS "Ponto: inclusão" ON public.time_schedules;
CREATE POLICY "Ponto: inclusão" ON public.time_schedules FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 3));
DROP POLICY IF EXISTS "Ponto: alteração" ON public.time_schedules;
CREATE POLICY "Ponto: alteração" ON public.time_schedules FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 3)) WITH CHECK (public.has_module('timesheet', 3));
DROP POLICY IF EXISTS "Ponto: exclusão" ON public.time_schedules;
CREATE POLICY "Ponto: exclusão" ON public.time_schedules FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 3));

-- Marcações manuais
DROP POLICY IF EXISTS "Ponto: inclusão manual" ON public.time_punches;
CREATE POLICY "Ponto: inclusão manual" ON public.time_punches FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 3) AND source = 'manual' AND created_by = auth.uid());
DROP POLICY IF EXISTS "Ponto: alteração" ON public.time_punches;
CREATE POLICY "Ponto: alteração" ON public.time_punches FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 3)) WITH CHECK (public.has_module('timesheet', 3));

-- Feriados
DROP POLICY IF EXISTS "Ponto: inclusão" ON public.time_holidays;
CREATE POLICY "Ponto: inclusão" ON public.time_holidays FOR INSERT TO authenticated
    WITH CHECK (public.has_module('timesheet', 3));
DROP POLICY IF EXISTS "Ponto: alteração" ON public.time_holidays;
CREATE POLICY "Ponto: alteração" ON public.time_holidays FOR UPDATE TO authenticated
    USING (public.has_module('timesheet', 3)) WITH CHECK (public.has_module('timesheet', 3));
DROP POLICY IF EXISTS "Ponto: exclusão" ON public.time_holidays;
CREATE POLICY "Ponto: exclusão" ON public.time_holidays FOR DELETE TO authenticated
    USING (public.has_module('timesheet', 3));

-- Férias/folgas lançadas direto pelo RH (já aprovadas)
DROP POLICY IF EXISTS "Ponto: lançamento do RH" ON public.time_requests;
CREATE POLICY "Ponto: lançamento do RH" ON public.time_requests FOR INSERT TO authenticated
    WITH CHECK (
        public.has_module('timesheet', 3) AND kind <> 'ajuste' AND punch_id IS NULL
        AND created_by = auth.uid()
        AND (status = 'pendente' OR (status = 'aprovado' AND reviewed_by = auth.uid()))
        AND (status = 'pendente' OR employee_id IS DISTINCT FROM public.my_employee_id() OR public.is_admin())
    );

-- Lançamentos no banco de horas
DROP POLICY IF EXISTS "Ponto: inclusão" ON public.time_bank_entries;
CREATE POLICY "Ponto: inclusão" ON public.time_bank_entries FOR INSERT TO authenticated
    WITH CHECK (
        public.has_module('timesheet', 3) AND created_by = auth.uid()
        AND (employee_id IS DISTINCT FROM public.my_employee_id() OR public.is_admin())
    );

-- Aprovar/recusar (review_time_request) e cancelar (cancel_time_request) seguem no nível 2.
