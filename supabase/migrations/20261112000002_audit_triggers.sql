-- Auditoria automática: cada inclusão, alteração e exclusão nas tabelas do ERP
-- grava em audit_logs quem fez, quando, em qual registro e o que mudou.
-- Os gatilhos rodam no banco, então nenhuma ação escapa do log (tela, API ou
-- funções RPC). O log é imutável: não há policy de UPDATE/DELETE.

-- 1. Colunas extras: identificação do autor congelada no momento da ação
--    e um resumo legível do registro afetado.
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity);

-- 2. Função de gatilho genérica
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_name TEXT;
    v_old JSONB;
    v_new JSONB;
    v_row JSONB;
    v_changes JSONB := '{}'::jsonb;
    v_key TEXT;
    v_ignored TEXT[] := ARRAY['created_at', 'updated_at'];
    v_action TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW); v_row := v_new; v_action := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_row := v_new; v_action := 'update';
        FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
            IF NOT (v_key = ANY (v_ignored)) AND (v_old -> v_key) IS DISTINCT FROM (v_new -> v_key) THEN
                v_changes := v_changes || jsonb_build_object(
                    v_key, jsonb_build_object('de', v_old -> v_key, 'para', v_new -> v_key));
            END IF;
        END LOOP;
        -- Alteração sem mudança real (só updated_at): não registra
        IF v_changes = '{}'::jsonb THEN
            RETURN NEW;
        END IF;
    ELSE
        v_old := to_jsonb(OLD); v_row := v_old; v_action := 'delete';
    END IF;

    IF v_uid IS NOT NULL THEN
        SELECT p.email, p.full_name INTO v_email, v_name FROM public.profiles p WHERE p.id = v_uid;
    END IF;

    INSERT INTO public.audit_logs (user_id, user_email, user_name, action, entity, entity_id, summary, details)
    VALUES (
        v_uid,
        COALESCE(v_email, CASE WHEN v_uid IS NULL THEN 'sistema' END),
        v_name,
        v_action,
        TG_TABLE_NAME,
        v_row ->> 'id',
        LEFT(COALESCE(
            v_row ->> 'service_name',
            v_row ->> 'full_name',
            v_row ->> 'patrimony',
            v_row ->> 'name',
            v_row ->> 'email',
            v_row ->> 'issue',
            v_row ->> 'id'
        ), 200),
        CASE v_action
            WHEN 'update' THEN jsonb_build_object('alteracoes', v_changes)
            WHEN 'create' THEN jsonb_build_object('registro', v_new - v_ignored)
            ELSE jsonb_build_object('registro', v_old - v_ignored)
        END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Liga o gatilho em todas as tabelas de negócio que existirem
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles', 'employees', 'departments', 'units',
        'assets', 'asset_movements', 'asset_movement_items', 'maintenance_orders',
        'subscriptions', 'subscription_assignments'
    ] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$I', t);
            EXECUTE format(
                'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
                 FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
        END IF;
    END LOOP;
END $$;

-- 4. Eventos de sessão (entrar/sair) são gravados pelo próprio app.
--    A policy original já permite inserir só com o próprio user_id; aqui
--    restringimos a ações de sessão para ninguém forjar outros registros.
DROP POLICY IF EXISTS "Qualquer autenticado insere auditoria" ON public.audit_logs;
DROP POLICY IF EXISTS "Usuário registra os próprios eventos de sessão" ON public.audit_logs;
CREATE POLICY "Usuário registra os próprios eventos de sessão"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid() AND action IN ('login', 'logout') AND entity = 'sessao');
