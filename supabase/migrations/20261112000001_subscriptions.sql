-- Assinaturas & Licenças: contratos SaaS e atribuição de licenças a funcionários.
-- O ERP não faz pagamentos: o módulo Financeiro calcula o custo de cada mês
-- a partir destes contratos (e das manutenções).
-- Acesso (matriz do ERP): Admin e ADM leem e editam; apenas Admin exclui.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('ativa', 'suspensa', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_periodicity') THEN
    CREATE TYPE public.subscription_periodicity AS ENUM ('mensal', 'anual', 'anual_pago_mensalmente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_billing_type') THEN
    CREATE TYPE public.subscription_billing_type AS ENUM ('por_usuario', 'fixo');
  END IF;
END $$;

-- 1. Contratos / assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(150) NOT NULL,
    provider VARCHAR(150),
    category VARCHAR(100),
    billing_type public.subscription_billing_type NOT NULL DEFAULT 'fixo',
    periodicity public.subscription_periodicity NOT NULL DEFAULT 'mensal',
    -- Valor cobrado por período (mensal: valor do mês; anual: valor do ano;
    -- anual pago mensalmente: valor da parcela mensal)
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    total_licenses INTEGER NOT NULL DEFAULT 1 CHECK (total_licenses >= 0),
    renewal_date DATE,
    billing_day SMALLINT CHECK (billing_day BETWEEN 1 AND 31), -- dia de vencimento no mês
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    status public.subscription_status NOT NULL DEFAULT 'ativa',
    admin_email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON public.subscriptions(renewal_date);

-- 2. Licenças atribuídas a funcionários
CREATE TABLE IF NOT EXISTS public.subscription_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    UNIQUE (subscription_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_assignments_sub ON public.subscription_assignments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_assignments_emp ON public.subscription_assignments(employee_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_assignments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['subscriptions', 'subscription_assignments'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Leitura por Admin e ADM" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Leitura por Admin e ADM" ON public.%I FOR SELECT TO authenticated
             USING (public.is_admin() OR public.current_user_role() = ''adm'')', t);

        EXECUTE format('DROP POLICY IF EXISTS "Inclusão por Admin e ADM" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Inclusão por Admin e ADM" ON public.%I FOR INSERT TO authenticated
             WITH CHECK (public.is_admin() OR public.current_user_role() = ''adm'')', t);

        EXECUTE format('DROP POLICY IF EXISTS "Atualização por Admin e ADM" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Atualização por Admin e ADM" ON public.%I FOR UPDATE TO authenticated
             USING (public.is_admin() OR public.current_user_role() = ''adm'')
             WITH CHECK (public.is_admin() OR public.current_user_role() = ''adm'')', t);

        EXECUTE format('DROP POLICY IF EXISTS "Exclusão por Admin" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Exclusão por Admin" ON public.%I FOR DELETE TO authenticated
             USING (public.is_admin())', t);
    END LOOP;
END $$;

-- Remover uma licença de um funcionário é uma edição do dia a dia: ADM também pode.
DROP POLICY IF EXISTS "Exclusão por Admin" ON public.subscription_assignments;
DROP POLICY IF EXISTS "Exclusão por Admin e ADM" ON public.subscription_assignments;
CREATE POLICY "Exclusão por Admin e ADM" ON public.subscription_assignments FOR DELETE TO authenticated
    USING (public.is_admin() OR public.current_user_role() = 'adm');
