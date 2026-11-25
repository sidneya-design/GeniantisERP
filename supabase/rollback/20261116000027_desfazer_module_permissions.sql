-- DESFAZ a migration 20261116000027_module_permissions.sql
-- Volta as regras de acesso e as funções ao estado de 16/11/2026 (antes das permissões por módulo).
-- As tabelas role_module_defaults e user_module_permissions são mantidas (sem efeito depois disto).

-- 1. Remove as regras criadas pela 027
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'Módulo: %' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;
DROP POLICY IF EXISTS "Modelos: leitura por módulo" ON public.document_templates;
DROP POLICY IF EXISTS "Aniversariantes: leitura dos envios" ON public.audit_logs;

-- 2. Recria as regras anteriores

DROP POLICY IF EXISTS "Leitura de itens de movimentações por usuários autorizados" ON public.asset_movement_items;
CREATE POLICY "Leitura de itens de movimentações por usuários autorizados" ON public.asset_movement_items FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role, 'financeiro'::user_role, 'consulta'::user_role]))));
DROP POLICY IF EXISTS "Leitura de movimentações por usuários autorizados" ON public.asset_movements;
CREATE POLICY "Leitura de movimentações por usuários autorizados" ON public.asset_movements FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role, 'financeiro'::user_role, 'consulta'::user_role]))));
DROP POLICY IF EXISTS "Atualização de ativos por Admin e TI" ON public.assets;
CREATE POLICY "Atualização de ativos por Admin e TI" ON public.assets FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = 'ti'::user_role))) WITH CHECK ((is_admin() OR (current_user_role() = 'ti'::user_role)));
DROP POLICY IF EXISTS "Escrita de ativos por Admin e TI" ON public.assets;
CREATE POLICY "Escrita de ativos por Admin e TI" ON public.assets FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = 'ti'::user_role)));
DROP POLICY IF EXISTS "Exclusão de ativos por Admin" ON public.assets;
CREATE POLICY "Exclusão de ativos por Admin" ON public.assets FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Leitura de ativos por usuários autorizados" ON public.assets;
CREATE POLICY "Leitura de ativos por usuários autorizados" ON public.assets FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role, 'financeiro'::user_role, 'consulta'::user_role]))));
DROP POLICY IF EXISTS "ADM e RH leem envios de aniversário" ON public.audit_logs;
CREATE POLICY "ADM e RH leem envios de aniversário" ON public.audit_logs FOR SELECT TO authenticated USING ((((entity)::text = 'aniversarios'::text) AND (current_user_role() = ANY (ARRAY['adm'::user_role, 'rh'::user_role]))));
DROP POLICY IF EXISTS "Banners: alteração" ON public.banners;
CREATE POLICY "Banners: alteração" ON public.banners FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role])))) WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role]))));
DROP POLICY IF EXISTS "Banners: exclusão" ON public.banners;
CREATE POLICY "Banners: exclusão" ON public.banners FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Banners: inclusão" ON public.banners;
CREATE POLICY "Banners: inclusão" ON public.banners FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role]))));
DROP POLICY IF EXISTS "Banners: leitura" ON public.banners;
CREATE POLICY "Banners: leitura" ON public.banners FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role]))));
DROP POLICY IF EXISTS "Modelos: leitura Admin ADM TI RH" ON public.document_templates;
CREATE POLICY "Modelos: leitura Admin ADM TI RH" ON public.document_templates FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role]))));
DROP POLICY IF EXISTS "Atualização por Admin e TI" ON public.domain_renewals;
CREATE POLICY "Atualização por Admin e TI" ON public.domain_renewals FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = 'ti'::user_role))) WITH CHECK ((is_admin() OR (current_user_role() = 'ti'::user_role)));
DROP POLICY IF EXISTS "Exclusão por Admin" ON public.domain_renewals;
CREATE POLICY "Exclusão por Admin" ON public.domain_renewals FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Inclusão por Admin e TI" ON public.domain_renewals;
CREATE POLICY "Inclusão por Admin e TI" ON public.domain_renewals FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = 'ti'::user_role)));
DROP POLICY IF EXISTS "Leitura por Admin, ADM e TI" ON public.domain_renewals;
CREATE POLICY "Leitura por Admin, ADM e TI" ON public.domain_renewals FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Atualização por Admin e TI" ON public.domains;
CREATE POLICY "Atualização por Admin e TI" ON public.domains FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = 'ti'::user_role))) WITH CHECK ((is_admin() OR (current_user_role() = 'ti'::user_role)));
DROP POLICY IF EXISTS "Exclusão por Admin" ON public.domains;
CREATE POLICY "Exclusão por Admin" ON public.domains FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Inclusão por Admin e TI" ON public.domains;
CREATE POLICY "Inclusão por Admin e TI" ON public.domains FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = 'ti'::user_role)));
DROP POLICY IF EXISTS "Leitura por Admin, ADM e TI" ON public.domains;
CREATE POLICY "Leitura por Admin, ADM e TI" ON public.domains FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Atualização de funcionários por Admin RH e TI" ON public.employees;
CREATE POLICY "Atualização de funcionários por Admin RH e TI" ON public.employees FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['rh'::user_role, 'ti'::user_role])))) WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['rh'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Escrita de funcionários por Admin RH e TI" ON public.employees;
CREATE POLICY "Escrita de funcionários por Admin RH e TI" ON public.employees FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['rh'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Exclusão restrita a administradores" ON public.employees;
CREATE POLICY "Exclusão restrita a administradores" ON public.employees FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Leitura de funcionários por usuários autorizados" ON public.employees;
CREATE POLICY "Leitura de funcionários por usuários autorizados" ON public.employees FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role, 'financeiro'::user_role, 'consulta'::user_role]))));
DROP POLICY IF EXISTS "Leitura de manutenções por usuários autorizados" ON public.maintenance_orders;
CREATE POLICY "Leitura de manutenções por usuários autorizados" ON public.maintenance_orders FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'financeiro'::user_role, 'consulta'::user_role]))));
DROP POLICY IF EXISTS "Atualização por Admin e ADM" ON public.subscription_assignments;
CREATE POLICY "Atualização por Admin e ADM" ON public.subscription_assignments FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = 'adm'::user_role))) WITH CHECK ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Exclusão por Admin e ADM" ON public.subscription_assignments;
CREATE POLICY "Exclusão por Admin e ADM" ON public.subscription_assignments FOR DELETE TO authenticated USING ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Inclusão por Admin e ADM" ON public.subscription_assignments;
CREATE POLICY "Inclusão por Admin e ADM" ON public.subscription_assignments FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Leitura por Admin e ADM" ON public.subscription_assignments;
CREATE POLICY "Leitura por Admin e ADM" ON public.subscription_assignments FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Atualização por Admin e ADM" ON public.subscriptions;
CREATE POLICY "Atualização por Admin e ADM" ON public.subscriptions FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = 'adm'::user_role))) WITH CHECK ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Exclusão por Admin" ON public.subscriptions;
CREATE POLICY "Exclusão por Admin" ON public.subscriptions FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Inclusão por Admin e ADM" ON public.subscriptions;
CREATE POLICY "Inclusão por Admin e ADM" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Leitura por Admin e ADM" ON public.subscriptions;
CREATE POLICY "Leitura por Admin e ADM" ON public.subscriptions FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = 'adm'::user_role)));
DROP POLICY IF EXISTS "Atualização por Admin ADM TI" ON public.supplier_contracts;
CREATE POLICY "Atualização por Admin ADM TI" ON public.supplier_contracts FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role])))) WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Exclusão por Admin" ON public.supplier_contracts;
CREATE POLICY "Exclusão por Admin" ON public.supplier_contracts FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Inclusão por Admin ADM TI" ON public.supplier_contracts;
CREATE POLICY "Inclusão por Admin ADM TI" ON public.supplier_contracts FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Leitura por Admin ADM TI" ON public.supplier_contracts;
CREATE POLICY "Leitura por Admin ADM TI" ON public.supplier_contracts FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Atualização por Admin ADM TI" ON public.suppliers;
CREATE POLICY "Atualização por Admin ADM TI" ON public.suppliers FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role])))) WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Exclusão por Admin" ON public.suppliers;
CREATE POLICY "Exclusão por Admin" ON public.suppliers FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Inclusão por Admin ADM TI" ON public.suppliers;
CREATE POLICY "Inclusão por Admin ADM TI" ON public.suppliers FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Leitura por Admin ADM TI" ON public.suppliers;
CREATE POLICY "Leitura por Admin ADM TI" ON public.suppliers FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role]))));
DROP POLICY IF EXISTS "Envio de contratos de fornecedores" ON storage.objects;
CREATE POLICY "Envio de contratos de fornecedores" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'supplier-contracts'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Envio de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Envio de notas fiscais de manutenção" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'maintenance-invoices'::text) AND (is_admin() OR (current_user_role() = 'ti'::user_role))));
DROP POLICY IF EXISTS "Envio de termos de ativos" ON storage.objects;
CREATE POLICY "Envio de termos de ativos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'asset-terms'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Fotos de funcionários: envio" ON storage.objects;
CREATE POLICY "Fotos de funcionários: envio" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'funcionarios'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['rh'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Fotos de funcionários: remoção" ON storage.objects;
CREATE POLICY "Fotos de funcionários: remoção" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'funcionarios'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['rh'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Fotos de funcionários: troca" ON storage.objects;
CREATE POLICY "Fotos de funcionários: troca" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'funcionarios'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['rh'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Leitura de contratos de fornecedores" ON storage.objects;
CREATE POLICY "Leitura de contratos de fornecedores" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'supplier-contracts'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Leitura de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Leitura de notas fiscais de manutenção" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'maintenance-invoices'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role])))));
DROP POLICY IF EXISTS "Leitura de termos de ativos" ON storage.objects;
CREATE POLICY "Leitura de termos de ativos" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'asset-terms'::text) AND (is_admin() OR (current_user_role() = ANY (ARRAY['adm'::user_role, 'ti'::user_role, 'rh'::user_role])))));

DO $$
BEGIN
    IF to_regclass('public.subscription_charges') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Atualização por Admin e ADM" ON public.subscription_charges';
        EXECUTE 'CREATE POLICY "Atualização por Admin e ADM" ON public.subscription_charges FOR UPDATE TO authenticated USING ((is_admin() OR (current_user_role() = ''adm''::user_role))) WITH CHECK ((is_admin() OR (current_user_role() = ''adm''::user_role)))';
        EXECUTE 'DROP POLICY IF EXISTS "Exclusão por Admin" ON public.subscription_charges';
        EXECUTE 'CREATE POLICY "Exclusão por Admin" ON public.subscription_charges FOR DELETE TO authenticated USING (is_admin())';
        EXECUTE 'DROP POLICY IF EXISTS "Inclusão por Admin e ADM" ON public.subscription_charges';
        EXECUTE 'CREATE POLICY "Inclusão por Admin e ADM" ON public.subscription_charges FOR INSERT TO authenticated WITH CHECK ((is_admin() OR (current_user_role() = ''adm''::user_role)))';
        EXECUTE 'DROP POLICY IF EXISTS "Leitura por Admin e ADM" ON public.subscription_charges';
        EXECUTE 'CREATE POLICY "Leitura por Admin e ADM" ON public.subscription_charges FOR SELECT TO authenticated USING ((is_admin() OR (current_user_role() = ''adm''::user_role)))';
    END IF;
END $$;

-- 3. Funções com a checagem por perfil de antes

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
DECLARE
    v_id UUID;
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')) THEN
        RAISE EXCEPTION 'Sem permissão para registrar entregas e devoluções.' USING ERRCODE = '42501';
    END IF;

    IF p_type = 'devolucao' THEN
        UPDATE public.assets
           SET status = 'em_uso'
         WHERE id = ANY(p_asset_ids)
           AND assigned_employee_id = p_employee_id
           AND status <> 'em_uso';
    END IF;

    v_id := public._register_asset_movement_core(
        p_employee_id, p_type, p_asset_ids, p_movement_date,
        CASE WHEN p_term_status = 'nao_utiliza' THEN 'pendente' ELSE p_term_status END,
        p_notes, p_term_file_path, p_term_file_name);

    IF p_term_status = 'nao_utiliza' THEN
        UPDATE public.asset_movements SET term_status = 'nao_utiliza'::public.movement_term_status WHERE id = v_id;
    END IF;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_asset_movement(
    p_movement_id UUID,
    p_movement_date DATE,
    p_term_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_term_file_path TEXT DEFAULT NULL,
    p_term_file_name TEXT DEFAULT NULL,
    p_asset_ids UUID[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_movement public.asset_movements%ROWTYPE;
    v_removed UUID[];
    v_added UUID[];
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')) THEN
        RAISE EXCEPTION 'Sem permissão para editar movimentações.' USING ERRCODE = '42501';
    END IF;
    IF p_term_status NOT IN ('pendente', 'assinado', 'nao_utiliza') THEN
        RAISE EXCEPTION 'Status de termo inválido.';
    END IF;
    IF p_movement_date IS NULL THEN
        RAISE EXCEPTION 'Informe a data da movimentação.';
    END IF;

    SELECT * INTO v_movement FROM public.asset_movements WHERE id = p_movement_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimentação não encontrada.';
    END IF;

    IF p_asset_ids IS NOT NULL THEN
        IF v_movement.type <> 'entrega' THEN
            RAISE EXCEPTION 'Só é possível trocar os itens de uma entrega.';
        END IF;

        p_asset_ids := ARRAY(SELECT DISTINCT unnest(p_asset_ids));
        IF cardinality(p_asset_ids) = 0 THEN
            RAISE EXCEPTION 'Selecione ao menos um ativo.';
        END IF;

        SELECT coalesce(array_agg(asset_id), '{}') INTO v_removed
          FROM public.asset_movement_items
         WHERE movement_id = p_movement_id AND NOT (asset_id = ANY(p_asset_ids));

        SELECT coalesce(array_agg(a), '{}') INTO v_added
          FROM unnest(p_asset_ids) AS a
         WHERE NOT EXISTS (SELECT 1 FROM public.asset_movement_items WHERE movement_id = p_movement_id AND asset_id = a);

        IF EXISTS (SELECT 1 FROM public.assets WHERE id = ANY(v_removed)
                    AND assigned_employee_id IS DISTINCT FROM v_movement.employee_id) THEN
            RAISE EXCEPTION 'Um dos ativos removidos não está mais com este funcionário. Use uma devolução.';
        END IF;

        IF cardinality(v_added) > 0 THEN
            IF EXISTS (SELECT 1 FROM public.employees WHERE id = v_movement.employee_id AND status = 'desligado') THEN
                RAISE EXCEPTION 'Não é possível entregar ativos a um funcionário desligado.';
            END IF;
            IF (SELECT count(*) FROM public.assets WHERE id = ANY(v_added) AND status = 'disponivel') <> cardinality(v_added) THEN
                RAISE EXCEPTION 'Os ativos incluídos precisam estar disponíveis.';
            END IF;
        END IF;

        UPDATE public.assets
           SET status = 'disponivel', assigned_employee_id = NULL, updated_at = TIMEZONE('utc', NOW())
         WHERE id = ANY(v_removed);
        DELETE FROM public.asset_movement_items
         WHERE movement_id = p_movement_id AND asset_id = ANY(v_removed);

        UPDATE public.assets
           SET status = 'em_uso', assigned_employee_id = v_movement.employee_id, updated_at = TIMEZONE('utc', NOW())
         WHERE id = ANY(v_added);
        INSERT INTO public.asset_movement_items (movement_id, asset_id)
        SELECT p_movement_id, a FROM unnest(v_added) AS a;
    END IF;

    UPDATE public.asset_movements
       SET movement_date = p_movement_date,
           term_status = p_term_status::public.movement_term_status,
           notes = nullif(trim(coalesce(p_notes, '')), ''),
           -- PDF nulo = mantém o arquivo já anexado
           term_file_path = coalesce(nullif(p_term_file_path, ''), term_file_path),
           term_file_name = CASE WHEN coalesce(p_term_file_path, '') <> '' THEN p_term_file_name ELSE term_file_name END
     WHERE id = p_movement_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.renew_domain(
    p_domain_id UUID,
    p_new_expiration DATE,
    p_renewed_at DATE DEFAULT CURRENT_DATE,
    p_cost NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev DATE;
    v_id UUID;
BEGIN
    IF NOT (public.is_admin() OR public.current_user_role() = 'ti') THEN
        RAISE EXCEPTION 'Sem permissão para renovar domínios.' USING ERRCODE = '42501';
    END IF;

    SELECT expiration_date INTO v_prev FROM public.domains WHERE id = p_domain_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Domínio não encontrado.';
    END IF;
    IF p_new_expiration IS NULL OR (v_prev IS NOT NULL AND p_new_expiration <= v_prev) THEN
        RAISE EXCEPTION 'O novo vencimento precisa ser depois do vencimento atual.';
    END IF;

    INSERT INTO public.domain_renewals (domain_id, renewed_at, previous_expiration, new_expiration, cost, notes)
    VALUES (p_domain_id, COALESCE(p_renewed_at, CURRENT_DATE), v_prev, p_new_expiration, p_cost, p_notes)
    RETURNING id INTO v_id;

    UPDATE public.domains
    SET expiration_date = p_new_expiration,
        renewal_cost = COALESCE(p_cost, renewal_cost),
        status = 'ativo'
    WHERE id = p_domain_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_finance_data()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'rh')) THEN
        RAISE EXCEPTION 'Sem permissão para ver o Financeiro.' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'subscriptions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'service_name', s.service_name,
                'provider', s.provider,
                'category', s.category,
                'periodicity', s.periodicity,
                'billing_type', s.billing_type,
                'amount', s.amount,
                'total_licenses', s.total_licenses,
                'renewal_date', s.renewal_date,
                'billing_day', s.billing_day,
                'status', s.status
            ) ORDER BY s.service_name)
            FROM public.subscriptions s
        ), '[]'::jsonb),
        'maintenances', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', m.id,
                'patrimony', a.patrimony,
                'equipment', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.brand, a.model)), ''), a.category),
                'issue', m.issue,
                'provider', m.provider,
                'status', m.status,
                'opened_at', m.opened_at,
                'completed_at', m.completed_at,
                'cost', m.cost
            ) ORDER BY m.opened_at DESC)
            FROM public.maintenance_orders m
            LEFT JOIN public.assets a ON a.id = m.asset_id
            WHERE m.status <> 'cancelada' AND COALESCE(m.cost, 0) > 0
        ), '[]'::jsonb),
        'domains', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', d.id,
                'domain', d.domain,
                'registrar', d.registrar,
                'expiration_date', d.expiration_date,
                'renewal_cost', d.renewal_cost,
                'auto_renew', d.auto_renew
            ) ORDER BY d.expiration_date)
            FROM public.domains d
            WHERE d.status = 'ativo' AND d.expiration_date IS NOT NULL AND COALESCE(d.renewal_cost, 0) > 0
        ), '[]'::jsonb),
        'domain_renewals', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', r.id,
                'domain', d.domain,
                'registrar', d.registrar,
                'renewed_at', r.renewed_at,
                'new_expiration', r.new_expiration,
                'cost', r.cost
            ) ORDER BY r.renewed_at DESC)
            FROM public.domain_renewals r
            JOIN public.domains d ON d.id = r.domain_id
            WHERE COALESCE(r.cost, 0) > 0
        ), '[]'::jsonb),
        'asset_purchases', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'patrimony', a.patrimony,
                'equipment', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.brand, a.model)), ''), a.category),
                'category', a.category,
                'acquisition_date', a.acquisition_date,
                'purchase_cost', a.purchase_cost
            ) ORDER BY a.acquisition_date DESC)
            FROM public.assets a
            WHERE a.acquisition_date IS NOT NULL AND COALESCE(a.purchase_cost, 0) > 0
        ), '[]'::jsonb),
        'contracts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'supplier', s.name,
                'start_date', c.start_date,
                'end_date', c.end_date,
                'auto_renew', c.auto_renew,
                'billing_day', c.billing_day,
                'monthly_amount', c.monthly_amount,
                'status', c.status
            ) ORDER BY s.name, c.name)
            FROM public.supplier_contracts c
            JOIN public.suppliers s ON s.id = c.supplier_id
            WHERE c.status <> 'cancelado' AND COALESCE(c.monthly_amount, 0) > 0
        ), '[]'::jsonb)
    );
END;
$$;

