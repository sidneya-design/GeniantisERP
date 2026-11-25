-- Segurança: só o Admin muda o cadastro de funcionário ligado ao usuário (employee_id) e o e-mail do perfil.
-- A regra "Usuário edita próprio nome" travava só perfil (role) e status; sem isto, um usuário
-- poderia se ligar ao cadastro de outra pessoa e bater/ver o ponto dela.
-- Chamadas sem usuário logado (chave de servidor das functions, SQL Editor) continuam liberadas.
-- Pode ser rodada mais de uma vez.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
        RAISE EXCEPTION 'Só o administrador pode mudar o cadastro de funcionário ligado ao usuário.' USING ERRCODE = '42501';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        RAISE EXCEPTION 'Só o administrador pode mudar o e-mail do usuário.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
