-- Permite ao perfil ADM operar o cadastro de funcionários.

DROP POLICY IF EXISTS "Leitura de funcionários por usuários autorizados" ON public.employees;
CREATE POLICY "Leitura de funcionários por usuários autorizados"
    ON public.employees FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'ti', 'rh', 'financeiro', 'consulta')
    );

DROP POLICY IF EXISTS "Escrita de funcionários por Admin e RH" ON public.employees;
CREATE POLICY "Escrita de funcionários por Admin ADM e RH"
    ON public.employees FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'rh')
    );

DROP POLICY IF EXISTS "Atualização de funcionários por Admin e RH" ON public.employees;
CREATE POLICY "Atualização de funcionários por Admin ADM e RH"
    ON public.employees FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'rh')
    )
    WITH CHECK (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'rh')
    );
