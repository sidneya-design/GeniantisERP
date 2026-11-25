-- Agenda: cada usuário pode desligar os avisos de atividades (sino e e-mail).
--  * notify_activities = false: não recebe aviso quando for colocado como responsável
--    por uma atividade, nem os lembretes de atividades. Eventos continuam avisando.
--  * Os lembretes são filtrados pela função da Netlify "agenda-reminders".
--  * muted = true numa atividade: ninguém recebe aviso dela (quem cria marca "Não notificar").
-- Rode depois da 20261123000051. Pode ser rodada mais de uma vez.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_activities BOOLEAN NOT NULL DEFAULT true;

-- Atividade silenciosa: quem cria marca "Não notificar" (sem aviso ao responsável; o lembrete
-- fica desligado pela tela). Vale para todos os envolvidos nessa atividade.
ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.agenda_notify_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.kind <> 'atividade' OR NEW.assignee_id IS NULL OR NEW.muted THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
        RETURN NEW;
    END IF;
    -- Quem desligou os avisos de atividades não recebe
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.assignee_id AND notify_activities = false) THEN
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
