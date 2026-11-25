-- Dados do módulo Financeiro (somente leitura) para Admin, ADM e RH.
-- O RH precisa ver os custos sem ganhar acesso ao cadastro de ativos ou de
-- assinaturas: esta função devolve só os campos que a tela Financeiro usa.

CREATE OR REPLACE FUNCTION public.get_finance_data()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT (public.is_admin() OR public.current_user_role() IN ('adm', 'rh')) THEN
        RAISE EXCEPTION 'Sem permissão para ver o Financeiro.' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'subscriptions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'service_name', s.service_name,
                'provider', s.provider,
                'category', s.category,
                'periodicity', s.periodicity,
                'amount', s.amount,
                'total_licenses', s.total_licenses,
                'renewal_date', s.renewal_date,
                'billing_day', s.billing_day,
                'status', s.status
            ) ORDER BY s.service_name)
            FROM public.subscriptions s
        ), '[]'::jsonb),
        'maintenances', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', m.id,
                'patrimony', a.patrimony,
                'equipment', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.brand, a.model)), ''), a.category),
                'issue', m.issue,
                'provider', m.provider,
                'status', m.status,
                'opened_at', m.opened_at,
                'completed_at', m.completed_at,
                'cost', m.cost
            ) ORDER BY m.opened_at DESC)
            FROM public.maintenance_orders m
            LEFT JOIN public.assets a ON a.id = m.asset_id
            WHERE m.status <> 'cancelada' AND COALESCE(m.cost, 0) > 0
        ), '[]'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_finance_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_data() TO authenticated;
