-- Agenda compartilhada (como no Google Agenda):
--  * Cada usuário tem a sua agenda pessoal ("Minha agenda"), que só ele vê se não compartilhar.
--  * Qualquer pessoa com o módulo Agenda (Editar) cria agendas e compartilha com outros usuários:
--    1 = Ver, 2 = Editar eventos, 3 = Gerenciar (também muda nome, cor e quem participa).
--  * Agendas "abertas" (como a Geral) aparecem para todos com o módulo Agenda:
--    quem tem Agenda › Editar edita os eventos, quem tem Agenda › Ver só vê.
--  * Eventos podem ter usuários convidados: o evento aparece para o convidado, que responde Sim, Não ou Talvez.
--  * Atividades: itens da agenda com responsável e situação (Não iniciado, Fazendo, Finalizado).
--    O responsável vê a atividade e muda a situação mesmo sem acesso à agenda onde ela está.
--  * Os eventos criados antes desta migration vão para a agenda aberta "Geral".
-- Rode DEPOIS da 20261123000041_agenda.sql. Pode ser rodada mais de uma vez.

-- 1. Agendas
CREATE TABLE IF NOT EXISTS public.agenda_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    color VARCHAR(20) NOT NULL DEFAULT 'azul',
    -- Dono (nulo nas agendas do sistema, como a Geral)
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_personal BOOLEAN NOT NULL DEFAULT false,
    -- Aberta: todos com o módulo Agenda veem
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CHECK (NOT is_personal OR (owner_id IS NOT NULL AND NOT is_public))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_calendars_personal ON public.agenda_calendars (owner_id) WHERE is_personal;

CREATE TABLE IF NOT EXISTS public.agenda_calendar_members (
    calendar_id UUID NOT NULL REFERENCES public.agenda_calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (calendar_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agenda_members_user ON public.agenda_calendar_members (user_id);

-- 2. Eventos passam a pertencer a uma agenda; a cor vazia usa a cor da agenda
ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES public.agenda_calendars(id) ON DELETE CASCADE;
ALTER TABLE public.agenda_events ALTER COLUMN color DROP NOT NULL;
ALTER TABLE public.agenda_events ALTER COLUMN color DROP DEFAULT;

INSERT INTO public.agenda_calendars (name, description, color, is_public)
SELECT 'Geral', 'Agenda aberta para todos com acesso à Agenda', 'azul', true
WHERE NOT EXISTS (SELECT 1 FROM public.agenda_calendars WHERE owner_id IS NULL AND is_public AND name = 'Geral');

UPDATE public.agenda_events
   SET calendar_id = (SELECT id FROM public.agenda_calendars WHERE owner_id IS NULL AND is_public AND name = 'Geral' ORDER BY created_at LIMIT 1)
 WHERE calendar_id IS NULL;
ALTER TABLE public.agenda_events ALTER COLUMN calendar_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agenda_events_calendar ON public.agenda_events (calendar_id);

-- Atividades
ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'evento';
ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS status VARCHAR(12);
ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_kind_check;
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_kind_check CHECK (
    (kind = 'evento' AND status IS NULL)
    OR (kind = 'atividade' AND status IN ('nao_iniciado', 'fazendo', 'finalizado') AND recurrence = 'nenhuma')
);
CREATE INDEX IF NOT EXISTS idx_agenda_events_assignee ON public.agenda_events (assignee_id) WHERE kind = 'atividade';

-- Data de conclusão acompanha a situação
CREATE OR REPLACE FUNCTION public.agenda_events_status_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.kind = 'atividade' AND NEW.status = 'finalizado' THEN
        IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'finalizado' THEN
            NEW.completed_at := TIMEZONE('utc', NOW());
        END IF;
    ELSE
        NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agenda_events_status ON public.agenda_events;
CREATE TRIGGER trg_agenda_events_status BEFORE INSERT OR UPDATE ON public.agenda_events
    FOR EACH ROW EXECUTE FUNCTION public.agenda_events_status_touch();

-- 3. Convidados
CREATE TABLE IF NOT EXISTS public.agenda_event_guests (
    event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    response VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (response IN ('pendente', 'sim', 'nao', 'talvez')),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_agenda_guests_user ON public.agenda_event_guests (user_id);

-- 4. Nível da pessoa logada numa agenda (0 = sem acesso)
CREATE OR REPLACE FUNCTION public.agenda_calendar_level(p_calendar UUID)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    c public.agenda_calendars;
    v_member SMALLINT;
    v_module SMALLINT := public.module_level('agenda');
BEGIN
    IF auth.uid() IS NULL OR v_module < 1 THEN
        RETURN 0;
    END IF;
    SELECT * INTO c FROM public.agenda_calendars WHERE id = p_calendar;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    IF c.owner_id = auth.uid() THEN
        RETURN 3;
    END IF;
    -- Agenda pessoal de outra pessoa: só com compartilhamento (nem o Admin vê)
    SELECT level INTO v_member FROM public.agenda_calendar_members WHERE calendar_id = p_calendar AND user_id = auth.uid();
    IF c.is_personal THEN
        RETURN COALESCE(v_member, 0);
    END IF;
    IF public.is_admin() THEN
        RETURN 3;
    END IF;
    IF c.is_public THEN
        RETURN GREATEST(COALESCE(v_member, 0), LEAST(v_module, 2));
    END IF;
    RETURN COALESCE(v_member, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_calendar_level(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_calendar_level(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.agenda_event_level(p_event UUID)
RETURNS SMALLINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((SELECT public.agenda_calendar_level(e.calendar_id) FROM public.agenda_events e WHERE e.id = p_event), 0)::SMALLINT;
$$;
REVOKE ALL ON FUNCTION public.agenda_event_level(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_event_level(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.agenda_is_guest(p_event UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.module_level('agenda') >= 1
       AND EXISTS (SELECT 1 FROM public.agenda_event_guests WHERE event_id = p_event AND user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.agenda_is_guest(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_is_guest(UUID) TO authenticated;

-- 5. Funções usadas pela tela
-- Cria a agenda pessoal na primeira visita
CREATE OR REPLACE FUNCTION public.agenda_ensure_personal()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_name TEXT;
BEGIN
    IF auth.uid() IS NULL OR public.module_level('agenda') < 1 THEN
        RETURN NULL;
    END IF;
    SELECT id INTO v_id FROM public.agenda_calendars WHERE owner_id = auth.uid() AND is_personal;
    IF FOUND THEN
        RETURN v_id;
    END IF;
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Minha agenda') INTO v_name FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.agenda_calendars (name, color, owner_id, is_personal)
    VALUES (LEFT(COALESCE(v_name, 'Minha agenda'), 120), 'azul', auth.uid(), true)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        SELECT id INTO v_id FROM public.agenda_calendars WHERE owner_id = auth.uid() AND is_personal;
    END IF;
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_ensure_personal() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_ensure_personal() TO authenticated;

-- Agendas que a pessoa vê, com o nível dela
CREATE OR REPLACE FUNCTION public.agenda_my_calendars()
RETURNS TABLE (
    id UUID, name VARCHAR, description TEXT, color VARCHAR, owner_id UUID, owner_name TEXT,
    is_personal BOOLEAN, is_public BOOLEAN, level SMALLINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT c.id, c.name, c.description, c.color, c.owner_id, p.full_name::TEXT,
           c.is_personal, c.is_public, public.agenda_calendar_level(c.id)
      FROM public.agenda_calendars c
      LEFT JOIN public.profiles p ON p.id = c.owner_id
     WHERE public.agenda_calendar_level(c.id) >= 1
     ORDER BY COALESCE(c.owner_id = auth.uid() AND c.is_personal, false) DESC,
              COALESCE(c.owner_id = auth.uid(), false) DESC, c.is_public DESC, c.name;
$$;
REVOKE ALL ON FUNCTION public.agenda_my_calendars() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_my_calendars() TO authenticated;

-- Usuários ativos, para compartilhar e convidar (só nome e e-mail)
CREATE OR REPLACE FUNCTION public.agenda_users()
RETURNS TABLE (id UUID, full_name TEXT, email TEXT, avatar_url TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.id, p.full_name::TEXT, p.email::TEXT, p.avatar_url::TEXT
      FROM public.profiles p
     WHERE p.is_active = true
       AND public.module_level('agenda') >= 1
     ORDER BY p.full_name;
$$;
REVOKE ALL ON FUNCTION public.agenda_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_users() TO authenticated;

-- Responsável ou quem edita a agenda muda a situação da atividade
CREATE OR REPLACE FUNCTION public.agenda_set_status(p_event UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    e public.agenda_events;
BEGIN
    IF p_status NOT IN ('nao_iniciado', 'fazendo', 'finalizado') THEN
        RAISE EXCEPTION 'Situação inválida.';
    END IF;
    SELECT * INTO e FROM public.agenda_events WHERE id = p_event;
    IF NOT FOUND OR e.kind <> 'atividade' THEN
        RAISE EXCEPTION 'Atividade não encontrada.';
    END IF;
    IF public.module_level('agenda') < 1
       OR NOT (e.assignee_id = auth.uid() OR public.agenda_calendar_level(e.calendar_id) >= 2) THEN
        RAISE EXCEPTION 'Só o responsável ou quem edita a agenda muda a situação.';
    END IF;
    UPDATE public.agenda_events SET status = p_status WHERE id = p_event;
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_set_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_set_status(UUID, TEXT) TO authenticated;

-- Convidado responde (vale para todas as repetições)
CREATE OR REPLACE FUNCTION public.agenda_respond(p_event UUID, p_response TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_response NOT IN ('sim', 'nao', 'talvez') THEN
        RAISE EXCEPTION 'Resposta inválida.';
    END IF;
    UPDATE public.agenda_event_guests
       SET response = p_response, responded_at = TIMEZONE('utc', NOW())
     WHERE event_id = p_event AND user_id = auth.uid();
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Você não é convidado deste evento.';
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_respond(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_respond(UUID, TEXT) TO authenticated;

-- 6. Regras de acesso: agendas
ALTER TABLE public.agenda_calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agendas: leitura" ON public.agenda_calendars;
CREATE POLICY "Agendas: leitura" ON public.agenda_calendars FOR SELECT TO authenticated
    USING (public.agenda_calendar_level(id) >= 1);
-- Cria agendas compartilhadas (a pessoal é criada pela função). Agenda aberta: só quem tem Agenda › Excluir
DROP POLICY IF EXISTS "Agendas: inclusão" ON public.agenda_calendars;
CREATE POLICY "Agendas: inclusão" ON public.agenda_calendars FOR INSERT TO authenticated
    WITH CHECK (public.has_module('agenda', 2) AND owner_id = auth.uid() AND NOT is_personal
                AND (NOT is_public OR public.has_module('agenda', 3)));
DROP POLICY IF EXISTS "Agendas: alteração" ON public.agenda_calendars;
CREATE POLICY "Agendas: alteração" ON public.agenda_calendars FOR UPDATE TO authenticated
    USING (public.agenda_calendar_level(id) >= 3)
    WITH CHECK (public.agenda_calendar_level(id) >= 3 AND (NOT is_public OR public.has_module('agenda', 3)));
DROP POLICY IF EXISTS "Agendas: exclusão" ON public.agenda_calendars;
CREATE POLICY "Agendas: exclusão" ON public.agenda_calendars FOR DELETE TO authenticated
    USING (NOT is_personal AND (owner_id = auth.uid() OR public.is_admin()));

-- Dono, pessoal e aberta não mudam pela tela
CREATE OR REPLACE FUNCTION public.agenda_calendars_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.owner_id := OLD.owner_id;
    NEW.is_personal := OLD.is_personal;
    IF OLD.is_personal THEN
        NEW.is_public := false;
    END IF;
    NEW.updated_at := TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agenda_calendars_guard ON public.agenda_calendars;
CREATE TRIGGER trg_agenda_calendars_guard BEFORE UPDATE ON public.agenda_calendars
    FOR EACH ROW EXECUTE FUNCTION public.agenda_calendars_guard();

-- 7. Regras de acesso: quem participa de cada agenda
ALTER TABLE public.agenda_calendar_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membros: leitura" ON public.agenda_calendar_members;
CREATE POLICY "Membros: leitura" ON public.agenda_calendar_members FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.agenda_calendar_level(calendar_id) >= 1);
DROP POLICY IF EXISTS "Membros: inclusão" ON public.agenda_calendar_members;
CREATE POLICY "Membros: inclusão" ON public.agenda_calendar_members FOR INSERT TO authenticated
    WITH CHECK (public.agenda_calendar_level(calendar_id) >= 3
                AND user_id <> COALESCE((SELECT owner_id FROM public.agenda_calendars WHERE id = calendar_id), '00000000-0000-0000-0000-000000000000'::uuid));
DROP POLICY IF EXISTS "Membros: alteração" ON public.agenda_calendar_members;
CREATE POLICY "Membros: alteração" ON public.agenda_calendar_members FOR UPDATE TO authenticated
    USING (public.agenda_calendar_level(calendar_id) >= 3)
    WITH CHECK (public.agenda_calendar_level(calendar_id) >= 3);
-- Quem gerencia remove pessoas; cada um pode sair de uma agenda
DROP POLICY IF EXISTS "Membros: exclusão" ON public.agenda_calendar_members;
CREATE POLICY "Membros: exclusão" ON public.agenda_calendar_members FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.agenda_calendar_level(calendar_id) >= 3);

-- 8. Regras de acesso: eventos (pela agenda; convidado também vê)
DROP POLICY IF EXISTS "Agenda: leitura" ON public.agenda_events;
CREATE POLICY "Agenda: leitura" ON public.agenda_events FOR SELECT TO authenticated
    USING (public.agenda_calendar_level(calendar_id) >= 1 OR public.agenda_is_guest(id)
           OR (assignee_id = auth.uid() AND public.module_level('agenda') >= 1));
DROP POLICY IF EXISTS "Agenda: inclusão" ON public.agenda_events;
CREATE POLICY "Agenda: inclusão" ON public.agenda_events FOR INSERT TO authenticated
    WITH CHECK (public.agenda_calendar_level(calendar_id) >= 2 AND created_by = auth.uid());
DROP POLICY IF EXISTS "Agenda: alteração" ON public.agenda_events;
CREATE POLICY "Agenda: alteração" ON public.agenda_events FOR UPDATE TO authenticated
    USING (public.agenda_calendar_level(calendar_id) >= 2)
    WITH CHECK (public.agenda_calendar_level(calendar_id) >= 2);
DROP POLICY IF EXISTS "Agenda: exclusão" ON public.agenda_events;
CREATE POLICY "Agenda: exclusão" ON public.agenda_events FOR DELETE TO authenticated
    USING (public.agenda_calendar_level(calendar_id) >= 2);

-- 9. Regras de acesso: convidados (quem edita o evento convida; a resposta é pela função)
ALTER TABLE public.agenda_event_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Convidados: leitura" ON public.agenda_event_guests;
CREATE POLICY "Convidados: leitura" ON public.agenda_event_guests FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.agenda_event_level(event_id) >= 1 OR public.agenda_is_guest(event_id));
DROP POLICY IF EXISTS "Convidados: inclusão" ON public.agenda_event_guests;
CREATE POLICY "Convidados: inclusão" ON public.agenda_event_guests FOR INSERT TO authenticated
    WITH CHECK (public.agenda_event_level(event_id) >= 2 AND response = 'pendente');
DROP POLICY IF EXISTS "Convidados: exclusão" ON public.agenda_event_guests;
CREATE POLICY "Convidados: exclusão" ON public.agenda_event_guests FOR DELETE TO authenticated
    USING (public.agenda_event_level(event_id) >= 2);

-- 10. Log de atividade
DROP TRIGGER IF EXISTS trg_audit_agenda_calendars ON public.agenda_calendars;
CREATE TRIGGER trg_audit_agenda_calendars AFTER INSERT OR UPDATE OR DELETE ON public.agenda_calendars
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
DROP TRIGGER IF EXISTS trg_audit_agenda_members ON public.agenda_calendar_members;
CREATE TRIGGER trg_audit_agenda_members AFTER INSERT OR UPDATE OR DELETE ON public.agenda_calendar_members
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
