-- Relatórios › Envios de aniversário: ADM e RH (que cuidam dos aniversariantes)
-- passam a ler só os registros de envio de e-mail de aniversário do log.
-- O restante do log continua só para o Admin. Pode ser rodada mais de uma vez.

DROP POLICY IF EXISTS "ADM e RH leem envios de aniversário" ON public.audit_logs;
CREATE POLICY "ADM e RH leem envios de aniversário"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (entity = 'aniversarios' AND public.current_user_role() IN ('adm', 'rh'));
