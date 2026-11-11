-- Entregas, empréstimos e devoluções de ativos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
    CREATE TYPE public.movement_type AS ENUM ('entrega', 'devolucao');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_term_status') THEN
    CREATE TYPE public.movement_term_status AS ENUM ('pendente', 'assinado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.asset_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id),
    type public.movement_type NOT NULL,
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    term_status public.movement_term_status NOT NULL DEFAULT 'pendente',
    notes TEXT,
    user_in_charge UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.asset_movement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_id UUID NOT NULL REFERENCES public.asset_movements(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.assets(id),
    UNIQUE (movement_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_movements_employee ON public.asset_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_movements_date ON public.asset_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_asset_movement_items_asset ON public.asset_movement_items(asset_id);

ALTER TABLE public.asset_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_movement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de movimentações por usuários autorizados" ON public.asset_movements;
CREATE POLICY "Leitura de movimentações por usuários autorizados"
    ON public.asset_movements FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'financeiro', 'consulta'));

DROP POLICY IF EXISTS "Leitura de itens de movimentações por usuários autorizados" ON public.asset_movement_items;
CREATE POLICY "Leitura de itens de movimentações por usuários autorizados"
    ON public.asset_movement_items FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'financeiro', 'consulta'));

CREATE OR REPLACE FUNCTION public.register_asset_movement(
    p_employee_id UUID,
    p_type TEXT,
    p_asset_ids UUID[],
    p_movement_date DATE,
    p_term_status TEXT DEFAULT 'pendente',
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_movement_id UUID;
    v_asset_id UUID;
BEGIN
    IF p_type NOT IN ('entrega', 'devolucao') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido.';
    END IF;

    IF p_term_status NOT IN ('pendente', 'assinado') THEN
        RAISE EXCEPTION 'Status de termo inválido.';
    END IF;

    IF p_asset_ids IS NULL OR cardinality(p_asset_ids) = 0 THEN
        RAISE EXCEPTION 'Selecione ao menos um ativo.';
    END IF;

    IF p_type = 'entrega' THEN
        IF EXISTS (
            SELECT 1 FROM public.employees
            WHERE id = p_employee_id AND status = 'desligado'
        ) THEN
            RAISE EXCEPTION 'Não é possível entregar ativos a um funcionário desligado.';
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.assets
            WHERE id = ANY(p_asset_ids)
              AND status <> 'disponivel'
        ) THEN
            RAISE EXCEPTION 'A entrega só pode utilizar ativos disponíveis.';
        END IF;
    ELSE
        IF EXISTS (
            SELECT 1 FROM public.assets
            WHERE id = ANY(p_asset_ids)
              AND (status <> 'em_uso' OR assigned_employee_id <> p_employee_id)
        ) THEN
            RAISE EXCEPTION 'A devolução só pode utilizar ativos vinculados ao funcionário selecionado.';
        END IF;
    END IF;

    INSERT INTO public.asset_movements (employee_id, type, movement_date, term_status, notes, user_in_charge)
    VALUES (p_employee_id, p_type::public.movement_type, COALESCE(p_movement_date, CURRENT_DATE), p_term_status::public.movement_term_status, p_notes, auth.uid())
    RETURNING id INTO v_movement_id;

    FOREACH v_asset_id IN ARRAY p_asset_ids LOOP
        INSERT INTO public.asset_movement_items (movement_id, asset_id)
        VALUES (v_movement_id, v_asset_id);
    END LOOP;

    IF p_type = 'entrega' THEN
        UPDATE public.assets
        SET status = 'em_uso', assigned_employee_id = p_employee_id, updated_at = TIMEZONE('utc', NOW())
        WHERE id = ANY(p_asset_ids);
    ELSE
        UPDATE public.assets
        SET status = 'disponivel', assigned_employee_id = NULL, updated_at = TIMEZONE('utc', NOW())
        WHERE id = ANY(p_asset_ids);
    END IF;

    RETURN v_movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
