-- Agenda: correções de permissão nas agendas (23/11/2026).
-- 1. A agenda nova já nasce com o dono = quem criou (a tela não precisava mandar).
-- 2. Quem gerencia uma agenda aberta (como a Geral) sem ser Admin consegue mudar nome, cor
--    e descrição; só não muda se ela é aberta ou não (isso continua com Agenda › Excluir).
-- Rode depois da 20261123000042_agenda_sharing.sql. Pode ser rodada mais de uma vez.

ALTER TABLE public.agenda_calendars ALTER COLUMN owner_id SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.agenda_calendars_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.owner_id := OLD.owner_id;
    NEW.is_personal := OLD.is_personal;
    IF OLD.is_personal OR NOT public.has_module('agenda', 3) THEN
        NEW.is_public := OLD.is_public;
    END IF;
    IF OLD.is_personal THEN
        NEW.is_public := false;
    END IF;
    NEW.updated_at := TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Agendas: alteração" ON public.agenda_calendars;
CREATE POLICY "Agendas: alteração" ON public.agenda_calendars FOR UPDATE TO authenticated
    USING (public.agenda_calendar_level(id) >= 3)
    WITH CHECK (public.agenda_calendar_level(id) >= 3);
