-- Perfil TI passa a cadastrar e editar funcionários (sem excluir).
-- Dados pessoais (employee_private) continuam só para Admin, ADM e RH.
-- Pode ser rodada mais de uma vez.

DROP POLICY IF EXISTS "Escrita de funcionários por Admin ADM e RH" ON public.employees;
DROP POLICY IF EXISTS "Escrita de funcionários por Admin ADM RH e TI" ON public.employees;
CREATE POLICY "Escrita de funcionários por Admin ADM RH e TI"
    ON public.employees FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('adm', 'rh', 'ti'));

DROP POLICY IF EXISTS "Atualização de funcionários por Admin ADM e RH" ON public.employees;
DROP POLICY IF EXISTS "Atualização de funcionários por Admin ADM RH e TI" ON public.employees;
CREATE POLICY "Atualização de funcionários por Admin ADM RH e TI"
    ON public.employees FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'rh', 'ti'))
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('adm', 'rh', 'ti'));

-- Fotos de funcionários: TI também envia/troca/remove
DROP POLICY IF EXISTS "Fotos de funcionários: envio" ON storage.objects;
CREATE POLICY "Fotos de funcionários: envio"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('adm', 'rh', 'ti'))
    );

DROP POLICY IF EXISTS "Fotos de funcionários: troca" ON storage.objects;
CREATE POLICY "Fotos de funcionários: troca"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('adm', 'rh', 'ti'))
    );

DROP POLICY IF EXISTS "Fotos de funcionários: remoção" ON storage.objects;
CREATE POLICY "Fotos de funcionários: remoção"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('adm', 'rh', 'ti'))
    );
