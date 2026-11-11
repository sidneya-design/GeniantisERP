-- Permite encerrar uma manutenção com baixa patrimonial por perda.

ALTER TYPE public.maintenance_status ADD VALUE IF NOT EXISTS 'baixado';

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
    IF p_status NOT IN ('em_andamento', 'concluida', 'cancelada', 'baixado') THEN
        RAISE EXCEPTION 'Status de manutenção inválido.';
    END IF;

    SELECT asset_id INTO v_asset_id
    FROM public.maintenance_orders
    WHERE id = p_maintenance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamado de manutenção não encontrado.';
    END IF;

    UPDATE public.maintenance_orders
    SET status = p_status::public.maintenance_status,
        completed_at = CASE WHEN p_status = 'em_andamento' THEN NULL ELSE CURRENT_DATE END,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_maintenance_id;

    IF p_status = 'em_andamento' THEN
        UPDATE public.assets
        SET status = 'em_manutencao', updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_asset_id;
    ELSIF p_status = 'baixado' THEN
        UPDATE public.assets
        SET status = 'baixado', assigned_employee_id = NULL, updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_asset_id;
    ELSE
        UPDATE public.assets
        SET status = 'disponivel', assigned_employee_id = NULL, updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_asset_id;
    END IF;

    RETURN p_maintenance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_maintenance_status(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
