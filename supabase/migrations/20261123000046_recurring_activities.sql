-- Atividades que se repetem (todos os dias, semanal, quinzenal, mensal, anual).
--  * Nova repetição "quinzenal" (a cada 2 semanas), para eventos e atividades.
--  * Cada ocorrência de uma atividade que se repete tem a própria situação
--    (Não iniciado, Fazendo, Finalizado), guardada em agenda_task_occurrences.
--    Sem linha = Não iniciado. Atividades sem repetição continuam usando a situação do próprio item.
-- Rode depois da 20261123000045. Pode ser rodada mais de uma vez.

-- 1. Repetição quinzenal
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remove a regra antiga de repetição (criada sem nome na 041)
    FOR r IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'public.agenda_events'::regclass AND contype = 'c'
           AND pg_get_constraintdef(oid) ILIKE '%recurrence%' AND pg_get_constraintdef(oid) ILIKE '%anual%'
           AND conname <> 'agenda_events_kind_check'
    LOOP
        EXECUTE format('ALTER TABLE public.agenda_events DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_recurrence_check;
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_recurrence_check
    CHECK (recurrence IN ('nenhuma', 'diaria', 'semanal', 'quinzenal', 'mensal', 'anual'));

-- 2. Atividade pode se repetir
ALTER TABLE public.agenda_events DROP CONSTRAINT IF EXISTS agenda_events_kind_check;
ALTER TABLE public.agenda_events ADD CONSTRAINT agenda_events_kind_check CHECK (
    (kind = 'evento' AND status IS NULL)
    OR (kind = 'atividade' AND status IN ('nao_iniciado', 'fazendo', 'finalizado'))
);

-- 3. Situação de cada ocorrência
CREATE TABLE IF NOT EXISTS public.agenda_task_occurrences (
    event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    status VARCHAR(12) NOT NULL CHECK (status IN ('nao_iniciado', 'fazendo', 'finalizado')),
    completed_at TIMESTAMPTZ,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (event_id, occurrence_date)
);
CREATE INDEX IF NOT EXISTS idx_agenda_occ_date ON public.agenda_task_occurrences (occurrence_date);

-- Quem vê o item vê a situação das ocorrências
CREATE OR REPLACE FUNCTION public.agenda_can_see_event(p_event UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.module_level('agenda') >= 1 AND EXISTS (
        SELECT 1 FROM public.agenda_events e
         WHERE e.id = p_event
           AND (public.agenda_calendar_level(e.calendar_id) >= 1
                OR e.assignee_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.agenda_event_guests g WHERE g.event_id = e.id AND g.user_id = auth.uid()))
    );
$$;
REVOKE ALL ON FUNCTION public.agenda_can_see_event(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_can_see_event(UUID) TO authenticated;

ALTER TABLE public.agenda_task_occurrences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ocorrências: leitura" ON public.agenda_task_occurrences;
CREATE POLICY "Ocorrências: leitura" ON public.agenda_task_occurrences FOR SELECT TO authenticated
    USING (public.agenda_can_see_event(event_id));
-- Gravação só pela função abaixo

-- 4. Mudar a situação: com data = só aquela ocorrência (atividade que se repete)
DROP FUNCTION IF EXISTS public.agenda_set_status(UUID, TEXT);
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
    IF NOT FOUND OR e.kind <> 'atividade' THEN
        RAISE EXCEPTION 'Atividade não encontrada.';
    END IF;
    IF public.module_level('agenda') < 1
       OR NOT (e.assignee_id = auth.uid() OR public.agenda_calendar_level(e.calendar_id) >= 2) THEN
        RAISE EXCEPTION 'Só o responsável ou quem edita a agenda muda a situação.';
    END IF;

    IF e.recurrence <> 'nenhuma' THEN
        IF p_date IS NULL THEN
            RAISE EXCEPTION 'Informe o dia da ocorrência.';
        END IF;
        IF p_date < e.start_date OR (e.recurrence_until IS NOT NULL AND p_date > e.recurrence_until) THEN
            RAISE EXCEPTION 'Esse dia está fora da repetição da atividade.';
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
