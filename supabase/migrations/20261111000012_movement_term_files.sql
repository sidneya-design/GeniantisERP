-- Armazenamento dos PDFs de termos assinados.

ALTER TABLE public.asset_movements
    ADD COLUMN IF NOT EXISTS term_file_path TEXT,
    ADD COLUMN IF NOT EXISTS term_file_name VARCHAR(255);

INSERT INTO storage.buckets (id, name, public)
VALUES ('asset-terms', 'asset-terms', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura de termos de ativos" ON storage.objects;
CREATE POLICY "Leitura de termos de ativos"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'asset-terms');

DROP POLICY IF EXISTS "Envio de termos de ativos" ON storage.objects;
CREATE POLICY "Envio de termos de ativos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'asset-terms');

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
        IF EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND status = 'desligado') THEN
            RAISE EXCEPTION 'Não é possível entregar ativos a um funcionário desligado.';
        END IF;
        IF EXISTS (SELECT 1 FROM public.assets WHERE id = ANY(p_asset_ids) AND status <> 'disponivel') THEN
            RAISE EXCEPTION 'A entrega só pode utilizar ativos disponíveis.';
        END IF;
        IF p_term_status = 'assinado' AND p_term_file_path IS NULL THEN
            RAISE EXCEPTION 'O PDF do termo assinado é obrigatório.';
        END IF;
    ELSE
        IF EXISTS (SELECT 1 FROM public.assets WHERE id = ANY(p_asset_ids) AND (status <> 'em_uso' OR assigned_employee_id <> p_employee_id)) THEN
            RAISE EXCEPTION 'A devolução só pode utilizar ativos vinculados ao funcionário selecionado.';
        END IF;
    END IF;

    INSERT INTO public.asset_movements (employee_id, type, movement_date, term_status, notes, term_file_path, term_file_name, user_in_charge)
    VALUES (p_employee_id, p_type::public.movement_type, COALESCE(p_movement_date, CURRENT_DATE), p_term_status::public.movement_term_status, p_notes, p_term_file_path, p_term_file_name, auth.uid())
    RETURNING id INTO v_movement_id;

    FOREACH v_asset_id IN ARRAY p_asset_ids LOOP
        INSERT INTO public.asset_movement_items (movement_id, asset_id) VALUES (v_movement_id, v_asset_id);
    END LOOP;

    IF p_type = 'entrega' THEN
        UPDATE public.assets SET status = 'em_uso', assigned_employee_id = p_employee_id, updated_at = TIMEZONE('utc', NOW()) WHERE id = ANY(p_asset_ids);
    ELSE
        UPDATE public.assets SET status = 'disponivel', assigned_employee_id = NULL, updated_at = TIMEZONE('utc', NOW()) WHERE id = ANY(p_asset_ids);
    END IF;

    RETURN v_movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_asset_movement(UUID, TEXT, UUID[], DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
