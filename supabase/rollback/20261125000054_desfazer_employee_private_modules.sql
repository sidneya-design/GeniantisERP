-- Desfaz a 20261125000054: volta employee_private a valer só pelo perfil e reabre as
-- duas funções internas do ponto para usuários logados (estado da 20261124000053).

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_private'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.employee_private', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "Dados pessoais: leitura Admin ADM RH" ON public.employee_private FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'));
CREATE POLICY "Dados pessoais: inclusão Admin RH" ON public.employee_private FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'rh');
CREATE POLICY "Dados pessoais: alteração Admin RH" ON public.employee_private FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() = 'rh')
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'rh');
CREATE POLICY "Dados pessoais: exclusão Admin" ON public.employee_private FOR DELETE TO authenticated
    USING (public.is_admin());

GRANT EXECUTE ON FUNCTION public.time_effective_schedule(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.time_start_date(UUID) TO authenticated;
