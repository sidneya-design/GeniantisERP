-- PDFs de notas fiscais vinculados aos chamados de manutenção.

ALTER TABLE public.maintenance_orders
    ADD COLUMN IF NOT EXISTS invoice_file_path TEXT,
    ADD COLUMN IF NOT EXISTS invoice_file_name VARCHAR(255);

INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-invoices', 'maintenance-invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Leitura de notas fiscais de manutenção"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'maintenance-invoices');

DROP POLICY IF EXISTS "Envio de notas fiscais de manutenção" ON storage.objects;
CREATE POLICY "Envio de notas fiscais de manutenção"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'maintenance-invoices');

CREATE OR REPLACE FUNCTION public.register_maintenance(
    p_asset_id UUID,
    p_issue TEXT,
    p_opened_at DATE,
    p_forecast_date DATE DEFAULT NULL,
    p_provider TEXT DEFAULT NULL,
    p_cost NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_invoice_file_path TEXT DEFAULT NULL,
    p_invoice_file_name TEXT DEFAULT NULL
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
    SELECT assigned_employee_id INTO v_assigned
    FROM public.assets
    WHERE id = p_asset_id AND status NOT IN ('baixado', 'em_manutencao')
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ativo não encontrado ou indisponível para manutenção.'; END IF;

    INSERT INTO public.maintenance_orders (asset_id, issue, opened_at, forecast_date, provider, cost, notes, invoice_file_path, invoice_file_name, custody_note)
    VALUES (p_asset_id, p_issue, COALESCE(p_opened_at, CURRENT_DATE), p_forecast_date, p_provider, p_cost, p_notes, p_invoice_file_path, p_invoice_file_name, CASE WHEN v_assigned IS NULL THEN 'Equipamento retirado do estoque para manutenção.' ELSE 'Vínculo com o responsável preservado durante o reparo.' END)
    RETURNING id INTO v_id;

    UPDATE public.assets SET status = 'em_manutencao', updated_at = TIMEZONE('utc', NOW()) WHERE id = p_asset_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_maintenance(UUID, TEXT, DATE, DATE, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
