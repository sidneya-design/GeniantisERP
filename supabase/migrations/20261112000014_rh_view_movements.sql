-- RH: consulta Entregas & Devoluções e imprime os termos (sem registrar entregas).
-- Precisa ler as movimentações, os itens, os ativos ligados a elas, os PDFs dos
-- termos assinados e os modelos de termo. Pode ser rodada mais de uma vez.

DROP POLICY IF EXISTS "Leitura de movimentações por usuários autorizados" ON public.asset_movements;
CREATE POLICY "Leitura de movimentações por usuários autorizados"
    ON public.asset_movements FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh', 'financeiro', 'consulta'));

DROP POLICY IF EXISTS "Leitura de itens de movimentações por usuários autorizados" ON public.asset_movement_items;
CREATE POLICY "Leitura de itens de movimentações por usuários autorizados"
    ON public.asset_movement_items FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh', 'financeiro', 'consulta'));

-- Ativos: só leitura (patrimônio e descrição aparecem nos termos)
DROP POLICY IF EXISTS "Leitura de ativos por usuários autorizados" ON public.assets;
CREATE POLICY "Leitura de ativos por usuários autorizados"
    ON public.assets FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh', 'financeiro', 'consulta'));

-- PDFs dos termos assinados: leitura (o envio continua com Admin, ADM e TI)
DROP POLICY IF EXISTS "Leitura de termos de ativos" ON storage.objects;
CREATE POLICY "Leitura de termos de ativos"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'asset-terms' AND (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh')));

-- Modelos de termo: leitura (edição continua só com o Admin)
DROP POLICY IF EXISTS "Modelos: leitura Admin ADM TI" ON public.document_templates;
DROP POLICY IF EXISTS "Modelos: leitura Admin ADM TI RH" ON public.document_templates;
CREATE POLICY "Modelos: leitura Admin ADM TI RH"
    ON public.document_templates FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'ti', 'rh'));
