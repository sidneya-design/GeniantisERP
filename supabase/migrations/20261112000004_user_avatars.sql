-- Foto dos usuários do ERP.
-- As imagens ficam no bucket público "avatars" (só leitura pública; são fotos
-- de perfil, sem dado sensível) em avatars/<id do usuário>/<arquivo>.
-- Envio/troca/remoção: o Admin para qualquer usuário; cada usuário na própria pasta.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Envio de fotos de usuário" ON storage.objects;
CREATE POLICY "Envio de fotos de usuário"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );

DROP POLICY IF EXISTS "Troca de fotos de usuário" ON storage.objects;
CREATE POLICY "Troca de fotos de usuário"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );

DROP POLICY IF EXISTS "Remoção de fotos de usuário" ON storage.objects;
CREATE POLICY "Remoção de fotos de usuário"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (public.is_admin() OR (storage.foldername(name))[1] = auth.uid()::text)
    );

-- Troca da própria senha (tela Meu Perfil) também fica registrada no log.
DROP POLICY IF EXISTS "Usuário registra os próprios eventos de sessão" ON public.audit_logs;
CREATE POLICY "Usuário registra os próprios eventos de sessão"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND action IN ('login', 'logout', 'password_change') AND entity = 'sessao');

-- Fotos de funcionários (avatars/funcionarios/<id do funcionário>/...):
-- quem pode editar funcionários (Admin, ADM e RH) envia, troca e remove.
DROP POLICY IF EXISTS "Fotos de funcionários: envio" ON storage.objects;
CREATE POLICY "Fotos de funcionários: envio"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'))
    );

DROP POLICY IF EXISTS "Fotos de funcionários: troca" ON storage.objects;
CREATE POLICY "Fotos de funcionários: troca"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'))
    );

DROP POLICY IF EXISTS "Fotos de funcionários: remoção" ON storage.objects;
CREATE POLICY "Fotos de funcionários: remoção"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = 'funcionarios'
        AND (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'))
    );
