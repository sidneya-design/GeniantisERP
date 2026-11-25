-- Devolução passa a aceitar qualquer ativo vinculado ao funcionário
-- (ex.: responsável preenchido mas situação "Disponível" ou "Em manutenção"),
-- e não só os que estão com situação "Em uso".
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

    -- Ajusta a situação dos ativos vinculados para que a validação da devolução os aceite
    IF p_type = 'devolucao' THEN
        UPDATE public.assets
           SET status = 'em_uso'
         WHERE id = ANY(p_asset_ids)
           AND assigned_employee_id = p_employee_id
           AND status <> 'em_uso';
    END IF;

    RETURN public._register_asset_movement_core(
        p_employee_id, p_type, p_asset_ids, p_movement_date, p_term_status, p_notes, p_term_file_path, p_term_file_name);
END;
$$;

REVOKE ALL ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;
