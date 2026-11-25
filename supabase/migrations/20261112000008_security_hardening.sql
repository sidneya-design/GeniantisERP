-- Correções do teste de segurança (2026-11-12).
-- Pode ser rodada mais de uma vez.

-------------------------------------------------------------------------------
-- 1. Funções de entregas e manutenções: só usuários logados com perfil certo.
--    O Postgres deixa toda função executável por PUBLIC (inclusive visitantes
--    sem login). A função original vira "_..._core" (sem acesso direto) e a
--    função pública passa a ser um invólucro que confere o perfil antes.
-------------------------------------------------------------------------------

-- Versões antigas (sobrecargas) que o app não usa mais
DROP FUNCTION IF EXISTS public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.update_maintenance_status(UUID, TEXT);

DO $$
BEGIN
    IF to_regprocedure('public._register_asset_movement_core(uuid, text, uuid[], date, text, text, text, text)') IS NULL THEN
        ALTER FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT)
            RENAME TO _register_asset_movement_core;
    END IF;
    IF to_regprocedure('public._register_maintenance_core(uuid, text, date, date, text, numeric, text, text, text)') IS NULL THEN
        ALTER FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT)
            RENAME TO _register_maintenance_core;
    END IF;
    IF to_regprocedure('public._update_maintenance_status_core(uuid, text, text, text, numeric, text)') IS NULL THEN
        ALTER FUNCTION public.update_maintenance_status(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT)
            RENAME TO _update_maintenance_status_core;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public._register_asset_movement_core(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._register_maintenance_core(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._update_maintenance_status_core(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

-- Entregas & Devoluções: Admin, ADM e TI
CREATE OR REPLACE FUNCTION public.register_asset_movement(
    p_employee_id UUID,
    p_type TEXT,
    p_asset_ids UUID[],
    p_movement_date DATE,
    p_term_status TEXT DEFAULT 'pendente',
    p_notes TEXT DEFAULT NULL,
    p_term_file_path TEXT DEFAULT NULL,
    p_term_file_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')) THEN
        RAISE EXCEPTION 'Sem permissão para registrar entregas e devoluções.' USING ERRCODE = '42501';
    END IF;
    RETURN public._register_asset_movement_core(
        p_employee_id, p_type, p_asset_ids, p_movement_date, p_term_status, p_notes, p_term_file_path, p_term_file_name);
END;
$$;

-- Manutenções: Admin, ADM e TI
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
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')) THEN
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
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')) THEN
        RAISE EXCEPTION 'Sem permissão para alterar manutenções.' USING ERRCODE = '42501';
    END IF;
    RETURN public._update_maintenance_status_core(
        p_maintenance_id, p_status, p_invoice_file_path, p_invoice_file_name, p_cost, p_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_maintenance_status(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_maintenance_status(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

-------------------------------------------------------------------------------
-- 2. Termos de entrega e notas fiscais: só quem trabalha com esses módulos
--    (Admin, ADM e TI). Antes qualquer usuário logado lia e enviava.
-------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leitura de termos de ativos" ON storage.objects;
CREATE POLICY "Leitura de termos de ativos"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'asset-terms' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')));

DROP POLICY IF EXISTS "Envio de termos de ativos" ON storage.objects;
CREATE POLICY "Envio de termos de ativos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'asset-terms' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')));

DROP POLICY IF EXISTS "Leitura de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Leitura de notas fiscais de manutenção"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'maintenance-invoices' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')));

DROP POLICY IF EXISTS "Envio de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Envio de notas fiscais de manutenção"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'maintenance-invoices' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')));

-------------------------------------------------------------------------------
-- 3. Dados pessoais de funcionários: ver a migration 20261112000009
--    (tabela employee_private). A restrição por coluna que estava aqui foi
--    removida porque quebrava as consultas que juntam employees com outras
--    tabelas (ativos, entregas, licenças).
-------------------------------------------------------------------------------
