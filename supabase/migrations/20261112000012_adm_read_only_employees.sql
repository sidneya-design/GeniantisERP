-- ADM: Funcionários só para consulta (continua vendo CPF, endereço e contato).
-- Quem cadastra e edita: Admin, RH e TI. Dados pessoais: Admin e RH gravam.
-- Pode ser rodada mais de uma vez.

-- 1. Cadastro de funcionários
DROP POLICY IF EXISTS "Escrita de funcionários por Admin ADM e RH" ON public.employees;
DROP POLICY IF EXISTS "Escrita de funcionários por Admin ADM RH e TI" ON public.employees;
DROP POLICY IF EXISTS "Escrita de funcionários por Admin RH e TI" ON public.employees;
CREATE POLICY "Escrita de funcionários por Admin RH e TI"
    ON public.employees FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('rh', 'ti'));

DROP POLICY IF EXISTS "Atualização de funcionários por Admin ADM e RH" ON public.employees;
DROP POLICY IF EXISTS "Atualização de funcionários por Admin ADM RH e TI" ON public.employees;
DROP POLICY IF EXISTS "Atualização de funcionários por Admin RH e TI" ON public.employees;
CREATE POLICY "Atualização de funcionários por Admin RH e TI"
    ON public.employees FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('rh', 'ti'))
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('rh', 'ti'));

-- 2. Dados pessoais: ADM continua lendo, mas só Admin e RH gravam
DROP POLICY IF EXISTS "Dados pessoais: inclusão Admin ADM RH" ON public.employee_private;
DROP POLICY IF EXISTS "Dados pessoais: inclusão Admin RH" ON public.employee_private;
CREATE POLICY "Dados pessoais: inclusão Admin RH"
    ON public.employee_private FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'rh');

DROP POLICY IF EXISTS "Dados pessoais: alteração Admin ADM RH" ON public.employee_private;
DROP POLICY IF EXISTS "Dados pessoais: alteração Admin RH" ON public.employee_private;
CREATE POLICY "Dados pessoais: alteração Admin RH"
    ON public.employee_private FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() = 'rh')
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'rh');

-- 3. Fotos de funcionários: Admin, RH e TI
DROP POLICY IF EXISTS "Fotos de funcionários: envio" ON storage.objects;
CREATE POLICY "Fotos de funcionários: envio"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('rh', 'ti'))
    );

DROP POLICY IF EXISTS "Fotos de funcionários: troca" ON storage.objects;
CREATE POLICY "Fotos de funcionários: troca"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('rh', 'ti'))
    );

DROP POLICY IF EXISTS "Fotos de funcionários: remoção" ON storage.objects;
CREATE POLICY "Fotos de funcionários: remoção"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('rh', 'ti'))
    );
