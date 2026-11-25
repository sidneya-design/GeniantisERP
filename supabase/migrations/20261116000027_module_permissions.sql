-- Permissões por módulo: o perfil define o padrão e o Admin ajusta por pessoa.
-- Níveis: 0 sem acesso, 1 ver, 2 editar, 3 editar e excluir.
-- Todas as regras de acesso (tabelas, arquivos e funções) passam a usar public.has_module().
-- Continuam por perfil/Admin: dados pessoais dos funcionários (employee_private), perfis de usuário,
-- logs, departamentos/unidades e alteração dos modelos de termo.
-- Pode ser rodada mais de uma vez.

-- 1. Padrão por perfil (igual ao que o sistema usa hoje)
CREATE TABLE IF NOT EXISTS public.role_module_defaults (
    role TEXT NOT NULL,
    module TEXT NOT NULL,
    level SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 3),
    PRIMARY KEY (role, module)
);

INSERT INTO public.role_module_defaults (role, module, level) VALUES
    ('admin', 'overview', 3),
    ('admin', 'employees', 3),
    ('admin', 'assets', 3),
    ('admin', 'movements', 3),
    ('admin', 'maintenance', 3),
    ('admin', 'subscriptions', 3),
    ('admin', 'suppliers', 3),
    ('admin', 'domains', 3),
    ('admin', 'birthdays', 3),
    ('admin', 'banners', 3),
    ('admin', 'reports', 3),
    ('admin', 'finance', 3),
    ('admin', 'logs', 1),
    ('admin', 'settings', 3),
    ('adm', 'overview', 2),
    ('adm', 'employees', 1),
    ('adm', 'assets', 1),
    ('adm', 'movements', 2),
    ('adm', 'maintenance', 1),
    ('adm', 'subscriptions', 2),
    ('adm', 'suppliers', 2),
    ('adm', 'domains', 1),
    ('adm', 'birthdays', 2),
    ('adm', 'banners', 2),
    ('adm', 'reports', 1),
    ('adm', 'finance', 1),
    ('adm', 'logs', 0),
    ('adm', 'settings', 0),
    ('ti', 'overview', 1),
    ('ti', 'employees', 2),
    ('ti', 'assets', 2),
    ('ti', 'movements', 2),
    ('ti', 'maintenance', 2),
    ('ti', 'subscriptions', 0),
    ('ti', 'suppliers', 2),
    ('ti', 'domains', 2),
    ('ti', 'birthdays', 0),
    ('ti', 'banners', 2),
    ('ti', 'reports', 1),
    ('ti', 'finance', 0),
    ('ti', 'logs', 0),
    ('ti', 'settings', 0),
    ('rh', 'overview', 1),
    ('rh', 'employees', 2),
    ('rh', 'assets', 0),
    ('rh', 'movements', 1),
    ('rh', 'maintenance', 0),
    ('rh', 'subscriptions', 0),
    ('rh', 'suppliers', 0),
    ('rh', 'domains', 0),
    ('rh', 'birthdays', 2),
    ('rh', 'banners', 2),
    ('rh', 'reports', 1),
    ('rh', 'finance', 1),
    ('rh', 'logs', 0),
    ('rh', 'settings', 0),
    ('financeiro', 'overview', 1),
    ('financeiro', 'employees', 1),
    ('financeiro', 'assets', 1),
    ('financeiro', 'movements', 0),
    ('financeiro', 'maintenance', 0),
    ('financeiro', 'subscriptions', 2),
    ('financeiro', 'suppliers', 0),
    ('financeiro', 'domains', 1),
    ('financeiro', 'birthdays', 0),
    ('financeiro', 'banners', 0),
    ('financeiro', 'reports', 1),
    ('financeiro', 'finance', 0),
    ('financeiro', 'logs', 0),
    ('financeiro', 'settings', 0),
    ('consulta', 'overview', 1),
    ('consulta', 'employees', 1),
    ('consulta', 'assets', 1),
    ('consulta', 'movements', 1),
    ('consulta', 'maintenance', 1),
    ('consulta', 'subscriptions', 1),
    ('consulta', 'suppliers', 0),
    ('consulta', 'domains', 1),
    ('consulta', 'birthdays', 1),
    ('consulta', 'banners', 0),
    ('consulta', 'reports', 1),
    ('consulta', 'finance', 0),
    ('consulta', 'logs', 0),
    ('consulta', 'settings', 0)
ON CONFLICT (role, module) DO NOTHING;

-- 2. Ajustes por pessoa (sobrepõem o padrão do perfil)
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    level SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 3),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (user_id, module),
    CHECK (module NOT IN ('logs', 'settings'))
);

ALTER TABLE public.role_module_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Padrões: leitura" ON public.role_module_defaults;
CREATE POLICY "Padrões: leitura" ON public.role_module_defaults FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Padrões: Admin altera" ON public.role_module_defaults;
CREATE POLICY "Padrões: Admin altera" ON public.role_module_defaults FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Ajustes: leitura própria ou Admin" ON public.user_module_permissions;
CREATE POLICY "Ajustes: leitura própria ou Admin" ON public.user_module_permissions FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Ajustes: Admin altera" ON public.user_module_permissions;
CREATE POLICY "Ajustes: Admin altera" ON public.user_module_permissions FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_audit_user_module_permissions ON public.user_module_permissions;
CREATE TRIGGER trg_audit_user_module_permissions AFTER INSERT OR UPDATE OR DELETE ON public.user_module_permissions
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 3. Nível da pessoa logada num módulo
CREATE OR REPLACE FUNCTION public.module_level(p_module TEXT)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_level SMALLINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 0;
    END IF;
    IF public.is_admin() THEN
        RETURN 3;
    END IF;
    IF p_module IN ('logs', 'settings') THEN
        RETURN 0;
    END IF;
    SELECT level INTO v_level FROM public.user_module_permissions WHERE user_id = auth.uid() AND module = p_module;
    IF FOUND THEN
        RETURN v_level;
    END IF;
    SELECT level INTO v_level FROM public.role_module_defaults
     WHERE role = public.current_user_role()::text AND module = p_module;
    RETURN COALESCE(v_level, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_module(p_module TEXT, p_level INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.module_level(p_module) >= p_level $$;

REVOKE ALL ON FUNCTION public.module_level(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_module(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.module_level(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module(TEXT, INTEGER) TO authenticated;

-- 4. Regras das tabelas: remove as regras atuais destas tabelas e recria por módulo
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename, policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY (ARRAY['employees', 'assets', 'subscriptions', 'subscription_assignments', 'subscription_charges', 'suppliers', 'supplier_contracts', 'domains', 'domain_renewals', 'banners', 'asset_movements', 'asset_movement_items', 'maintenance_orders'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- employees
CREATE POLICY "Módulo: leitura" ON public.employees FOR SELECT TO authenticated USING (public.has_module('employees', 1) OR public.has_module('movements', 1) OR public.has_module('assets', 1) OR public.has_module('maintenance', 1) OR public.has_module('subscriptions', 1) OR public.has_module('birthdays', 1));
CREATE POLICY "Módulo: inclusão" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_module('employees', 2));
CREATE POLICY "Módulo: alteração" ON public.employees FOR UPDATE TO authenticated USING (public.has_module('employees', 2)) WITH CHECK (public.has_module('employees', 2));
CREATE POLICY "Módulo: exclusão" ON public.employees FOR DELETE TO authenticated USING (public.has_module('employees', 3));

-- assets
CREATE POLICY "Módulo: leitura" ON public.assets FOR SELECT TO authenticated USING (public.has_module('assets', 1) OR public.has_module('movements', 1) OR public.has_module('maintenance', 1));
CREATE POLICY "Módulo: inclusão" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.has_module('assets', 2));
CREATE POLICY "Módulo: alteração" ON public.assets FOR UPDATE TO authenticated USING (public.has_module('assets', 2)) WITH CHECK (public.has_module('assets', 2));
CREATE POLICY "Módulo: exclusão" ON public.assets FOR DELETE TO authenticated USING (public.has_module('assets', 3));

-- subscriptions
CREATE POLICY "Módulo: leitura" ON public.subscriptions FOR SELECT TO authenticated USING (public.has_module('subscriptions', 1));
CREATE POLICY "Módulo: inclusão" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (public.has_module('subscriptions', 2));
CREATE POLICY "Módulo: alteração" ON public.subscriptions FOR UPDATE TO authenticated USING (public.has_module('subscriptions', 2)) WITH CHECK (public.has_module('subscriptions', 2));
CREATE POLICY "Módulo: exclusão" ON public.subscriptions FOR DELETE TO authenticated USING (public.has_module('subscriptions', 3));

-- subscription_assignments
CREATE POLICY "Módulo: leitura" ON public.subscription_assignments FOR SELECT TO authenticated USING (public.has_module('subscriptions', 1));
CREATE POLICY "Módulo: inclusão" ON public.subscription_assignments FOR INSERT TO authenticated WITH CHECK (public.has_module('subscriptions', 2));
CREATE POLICY "Módulo: alteração" ON public.subscription_assignments FOR UPDATE TO authenticated USING (public.has_module('subscriptions', 2)) WITH CHECK (public.has_module('subscriptions', 2));
CREATE POLICY "Módulo: exclusão" ON public.subscription_assignments FOR DELETE TO authenticated USING (public.has_module('subscriptions', 2));

-- subscription_charges
DO $$
BEGIN
    IF to_regclass('public.subscription_charges') IS NOT NULL THEN
        EXECUTE 'CREATE POLICY "Módulo: leitura" ON public.subscription_charges FOR SELECT TO authenticated USING (public.has_module(''subscriptions'', 1));';
        EXECUTE 'CREATE POLICY "Módulo: inclusão" ON public.subscription_charges FOR INSERT TO authenticated WITH CHECK (public.has_module(''subscriptions'', 2));';
        EXECUTE 'CREATE POLICY "Módulo: alteração" ON public.subscription_charges FOR UPDATE TO authenticated USING (public.has_module(''subscriptions'', 2)) WITH CHECK (public.has_module(''subscriptions'', 2));';
        EXECUTE 'CREATE POLICY "Módulo: exclusão" ON public.subscription_charges FOR DELETE TO authenticated USING (public.has_module(''subscriptions'', 3));';
    END IF;
END $$;

-- suppliers
CREATE POLICY "Módulo: leitura" ON public.suppliers FOR SELECT TO authenticated USING (public.has_module('suppliers', 1) OR public.has_module('subscriptions', 1) OR public.has_module('maintenance', 1));
CREATE POLICY "Módulo: inclusão" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_module('suppliers', 2));
CREATE POLICY "Módulo: alteração" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_module('suppliers', 2)) WITH CHECK (public.has_module('suppliers', 2));
CREATE POLICY "Módulo: exclusão" ON public.suppliers FOR DELETE TO authenticated USING (public.has_module('suppliers', 3));

-- supplier_contracts
CREATE POLICY "Módulo: leitura" ON public.supplier_contracts FOR SELECT TO authenticated USING (public.has_module('suppliers', 1));
CREATE POLICY "Módulo: inclusão" ON public.supplier_contracts FOR INSERT TO authenticated WITH CHECK (public.has_module('suppliers', 2));
CREATE POLICY "Módulo: alteração" ON public.supplier_contracts FOR UPDATE TO authenticated USING (public.has_module('suppliers', 2)) WITH CHECK (public.has_module('suppliers', 2));
CREATE POLICY "Módulo: exclusão" ON public.supplier_contracts FOR DELETE TO authenticated USING (public.has_module('suppliers', 3));

-- domains
CREATE POLICY "Módulo: leitura" ON public.domains FOR SELECT TO authenticated USING (public.has_module('domains', 1));
CREATE POLICY "Módulo: inclusão" ON public.domains FOR INSERT TO authenticated WITH CHECK (public.has_module('domains', 2));
CREATE POLICY "Módulo: alteração" ON public.domains FOR UPDATE TO authenticated USING (public.has_module('domains', 2)) WITH CHECK (public.has_module('domains', 2));
CREATE POLICY "Módulo: exclusão" ON public.domains FOR DELETE TO authenticated USING (public.has_module('domains', 3));

-- domain_renewals
CREATE POLICY "Módulo: leitura" ON public.domain_renewals FOR SELECT TO authenticated USING (public.has_module('domains', 1));
CREATE POLICY "Módulo: inclusão" ON public.domain_renewals FOR INSERT TO authenticated WITH CHECK (public.has_module('domains', 2));
CREATE POLICY "Módulo: alteração" ON public.domain_renewals FOR UPDATE TO authenticated USING (public.has_module('domains', 2)) WITH CHECK (public.has_module('domains', 2));
CREATE POLICY "Módulo: exclusão" ON public.domain_renewals FOR DELETE TO authenticated USING (public.has_module('domains', 3));

-- banners
CREATE POLICY "Módulo: leitura" ON public.banners FOR SELECT TO authenticated USING (public.has_module('banners', 1));
CREATE POLICY "Módulo: inclusão" ON public.banners FOR INSERT TO authenticated WITH CHECK (public.has_module('banners', 2));
CREATE POLICY "Módulo: alteração" ON public.banners FOR UPDATE TO authenticated USING (public.has_module('banners', 2)) WITH CHECK (public.has_module('banners', 2));
CREATE POLICY "Módulo: exclusão" ON public.banners FOR DELETE TO authenticated USING (public.has_module('banners', 3));

-- Tabelas gravadas só pelas funções do sistema: aqui só a leitura
CREATE POLICY "Módulo: leitura" ON public.asset_movements FOR SELECT TO authenticated USING (public.has_module('movements', 1) OR public.has_module('assets', 1) OR public.has_module('employees', 1));
CREATE POLICY "Módulo: leitura" ON public.asset_movement_items FOR SELECT TO authenticated USING (public.has_module('movements', 1) OR public.has_module('assets', 1) OR public.has_module('employees', 1));
CREATE POLICY "Módulo: leitura" ON public.maintenance_orders FOR SELECT TO authenticated USING (public.has_module('maintenance', 1) OR public.has_module('assets', 1));

-- Modelos de termo: leitura por quem usa Entregas & Devoluções; alteração continua só Admin
DROP POLICY IF EXISTS "Modelos: leitura Admin ADM TI RH" ON public.document_templates;
DROP POLICY IF EXISTS "Modelos: leitura por módulo" ON public.document_templates;
CREATE POLICY "Modelos: leitura por módulo" ON public.document_templates FOR SELECT TO authenticated
    USING (public.has_module('movements', 1));

-- Log de envios de aniversário
DROP POLICY IF EXISTS "ADM e RH leem envios de aniversário" ON public.audit_logs;
DROP POLICY IF EXISTS "Aniversariantes: leitura dos envios" ON public.audit_logs;
CREATE POLICY "Aniversariantes: leitura dos envios" ON public.audit_logs FOR SELECT TO authenticated
    USING (entity = 'aniversarios' AND public.has_module('birthdays', 1));

-- 5. Arquivos
DROP POLICY IF EXISTS "Leitura de termos de ativos" ON storage.objects;
CREATE POLICY "Leitura de termos de ativos" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'asset-terms' AND public.has_module('movements', 1));
DROP POLICY IF EXISTS "Envio de termos de ativos" ON storage.objects;
CREATE POLICY "Envio de termos de ativos" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'asset-terms' AND public.has_module('movements', 2));

DROP POLICY IF EXISTS "Leitura de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Leitura de notas fiscais de manutenção" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'maintenance-invoices' AND public.has_module('maintenance', 1));
DROP POLICY IF EXISTS "Envio de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Envio de notas fiscais de manutenção" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'maintenance-invoices' AND public.has_module('maintenance', 2));

DROP POLICY IF EXISTS "Leitura de contratos de fornecedores" ON storage.objects;
CREATE POLICY "Leitura de contratos de fornecedores" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'supplier-contracts' AND public.has_module('suppliers', 1));
DROP POLICY IF EXISTS "Envio de contratos de fornecedores" ON storage.objects;
CREATE POLICY "Envio de contratos de fornecedores" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'supplier-contracts' AND public.has_module('suppliers', 2));

DROP POLICY IF EXISTS "Fotos de funcionários: envio" ON storage.objects;
CREATE POLICY "Fotos de funcionários: envio" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'funcionarios' AND public.has_module('employees', 2));
DROP POLICY IF EXISTS "Fotos de funcionários: troca" ON storage.objects;
CREATE POLICY "Fotos de funcionários: troca" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'funcionarios' AND public.has_module('employees', 2));
DROP POLICY IF EXISTS "Fotos de funcionários: remoção" ON storage.objects;
CREATE POLICY "Fotos de funcionários: remoção" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'funcionarios' AND public.has_module('employees', 2));

-- 6. Funções do sistema: mesma lógica de antes, conferindo o módulo em vez do perfil

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
    IF NOT public.has_module('movements', 2) THEN
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
    IF NOT public.has_module('movements', 2) THEN
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
    IF NOT public.has_module('maintenance', 2) THEN
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
    IF NOT public.has_module('maintenance', 2) THEN
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
    IF NOT public.has_module('domains', 2) THEN
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
    IF NOT public.has_module('finance', 1) THEN
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

