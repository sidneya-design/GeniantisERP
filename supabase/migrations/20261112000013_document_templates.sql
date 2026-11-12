-- Modelos editáveis dos termos de entrega e devolução (Configurações › Modelos de termo).
-- Leitura: quem imprime termos (Admin, ADM e TI). Edição: só Admin.
-- Sem linha salva, o sistema usa o texto padrão.
-- Pode ser rodada mais de uma vez.

CREATE TABLE IF NOT EXISTS public.document_templates (
    id TEXT PRIMARY KEY CHECK (id IN ('termo_entrega', 'termo_devolucao')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    signatures TEXT NOT NULL DEFAULT '',
    footer TEXT NOT NULL DEFAULT '',
    show_logo BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Rodapé (para quem já rodou a versão anterior desta migration)
ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS footer TEXT NOT NULL DEFAULT '';

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Modelos: leitura Admin ADM TI" ON public.document_templates;
CREATE POLICY "Modelos: leitura Admin ADM TI"
    ON public.document_templates FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti'));

DROP POLICY IF EXISTS "Modelos: inclusão Admin" ON public.document_templates;
CREATE POLICY "Modelos: inclusão Admin"
    ON public.document_templates FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Modelos: alteração Admin" ON public.document_templates;
CREATE POLICY "Modelos: alteração Admin"
    ON public.document_templates FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Modelos: exclusão Admin" ON public.document_templates;
CREATE POLICY "Modelos: exclusão Admin"
    ON public.document_templates FOR DELETE TO authenticated
    USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at
    BEFORE UPDATE ON public.document_templates
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Alterações nos modelos aparecem nos Logs
DO $$
BEGIN
    IF to_regprocedure('public.audit_row_change()') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS trg_audit_document_templates ON public.document_templates;
        CREATE TRIGGER trg_audit_document_templates AFTER INSERT OR UPDATE OR DELETE ON public.document_templates
            FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
    END IF;
END $$;
