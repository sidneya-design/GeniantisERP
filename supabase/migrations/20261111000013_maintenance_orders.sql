-- Ordens de manutenção vinculadas aos ativos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_status') THEN
    CREATE TYPE public.maintenance_status AS ENUM ('em_andamento', 'concluida', 'cancelada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.maintenance_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.assets(id),
    issue TEXT NOT NULL,
    opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
    provider VARCHAR(255),
    status public.maintenance_status NOT NULL DEFAULT 'em_andamento',
    forecast_date DATE,
    completed_at DATE,
    cost NUMERIC(12, 2),
    notes TEXT,
    custody_note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maintenance_orders_asset ON public.maintenance_orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_status ON public.maintenance_orders(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_opened_at ON public.maintenance_orders(opened_at DESC);

ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de manutenções por usuários autorizados" ON public.maintenance_orders;
CREATE POLICY "Leitura de manutenções por usuários autorizados"
    ON public.maintenance_orders FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'financeiro', 'consulta'));

CREATE OR REPLACE FUNCTION public.register_maintenance(
    p_asset_id UUID,
    p_issue TEXT,
    p_opened_at DATE,
    p_forecast_date DATE DEFAULT NULL,
    p_provider TEXT DEFAULT NULL,
    p_cost NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_assigned UUID;
BEGIN
    SELECT assigned_employee_id INTO v_assigned FROM public.assets WHERE id = p_asset_id AND status NOT IN ('baixado', 'em_manutencao') FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ativo não encontrado ou indisponível para manutenção.'; END IF;

    INSERT INTO public.maintenance_orders (asset_id, issue, opened_at, forecast_date, provider, cost, notes, custody_note)
    VALUES (p_asset_id, p_issue, COALESCE(p_opened_at, CURRENT_DATE), p_forecast_date, p_provider, p_cost, p_notes, CASE WHEN v_assigned IS NULL THEN 'Equipamento retirado do estoque para manutenção.' ELSE 'Vínculo com o responsável preservado durante o reparo.' END)
    RETURNING id INTO v_id;

    UPDATE public.assets SET status = 'em_manutencao', updated_at = TIMEZONE('utc', NOW()) WHERE id = p_asset_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_maintenance_status(
    p_maintenance_id UUID,
    p_status TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_asset_id UUID;
BEGIN
    IF p_status NOT IN ('em_andamento', 'concluida', 'cancelada') THEN RAISE EXCEPTION 'Status de manutenção inválido.'; END IF;
    SELECT asset_id INTO v_asset_id FROM public.maintenance_orders WHERE id = p_maintenance_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chamado de manutenção não encontrado.'; END IF;

    UPDATE public.maintenance_orders
    SET status = p_status::public.maintenance_status,
        completed_at = CASE WHEN p_status = 'em_andamento' THEN NULL ELSE CURRENT_DATE END,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_maintenance_id;

    IF p_status = 'em_andamento' THEN
        UPDATE public.assets SET status = 'em_manutencao', updated_at = TIMEZONE('utc', NOW()) WHERE id = v_asset_id;
    ELSE
        UPDATE public.assets SET status = 'disponivel', assigned_employee_id = NULL, updated_at = TIMEZONE('utc', NOW()) WHERE id = v_asset_id;
    END IF;
    RETURN p_maintenance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_maintenance_status(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
