-- ADM: Ativos, Manutenções e Domínios só para consulta.
-- Quem edita: Admin e TI. Entregas & Devoluções continuam com o ADM.
-- Pode ser rodada mais de uma vez.

-- 1. Ativos: inclusão e alteração só Admin e TI (leitura do ADM continua)
DROP POLICY IF EXISTS "Escrita de ativos por Admin ADM e TI" ON public.assets;
DROP POLICY IF EXISTS "Escrita de ativos por Admin e TI" ON public.assets;
CREATE POLICY "Escrita de ativos por Admin e TI"
    ON public.assets FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'ti');

DROP POLICY IF EXISTS "Atualização de ativos por Admin ADM e TI" ON public.assets;
DROP POLICY IF EXISTS "Atualização de ativos por Admin e TI" ON public.assets;
CREATE POLICY "Atualização de ativos por Admin e TI"
    ON public.assets FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() = 'ti')
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'ti');

-- 2. Manutenções: abrir e mudar situação só Admin e TI
CREATE OR REPLACE FUNCTION public.register_maintenance(
    p_asset_id UUID,
    p_issue TEXT,
    p_opened_at DATE,
    p_forecast_date DATE DEFAULT NULL,
    p_provider TEXT DEFAULT NULL,
    p_cost NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_invoice_file_path TEXT DEFAULT NULL,
    p_invoice_file_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() = 'ti') THEN
        RAISE EXCEPTION 'Sem permissão para registrar manutenções.' USING ERRCODE = '42501';
    END IF;
    RETURN public._register_maintenance_core(
        p_asset_id, p_issue, p_opened_at, p_forecast_date, p_provider, p_cost, p_notes, p_invoice_file_path, p_invoice_file_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_maintenance_status(
    p_maintenance_id UUID,
    p_status TEXT,
    p_invoice_file_path TEXT DEFAULT NULL,
    p_invoice_file_name TEXT DEFAULT NULL,
    p_cost NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() = 'ti') THEN
        RAISE EXCEPTION 'Sem permissão para alterar manutenções.' USING ERRCODE = '42501';
    END IF;
    RETURN public._update_maintenance_status_core(
        p_maintenance_id, p_status, p_invoice_file_path, p_invoice_file_name, p_cost, p_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_maintenance_status(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_maintenance_status(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

-- Notas fiscais de manutenção: ADM continua vendo, mas só Admin e TI enviam
DROP POLICY IF EXISTS "Envio de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Envio de notas fiscais de manutenção"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'maintenance-invoices' AND (public.is_admin() OR public.current_user_role() = 'ti'));

-- 3. Domínios: ADM passa a ver (edição e renovação continuam com Admin e TI)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['domains', 'domain_renewals'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Leitura por Admin e TI" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Leitura por Admin, ADM e TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Leitura por Admin, ADM e TI" ON public.%I FOR SELECT TO authenticated
             USING (public.is_admin() OR public.current_user_role() IN (''adm'', ''ti''))', t);
    END LOOP;
END $$;
