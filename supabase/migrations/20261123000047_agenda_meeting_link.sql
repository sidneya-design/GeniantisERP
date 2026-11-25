-- Agenda: link de videochamada (Google Meet, Zoom, Teams...) no evento.
-- O aviso de convite (sino e e-mail) passa a levar o link da reunião.
-- Rode depois da 20261123000046. Pode ser rodada mais de uma vez.

ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_meeting_url_check;
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_meeting_url_check
    CHECK (meeting_url IS NULL OR (meeting_url ~* '^https://' AND length(meeting_url) <= 500));

-- Convite com o link da reunião
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
            || '. Responda Sim, Não ou Talvez na Agenda.'
            || CASE WHEN e.meeting_url IS NOT NULL THEN E'\nVideochamada: ' || e.meeting_url ELSE '' END,
        '/agenda?data=' || to_char(e.start_date, 'YYYY-MM-DD')
    );
    RETURN NEW;
END;
$$;
