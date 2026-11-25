-- Nova situação de termo: "Não utiliza termo" (ex.: periféricos e mouse).
ALTER TYPE public.movement_term_status ADD VALUE IF NOT EXISTS 'nao_utiliza';

-- Registro: a função interna só aceita pendente/assinado, então grava como
-- pendente e ajusta a situação logo em seguida.
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

REVOKE ALL ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Edição: aceita a nova situação
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

REVOKE ALL ON FUNCTION public.update_asset_movement(UUID, DATE, TEXT, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_asset_movement(UUID, DATE, TEXT, TEXT, TEXT, TEXT, UUID[]) TO authenticated;
