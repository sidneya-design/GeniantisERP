-- Fornecedores & Contratos.
-- Cadastro único de empresas (Vivo, Claro, segurança de câmeras, link de internet...)
-- e os contratos de cada uma, com PDF anexo.
-- Assinaturas e Manutenções continuam com o texto "provider"; um gatilho liga
-- automaticamente cada registro ao fornecedor de mesmo nome (criando-o se não existir).
-- Acesso: Admin, ADM e TI leem e editam; apenas Admin exclui.

-- 1. Fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200),
    cnpj VARCHAR(18),
    category VARCHAR(30) NOT NULL DEFAULT 'outros'
        CHECK (category IN ('telefonia', 'internet', 'seguranca', 'software', 'manutencao', 'impressao', 'hardware', 'servicos', 'outros')),
    status VARCHAR(10) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    phone VARCHAR(40),
    email VARCHAR(255),
    website VARCHAR(255),
    support_phone VARCHAR(40),
    support_email VARCHAR(255),
    support_url VARCHAR(255),
    customer_number VARCHAR(100),
    contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_name ON public.suppliers (lower(trim(name)));
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON public.suppliers(category);

-- 2. Contratos
CREATE TABLE IF NOT EXISTS public.supplier_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    contract_number VARCHAR(100),
    start_date DATE,
    end_date DATE,
    monthly_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
    billing_day SMALLINT CHECK (billing_day BETWEEN 1 AND 31),
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    notice_days INTEGER CHECK (notice_days >= 0),
    readjustment VARCHAR(150),
    penalty TEXT,
    status VARCHAR(12) NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'encerrado', 'cancelado')),
    file_path TEXT,
    file_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_supplier_contracts_supplier ON public.supplier_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contracts_end ON public.supplier_contracts(end_date);

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_supplier_contracts_updated_at ON public.supplier_contracts;
CREATE TRIGGER trg_supplier_contracts_updated_at BEFORE UPDATE ON public.supplier_contracts
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contracts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['suppliers', 'supplier_contracts'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Leitura por Admin ADM TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Leitura por Admin ADM TI" ON public.%I FOR SELECT TO authenticated
             USING (public.is_admin() OR public.current_user_role() IN (''adm'', ''ti''))', t);
        EXECUTE format('DROP POLICY IF EXISTS "Inclusão por Admin ADM TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Inclusão por Admin ADM TI" ON public.%I FOR INSERT TO authenticated
             WITH CHECK (public.is_admin() OR public.current_user_role() IN (''adm'', ''ti''))', t);
        EXECUTE format('DROP POLICY IF EXISTS "Atualização por Admin ADM TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Atualização por Admin ADM TI" ON public.%I FOR UPDATE TO authenticated
             USING (public.is_admin() OR public.current_user_role() IN (''adm'', ''ti''))
             WITH CHECK (public.is_admin() OR public.current_user_role() IN (''adm'', ''ti''))', t);
        EXECUTE format('DROP POLICY IF EXISTS "Exclusão por Admin" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Exclusão por Admin" ON public.%I FOR DELETE TO authenticated
             USING (public.is_admin())', t);
    END LOOP;
END $$;

-- 4. PDFs dos contratos
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-contracts', 'supplier-contracts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura de contratos de fornecedores" ON storage.objects;
CREATE POLICY "Leitura de contratos de fornecedores"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'supplier-contracts' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')));

DROP POLICY IF EXISTS "Envio de contratos de fornecedores" ON storage.objects;
CREATE POLICY "Envio de contratos de fornecedores"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'supplier-contracts' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')));

-- 5. Ligação de Assinaturas e Manutenções ao fornecedor
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.maintenance_orders
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_supplier ON public.subscriptions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_supplier ON public.maintenance_orders(supplier_id);

-- Acha o fornecedor pelo nome (sem diferenciar maiúsculas); cria se não existir
CREATE OR REPLACE FUNCTION public.resolve_supplier_id(p_name TEXT, p_category TEXT DEFAULT 'outros')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT := nullif(trim(coalesce(p_name, '')), '');
    v_id UUID;
BEGIN
    IF v_name IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT id INTO v_id FROM public.suppliers WHERE lower(trim(name)) = lower(v_name);
    IF v_id IS NULL THEN
        INSERT INTO public.suppliers (name, category) VALUES (v_name, coalesce(p_category, 'outros'))
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_id;
        IF v_id IS NULL THEN
            SELECT id INTO v_id FROM public.suppliers WHERE lower(trim(name)) = lower(v_name);
        END IF;
    END IF;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_supplier_id(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.link_row_supplier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.supplier_id := public.resolve_supplier_id(
        NEW.provider,
        CASE TG_TABLE_NAME WHEN 'subscriptions' THEN 'software' WHEN 'maintenance_orders' THEN 'manutencao' ELSE 'outros' END);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_supplier ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_supplier BEFORE INSERT OR UPDATE OF provider ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.link_row_supplier();
DROP TRIGGER IF EXISTS trg_maintenance_orders_supplier ON public.maintenance_orders;
CREATE TRIGGER trg_maintenance_orders_supplier BEFORE INSERT OR UPDATE OF provider ON public.maintenance_orders
    FOR EACH ROW EXECUTE FUNCTION public.link_row_supplier();

-- Renomear um fornecedor atualiza o nome nas assinaturas e manutenções ligadas
CREATE OR REPLACE FUNCTION public.propagate_supplier_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
        UPDATE public.subscriptions SET provider = NEW.name WHERE supplier_id = NEW.id;
        UPDATE public.maintenance_orders SET provider = NEW.name WHERE supplier_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suppliers_propagate_name ON public.suppliers;
CREATE TRIGGER trg_suppliers_propagate_name AFTER UPDATE OF name ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.propagate_supplier_name();

-- Nomes já digitados viram fornecedores
UPDATE public.subscriptions SET supplier_id = public.resolve_supplier_id(provider, 'software')
 WHERE supplier_id IS NULL AND nullif(trim(coalesce(provider, '')), '') IS NOT NULL;
UPDATE public.maintenance_orders SET supplier_id = public.resolve_supplier_id(provider, 'manutencao')
 WHERE supplier_id IS NULL AND nullif(trim(coalesce(provider, '')), '') IS NOT NULL;

-- 6. Logs de atividade
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['suppliers', 'supplier_contracts'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
             FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
    END LOOP;
END $$;

-- 7. Financeiro: inclui os contratos
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

REVOKE ALL ON FUNCTION public.get_finance_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_data() TO authenticated;
