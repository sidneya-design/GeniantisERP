-- Permite editar uma movimentação já registrada: data, observações,
-- status do termo e anexar/substituir o PDF do termo assinado.
-- Os ativos da movimentação não são alterados aqui.
DROP FUNCTION IF EXISTS public.attach_movement_term(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_asset_movement(
    p_movement_id UUID,
    p_movement_date DATE,
    p_term_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_term_file_path TEXT DEFAULT NULL,
    p_term_file_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'ti')) THEN
        RAISE EXCEPTION 'Sem permissão para editar movimentações.' USING ERRCODE = '42501';
    END IF;
    IF p_term_status NOT IN ('pendente', 'assinado') THEN
        RAISE EXCEPTION 'Status de termo inválido.';
    END IF;
    IF p_movement_date IS NULL THEN
        RAISE EXCEPTION 'Informe a data da movimentação.';
    END IF;

    UPDATE public.asset_movements
       SET movement_date = p_movement_date,
           term_status = p_term_status::public.movement_term_status,
           notes = nullif(trim(coalesce(p_notes, '')), ''),
           -- PDF nulo = mantém o arquivo já anexado
           term_file_path = coalesce(nullif(p_term_file_path, ''), term_file_path),
           term_file_name = CASE WHEN coalesce(p_term_file_path, '') <> '' THEN p_term_file_name ELSE term_file_name END
     WHERE id = p_movement_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimentação não encontrada.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_asset_movement(UUID, DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_asset_movement(UUID, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;
