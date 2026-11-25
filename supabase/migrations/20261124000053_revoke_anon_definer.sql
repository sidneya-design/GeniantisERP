-- Endurecimento: funções com privilégio elevado (SECURITY DEFINER) só para quem está logado.
--  * Antes, visitantes sem login (papel anon) podiam chamar essas funções pela API. Elas já
--    conferiam a permissão por dentro, então não vazavam dados; isto é uma camada a mais.
--  * Quem está logado (authenticated) e o servidor (service_role) continuam com o mesmo acesso
--    que tinham. Funções que já eram fechadas para authenticated (ex.: notify_user) continuam fechadas.
--  * Gatilhos não dependem desse acesso e continuam funcionando.
-- Rode depois da 20261124000052. Pode ser rodada mais de uma vez.

DO $$
DECLARE
    f RECORD;
    v_auth BOOLEAN;
    v_service BOOLEAN;
BEGIN
    FOR f IN
        SELECT p.oid, p.oid::regprocedure AS sig
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.prosecdef
    LOOP
        -- Guarda quem já podia chamar antes de tirar o acesso público
        v_auth := has_function_privilege('authenticated', f.oid, 'EXECUTE');
        v_service := has_function_privilege('service_role', f.oid, 'EXECUTE');

        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);

        IF v_auth THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
        END IF;
        IF v_service THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
        END IF;
    END LOOP;
END;
$$;

-- Funções criadas depois desta migration voltam a ficar abertas (padrão do Supabase):
-- rode esta migration de novo depois de criar funções SECURITY DEFINER.

-- Conferência (deve voltar vazio): funções SECURITY DEFINER que visitantes ainda conseguem chamar
-- SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE');
