-- Domínios & Renovações: cadastro de domínios/subdomínios e histórico de renovações.
-- Acesso (matriz do ERP): Admin e TI leem e editam; apenas Admin exclui.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'domain_criticality') THEN
    CREATE TYPE public.domain_criticality AS ENUM ('baixa', 'media', 'alta');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'domain_status') THEN
    CREATE TYPE public.domain_status AS ENUM ('ativo', 'cancelado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(253) NOT NULL UNIQUE,
    is_subdomain BOOLEAN NOT NULL DEFAULT false,
    parent_domain VARCHAR(253),
    registrar VARCHAR(150),
    organization VARCHAR(150),
    admin_email VARCHAR(255),
    responsible VARCHAR(150),
    backup_responsible VARCHAR(150),
    expiration_date DATE,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    renewal_cost NUMERIC(12, 2) CHECK (renewal_cost >= 0),
    criticality public.domain_criticality NOT NULL DEFAULT 'media',
    status public.domain_status NOT NULL DEFAULT 'ativo',
    services TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_expiration ON public.domains(expiration_date);

CREATE TABLE IF NOT EXISTS public.domain_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    renewed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    previous_expiration DATE,
    new_expiration DATE NOT NULL,
    cost NUMERIC(12, 2) CHECK (cost >= 0),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_renewals_domain ON public.domain_renewals(domain_id, renewed_at DESC);

DROP TRIGGER IF EXISTS trg_domains_updated_at ON public.domains;
CREATE TRIGGER trg_domains_updated_at
    BEFORE UPDATE ON public.domains
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_renewals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['domains', 'domain_renewals'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Leitura por Admin e TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Leitura por Admin e TI" ON public.%I FOR SELECT TO authenticated
             USING (public.is_admin() OR public.current_user_role() = ''ti'')', t);

        EXECUTE format('DROP POLICY IF EXISTS "Inclusão por Admin e TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Inclusão por Admin e TI" ON public.%I FOR INSERT TO authenticated
             WITH CHECK (public.is_admin() OR public.current_user_role() = ''ti'')', t);

        EXECUTE format('DROP POLICY IF EXISTS "Atualização por Admin e TI" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Atualização por Admin e TI" ON public.%I FOR UPDATE TO authenticated
             USING (public.is_admin() OR public.current_user_role() = ''ti'')
             WITH CHECK (public.is_admin() OR public.current_user_role() = ''ti'')', t);

        EXECUTE format('DROP POLICY IF EXISTS "Exclusão por Admin" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Exclusão por Admin" ON public.%I FOR DELETE TO authenticated
             USING (public.is_admin())', t);
    END LOOP;
END $$;

-- Renovação atômica: grava o histórico e atualiza o vencimento do domínio.
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

REVOKE ALL ON FUNCTION public.renew_domain(UUID, DATE, DATE, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_domain(UUID, DATE, DATE, NUMERIC, TEXT) TO authenticated;

-- Auditoria: a função de log passa a usar o nome do domínio no resumo
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_name TEXT;
    v_old JSONB;
    v_new JSONB;
    v_row JSONB;
    v_changes JSONB := '{}'::jsonb;
    v_key TEXT;
    v_ignored TEXT[] := ARRAY['created_at', 'updated_at'];
    v_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW); v_row := v_new; v_action := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_row := v_new; v_action := 'update';
        FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
            IF NOT (v_key = ANY (v_ignored)) AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
                v_changes := v_changes || jsonb_build_object(
                    v_key, jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key));
            END IF;
        END LOOP;
        -- Alteração sem mudança real (só updated_at): não registra
        IF v_changes = '{}'::jsonb THEN
            RETURN NEW;
        END IF;
    ELSE
        v_old := to_jsonb(OLD); v_row := v_old; v_action := 'delete';
    END IF;

    IF v_uid IS NOT NULL THEN
        SELECT p.email, p.full_name INTO v_email, v_name FROM public.profiles p WHERE p.id = v_uid;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_email, user_name, action, entity, entity_id, summary, details)
    VALUES (
        v_uid,
        COALESCE(v_email, CASE WHEN v_uid IS NULL THEN 'sistema' END),
        v_name,
        v_action,
        TG_TABLE_NAME,
        v_row ->> 'id',
        LEFT(COALESCE(
            v_row ->> 'service_name',
            v_row ->> 'domain',
            v_row ->> 'full_name',
            v_row ->> 'patrimony',
            v_row ->> 'name',
            v_row ->> 'email',
            v_row ->> 'issue',
            v_row ->> 'id'
        ), 200),
        CASE v_action
            WHEN 'update' THEN jsonb_build_object('alteracoes', v_changes)
            WHEN 'create' THEN jsonb_build_object('registro', v_new - v_ignored)
            ELSE jsonb_build_object('registro', v_old - v_ignored)
        END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Gatilhos de auditoria nas tabelas de domínios
DO $$
DECLARE
    t TEXT;
BEGIN
    IF to_regprocedure('public.audit_row_change()') IS NULL THEN
        RETURN;
    END IF;
    FOREACH t IN ARRAY ARRAY['domains', 'domain_renewals'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
             FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
    END LOOP;
END $$;
