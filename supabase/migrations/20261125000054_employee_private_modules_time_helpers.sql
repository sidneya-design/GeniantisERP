-- Segurança: dados pessoais respeitam a permissão por módulo + funções internas do ponto fechadas.
-- Rode depois da 20261124000053. Pode ser rodada mais de uma vez.
--
-- 1. employee_private (CPF, endereço, contato de emergência, observações restritas)
--    Antes: só o perfil contava (Admin, ADM e RH leem; Admin e RH gravam). Se o Admin tirasse
--    o módulo de um usuário em Configurações, a tela escondia, mas o banco ainda liberava.
--    Agora: perfil E módulo. A regra só fica mais restrita, nunca mais aberta. Financeiro,
--    Consulta e TI continuam sem ver CPF, mesmo tendo o módulo Funcionários.
--      leitura   → Admin, ADM ou RH  E  (Funcionários, Termos ou Entregas ≥ 1)
--                  (são as telas que mostram o CPF: cadastro, termo de imagem, termo de entrega)
--      gravação  → Admin ou RH       E  Funcionários ≥ 2
--      exclusão  → Admin (igual a antes)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'employee_private'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.employee_private', r.policyname);
    END LOOP;
END $$;

ALTER TABLE public.employee_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dados pessoais: leitura" ON public.employee_private FOR SELECT TO authenticated
    USING (
        (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'))
        AND (public.has_module('employees', 1) OR public.has_module('documents', 1) OR public.has_module('movements', 1))
    );

CREATE POLICY "Dados pessoais: inclusão" ON public.employee_private FOR INSERT TO authenticated
    WITH CHECK ((public.is_admin() OR public.current_user_role() = 'rh') AND public.has_module('employees', 2));

CREATE POLICY "Dados pessoais: alteração" ON public.employee_private FOR UPDATE TO authenticated
    USING ((public.is_admin() OR public.current_user_role() = 'rh') AND public.has_module('employees', 2))
    WITH CHECK ((public.is_admin() OR public.current_user_role() = 'rh') AND public.has_module('employees', 2));

CREATE POLICY "Dados pessoais: exclusão" ON public.employee_private FOR DELETE TO authenticated
    USING (public.is_admin());

-- 2. Funções internas do ponto
--    time_effective_schedule(funcionário) e time_start_date(funcionário) não conferem quem chama:
--    qualquer usuário logado via a jornada e a data de início de qualquer funcionário pelo ID.
--    Elas só são usadas por dentro de time_daily, time_bank_balance e my_time_profile
--    (SECURITY DEFINER, que continuam funcionando). O navegador não chama nenhuma das duas.
--    Rodar a 20261124000053 de novo não reabre estas funções.
REVOKE ALL ON FUNCTION public.time_effective_schedule(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.time_start_date(UUID) FROM PUBLIC, anon, authenticated;

-- Conferência:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'employee_private';   -- 4 linhas
--   SELECT has_function_privilege('authenticated', 'public.time_start_date(uuid)', 'EXECUTE');          -- false
--   SELECT has_function_privilege('authenticated', 'public.time_effective_schedule(uuid)', 'EXECUTE');  -- false
