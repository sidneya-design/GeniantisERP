-- Agenda: lembrete antes do evento ou do prazo da atividade.
--  * reminder_minutes: quantos minutos antes avisar (0 = na hora). Vazio = sem lembrete.
--    Evento de dia inteiro: conta a partir das 8h do dia.
--  * Quem recebe: quem criou, os convidados do ERP que não responderam "Não" e o responsável
--    pela atividade. Aviso no sino e e-mail (se a pessoa não desligou os e-mails).
--  * O envio é feito pela função agendada da Netlify "agenda-reminders" (a cada 5 minutos).
--    agenda_reminders_sent evita mandar o mesmo lembrete duas vezes.
--  * Convidados de fora do ERP recebem o lembrete dentro do arquivo do convite (.ics).
-- Rode depois da 20261123000048. Pode ser rodada mais de uma vez.

ALTER TABLE public.agenda_events ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER;
ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_reminder_check;
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_reminder_check
    CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 10080);
CREATE INDEX IF NOT EXISTS idx_agenda_events_reminder ON public.agenda_events (start_date) WHERE reminder_minutes IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agenda_reminders_sent (
    event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (event_id, occurrence_date, user_id)
);
-- Só o servidor usa esta tabela (sem regras para o navegador)
ALTER TABLE public.agenda_reminders_sent ENABLE ROW LEVEL SECURITY;
