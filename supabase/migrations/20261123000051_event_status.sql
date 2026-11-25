-- Agenda: situação (Não iniciado, Fazendo, Finalizado) também nos eventos, não só nas atividades.
--  * Eventos existentes começam como "Não iniciado".
--  * Evento que se repete: cada repetição tem a própria situação (mesma tabela das atividades).
--  * Quem muda: quem edita a agenda do evento (e o responsável, nas atividades).
--  * Lembrete não é enviado para o que já está Finalizado.
-- Rode depois da 20261123000050. Pode ser rodada mais de uma vez.

-- Primeiro tira a regra antiga (evento sem situação), depois preenche e cria a nova
ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_kind_check;
UPDATE public.agenda_events SET status = 'nao_iniciado' WHERE status IS NULL;
ALTER TABLE public.agenda_events ALTER COLUMN status SET DEFAULT 'nao_iniciado';
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_kind_check CHECK (
    kind IN ('evento', 'atividade') AND status IN ('nao_iniciado', 'fazendo', 'finalizado')
);

-- Data de conclusão vale para eventos e atividades
CREATE OR REPLACE FUNCTION public.agenda_events_status_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'finalizado' THEN
        IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'finalizado' THEN
            NEW.completed_at := TIMEZONE('utc', NOW());
        END IF;
    ELSE
        NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

-- Mudar a situação de evento ou atividade (com data = só aquela repetição)
CREATE OR REPLACE FUNCTION public.agenda_set_status(p_event UUID, p_status TEXT, p_date DATE DEFAULT NULL)
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
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item da agenda não encontrado.';
    END IF;
    IF public.module_level('agenda') < 1
       OR NOT ((e.kind = 'atividade' AND e.assignee_id = auth.uid()) OR public.agenda_calendar_level(e.calendar_id) >= 2) THEN
        RAISE EXCEPTION 'Só quem edita a agenda (ou o responsável pela atividade) muda a situação.';
    END IF;

    IF e.recurrence <> 'nenhuma' THEN
        IF p_date IS NULL THEN
            RAISE EXCEPTION 'Informe o dia da repetição.';
        END IF;
        IF p_date < e.start_date OR (e.recurrence_until IS NOT NULL AND p_date > e.recurrence_until) THEN
            RAISE EXCEPTION 'Esse dia está fora da repetição.';
        END IF;
        IF p_status = 'nao_iniciado' THEN
            DELETE FROM public.agenda_task_occurrences WHERE event_id = p_event AND occurrence_date = p_date;
        ELSE
            INSERT INTO public.agenda_task_occurrences (event_id, occurrence_date, status, completed_at, updated_by, updated_at)
            VALUES (p_event, p_date, p_status, CASE WHEN p_status = 'finalizado' THEN TIMEZONE('utc', NOW()) END, auth.uid(), TIMEZONE('utc', NOW()))
            ON CONFLICT (event_id, occurrence_date) DO UPDATE
               SET status = EXCLUDED.status,
                   completed_at = CASE WHEN EXCLUDED.status = 'finalizado'
                                       THEN COALESCE(public.agenda_task_occurrences.completed_at, EXCLUDED.completed_at) END,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = EXCLUDED.updated_at;
        END IF;
    ELSE
        UPDATE public.agenda_events SET status = p_status WHERE id = p_event;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.agenda_set_status(UUID, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_set_status(UUID, TEXT, DATE) TO authenticated;
