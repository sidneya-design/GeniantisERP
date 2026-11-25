-- Banners & Avisos: banners A4 editáveis para imprimir (ex.: calendário de fim de ano).
-- Leitura e edição: Admin, ADM, TI e RH. Exclusão: só Admin.
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    subtitle VARCHAR(200) NOT NULL DEFAULT '',
    intro TEXT NOT NULL DEFAULT '',
    cards JSONB NOT NULL DEFAULT '[]'::jsonb,
    footer TEXT NOT NULL DEFAULT '',
    show_logo BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Banners: leitura" ON public.banners;
CREATE POLICY "Banners: leitura" ON public.banners FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh'));

DROP POLICY IF EXISTS "Banners: inclusão" ON public.banners;
CREATE POLICY "Banners: inclusão" ON public.banners FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh'));

DROP POLICY IF EXISTS "Banners: alteração" ON public.banners;
CREATE POLICY "Banners: alteração" ON public.banners FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh'))
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh'));

DROP POLICY IF EXISTS "Banners: exclusão" ON public.banners;
CREATE POLICY "Banners: exclusão" ON public.banners FOR DELETE TO authenticated
    USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_banners_updated_at ON public.banners;
CREATE TRIGGER trg_banners_updated_at BEFORE UPDATE ON public.banners
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_banners ON public.banners;
CREATE TRIGGER trg_audit_banners AFTER INSERT OR UPDATE OR DELETE ON public.banners
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
