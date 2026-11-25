-- Desfaz o ponto duplicado criado em 23/11/2026 (migrations 20261123000035/036, já descartadas do código).
-- O controle de ponto oficial é o "timesheet" (migrations 20261119000035 a 040) e não é tocado aqui.
-- Rode uma vez no SQL Editor do Supabase. Pode ser rodado mais de uma vez.

-- 1. Tabela e funções que só o ponto duplicado usava
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP FUNCTION IF EXISTS public.register_time_entry(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, REAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.time_entries_touch();

-- 2. Módulo "timeclock" (o oficial se chama "timesheet")
DELETE FROM public.user_module_permissions WHERE module = 'timeclock';
DELETE FROM public.role_module_defaults WHERE module = 'timeclock';

-- 3. my_employee_id(): volta exatamente como na 20261119000036_timekeeping.sql
--    (a versão de 23/11 deixava de fora funcionários desligados)
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

-- 4. Leitura de funcionários: volta como na 20261118000032_terms_module.sql
--    (o ponto oficial tem a regra própria "Ponto: leitura de funcionários", que continua)
DROP POLICY IF EXISTS "Módulo: leitura" ON public.employees;
CREATE POLICY "Módulo: leitura" ON public.employees FOR SELECT TO authenticated USING (
    public.has_module('employees', 1) OR public.has_module('movements', 1) OR public.has_module('assets', 1)
    OR public.has_module('maintenance', 1) OR public.has_module('subscriptions', 1) OR public.has_module('birthdays', 1)
    OR public.has_module('communications', 2) OR public.has_module('documents', 1)
);

-- 5. Configurações de e-mail: volta como na 20261118000028_email_settings.sql
DROP POLICY IF EXISTS "E-mail: leitura" ON public.email_settings;
CREATE POLICY "E-mail: leitura" ON public.email_settings FOR SELECT TO authenticated USING (true);

-- Conferência: deve voltar "time_entries_existe = false"
SELECT to_regclass('public.time_entries') IS NOT NULL AS time_entries_existe;
