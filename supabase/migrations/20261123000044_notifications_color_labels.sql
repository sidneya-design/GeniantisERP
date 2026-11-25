-- Avisos (sino do ERP + e-mail) e etiquetas de cor da agenda.
--  * O banco cria o aviso sozinho quando alguém:
--      - compartilha uma agenda com você (ou muda seu nível);
--      - convida você para um evento;
--      - coloca você como responsável por uma atividade.
--    Ninguém recebe aviso da própria ação.
--  * O e-mail é enviado pela função da Netlify (send-email › agenda_notify), que só manda os
--    avisos pendentes criados pela pessoa que chamou. Cada usuário pode desligar os e-mails.
--  * Etiquetas de cor: nome para uma cor (ex.: ADM = verde, Fin = azul), iguais para todos.
--    Quem tem Agenda › Editar cria e altera; servem para filtrar a agenda.
-- Rode depois da 20261123000043_agenda_calendar_fixes.sql. Pode ser rodada mais de uma vez.

-- 1. Preferência de e-mail de cada usuário
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT true;

-- 2. Avisos
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    kind VARCHAR(30) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    read_at TIMESTAMPTZ,
    -- pendente: falta enviar · enviado · falhou · nao_envia (pessoa desligou os e-mails)
    email_status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (email_status IN ('pendente', 'enviado', 'falhou', 'nao_envia')),
    emailed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_pending ON public.notifications (actor_id, created_at) WHERE email_status = 'pendente';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Avisos: leitura própria" ON public.notifications;
CREATE POLICY "Avisos: leitura própria" ON public.notifications FOR SELECT TO authenticated
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Avisos: exclusão própria" ON public.notifications;
CREATE POLICY "Avisos: exclusão própria" ON public.notifications FOR DELETE TO authenticated
    USING (user_id = auth.uid());
-- Inclusão e alteração só pelas funções abaixo (sem regra de INSERT/UPDATE para o navegador)

-- Marca como lido (sem ids = todos)
CREATE OR REPLACE FUNCTION public.notifications_mark_read(p_ids UUID[] DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.notifications SET read_at = TIMEZONE('utc', NOW())
     WHERE user_id = auth.uid() AND read_at IS NULL AND (p_ids IS NULL OR id = ANY (p_ids));
$$;
REVOKE ALL ON FUNCTION public.notifications_mark_read(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notifications_mark_read(UUID[]) TO authenticated;

-- Cria um aviso (usada pelos gatilhos)
CREATE OR REPLACE FUNCTION public.notify_user(p_user UUID, p_kind TEXT, p_title TEXT, p_body TEXT, p_link TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email BOOLEAN;
BEGIN
    IF p_user IS NULL OR p_user = auth.uid() THEN
        RETURN;
    END IF;
    SELECT notify_email AND is_active INTO v_email FROM public.profiles WHERE id = p_user;
    IF NOT FOUND THEN
        RETURN;
    END IF;
    INSERT INTO public.notifications (user_id, actor_id, kind, title, body, link, email_status)
    VALUES (p_user, auth.uid(), p_kind, LEFT(p_title, 300), LEFT(p_body, 1000), p_link,
            CASE WHEN COALESCE(v_email, false) THEN 'pendente' ELSE 'nao_envia' END);
END;
$$;
REVOKE ALL ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.actor_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Alguém') FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.actor_name() FROM PUBLIC, anon, authenticated;

-- Quando: "seg, 24/11/2026 às 09:00" ou "24/11/2026"
CREATE OR REPLACE FUNCTION public.agenda_when(p_date DATE, p_time TIME)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT to_char(p_date, 'DD/MM/YYYY') || CASE WHEN p_time IS NULL THEN '' ELSE ' às ' || to_char(p_time, 'HH24:MI') END;
$$;

-- 3. Gatilhos da agenda
CREATE OR REPLACE FUNCTION public.agenda_notify_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cal TEXT;
    v_level TEXT := CASE NEW.level WHEN 1 THEN 'Ver eventos' WHEN 2 THEN 'Editar eventos' ELSE 'Gerenciar agenda' END;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.level = NEW.level THEN
        RETURN NEW;
    END IF;
    SELECT name INTO v_cal FROM public.agenda_calendars WHERE id = NEW.calendar_id;
    PERFORM public.notify_user(
        NEW.user_id, 'agenda_share',
        CASE WHEN TG_OP = 'INSERT'
             THEN public.actor_name() || ' compartilhou a agenda "' || COALESCE(v_cal, '') || '" com você'
             ELSE public.actor_name() || ' mudou seu acesso à agenda "' || COALESCE(v_cal, '') || '"' END,
        'Seu acesso: ' || v_level || '.',
        '/agenda'
    );
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agenda_notify_member ON public.agenda_calendar_members;
CREATE TRIGGER trg_agenda_notify_member AFTER INSERT OR UPDATE ON public.agenda_calendar_members
    FOR EACH ROW EXECUTE FUNCTION public.agenda_notify_member();

CREATE OR REPLACE FUNCTION public.agenda_notify_guest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    e public.agenda_events;
BEGIN
    SELECT * INTO e FROM public.agenda_events WHERE id = NEW.event_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    PERFORM public.notify_user(
        NEW.user_id, 'agenda_invite',
        public.actor_name() || ' convidou você: ' || e.title,
        public.agenda_when(e.start_date, e.start_time)
            || CASE WHEN e.location IS NOT NULL THEN ' · ' || e.location ELSE '' END
            || '. Responda Sim, Não ou Talvez na Agenda.',
        '/agenda?data=' || to_char(e.start_date, 'YYYY-MM-DD')
    );
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agenda_notify_guest ON public.agenda_event_guests;
CREATE TRIGGER trg_agenda_notify_guest AFTER INSERT ON public.agenda_event_guests
    FOR EACH ROW EXECUTE FUNCTION public.agenda_notify_guest();

CREATE OR REPLACE FUNCTION public.agenda_notify_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.kind <> 'atividade' OR NEW.assignee_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
        RETURN NEW;
    END IF;
    PERFORM public.notify_user(
        NEW.assignee_id, 'agenda_assign',
        public.actor_name() || ' colocou você como responsável: ' || NEW.title,
        'Prazo: ' || public.agenda_when(NEW.start_date, NEW.start_time) || '.',
        '/agenda?visao=atividades'
    );
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agenda_notify_assignee ON public.agenda_events;
CREATE TRIGGER trg_agenda_notify_assignee AFTER INSERT OR UPDATE OF assignee_id ON public.agenda_events
    FOR EACH ROW EXECUTE FUNCTION public.agenda_notify_assignee();

-- 4. Etiquetas de cor (nome de cada cor, iguais para todos)
CREATE TABLE IF NOT EXISTS public.agenda_color_labels (
    color VARCHAR(7) PRIMARY KEY CHECK (color ~ '^#[0-9a-f]{6}$'),
    name VARCHAR(40) NOT NULL CHECK (length(trim(name)) > 0),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.agenda_color_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Etiquetas: leitura" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: leitura" ON public.agenda_color_labels FOR SELECT TO authenticated
    USING (public.has_module('agenda', 1));
DROP POLICY IF EXISTS "Etiquetas: inclusão" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: inclusão" ON public.agenda_color_labels FOR INSERT TO authenticated
    WITH CHECK (public.has_module('agenda', 2));
DROP POLICY IF EXISTS "Etiquetas: alteração" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: alteração" ON public.agenda_color_labels FOR UPDATE TO authenticated
    USING (public.has_module('agenda', 2)) WITH CHECK (public.has_module('agenda', 2));
DROP POLICY IF EXISTS "Etiquetas: exclusão" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: exclusão" ON public.agenda_color_labels FOR DELETE TO authenticated
    USING (public.has_module('agenda', 2));

DROP TRIGGER IF EXISTS trg_audit_agenda_color_labels ON public.agenda_color_labels;
CREATE TRIGGER trg_audit_agenda_color_labels AFTER INSERT OR UPDATE OR DELETE ON public.agenda_color_labels
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
