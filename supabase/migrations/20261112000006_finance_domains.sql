-- Financeiro passa a incluir tudo que tem custo no ERP:
--  * domínios: renovações registradas (valor pago, no mês da renovação) e
--    domínios ativos ainda não renovados (custo previsto, no mês do vencimento)
--  * compras de ativos (custo de aquisição, no mês da aquisição)
-- Continua somente leitura e restrito a Admin, ADM e RH.

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
        ), '[]'::jsonb),
        'domains', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', d.id,
                'domain', d.domain,
                'registrar', d.registrar,
                'expiration_date', d.expiration_date,
                'renewal_cost', d.renewal_cost,
                'auto_renew', d.auto_renew
            ) ORDER BY d.expiration_date)
            FROM public.domains d
            WHERE d.status = 'ativo' AND d.expiration_date IS NOT NULL AND COALESCE(d.renewal_cost, 0) > 0
        ), '[]'::jsonb),
        'domain_renewals', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', r.id,
                'domain', d.domain,
                'registrar', d.registrar,
                'renewed_at', r.renewed_at,
                'new_expiration', r.new_expiration,
                'cost', r.cost
            ) ORDER BY r.renewed_at DESC)
            FROM public.domain_renewals r
            JOIN public.domains d ON d.id = r.domain_id
            WHERE COALESCE(r.cost, 0) > 0
        ), '[]'::jsonb),
        'asset_purchases', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'patrimony', a.patrimony,
                'equipment', COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.brand, a.model)), ''), a.category),
                'category', a.category,
                'acquisition_date', a.acquisition_date,
                'purchase_cost', a.purchase_cost
            ) ORDER BY a.acquisition_date DESC)
            FROM public.assets a
            WHERE a.acquisition_date IS NOT NULL AND COALESCE(a.purchase_cost, 0) > 0
        ), '[]'::jsonb)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_finance_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_data() TO authenticated;
