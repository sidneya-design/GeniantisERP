-- Agenda: eventos criados no ERP (reuniões, treinamentos, visitas, prazos, lembretes).
-- A tela também mostra, sem gravar nada aqui, as datas que já existem nos outros módulos:
-- vencimentos, aniversários, tempo de casa, feriados, férias e folgas, manutenções.
-- Cada pessoa só vê essas datas dos módulos que tem liberados.
-- Padrão: Admin exclui qualquer evento; ADM, TI e RH criam e editam (e excluem os que criaram).
-- Ajustável por pessoa em Usuários › Módulos. Pode ser rodada mais de uma vez.

-- 1. Eventos
CREATE TABLE IF NOT EXISTS public.agenda_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    location VARCHAR(200),
    -- Cor do evento (chave da paleta da tela)
    color VARCHAR(20) NOT NULL DEFAULT 'azul',
    -- Dia inteiro quando start_time é nulo
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    recurrence VARCHAR(10) NOT NULL DEFAULT 'nenhuma'
        CHECK (recurrence IN ('nenhuma', 'diaria', 'semanal', 'mensal', 'anual')),
    recurrence_until DATE,
    -- Funcionário responsável (opcional) e convidados em texto livre
    responsible_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    guests TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CHECK (end_date >= start_date),
    CHECK ((start_time IS NULL) = (end_time IS NULL)),
    CHECK (start_time IS NULL OR end_date > start_date OR end_time > start_time),
    CHECK (recurrence_until IS NULL OR recurrence_until >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_agenda_events_start ON public.agenda_events (start_date);
CREATE INDEX IF NOT EXISTS idx_agenda_events_recurring ON public.agenda_events (recurrence) WHERE recurrence <> 'nenhuma';

CREATE OR REPLACE FUNCTION public.agenda_events_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at := TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agenda_events_touch ON public.agenda_events;
CREATE TRIGGER trg_agenda_events_touch BEFORE UPDATE ON public.agenda_events
    FOR EACH ROW EXECUTE FUNCTION public.agenda_events_touch();

DROP TRIGGER IF EXISTS trg_audit_agenda_events ON public.agenda_events;
CREATE TRIGGER trg_audit_agenda_events AFTER INSERT OR UPDATE OR DELETE ON public.agenda_events
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 2. Padrão por perfil
INSERT INTO public.role_module_defaults (role, module, level) VALUES
    ('admin', 'agenda', 3),
    ('adm', 'agenda', 2),
    ('ti', 'agenda', 2),
    ('rh', 'agenda', 2),
    ('financeiro', 'agenda', 0),
    ('consulta', 'agenda', 0),
    ('funcionario', 'agenda', 0)
ON CONFLICT (role, module) DO NOTHING;

-- 3. Regras de acesso
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agenda: leitura" ON public.agenda_events;
CREATE POLICY "Agenda: leitura" ON public.agenda_events FOR SELECT TO authenticated
    USING (public.has_module('agenda', 1));

DROP POLICY IF EXISTS "Agenda: inclusão" ON public.agenda_events;
CREATE POLICY "Agenda: inclusão" ON public.agenda_events FOR INSERT TO authenticated
    WITH CHECK (public.has_module('agenda', 2) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Agenda: alteração" ON public.agenda_events;
CREATE POLICY "Agenda: alteração" ON public.agenda_events FOR UPDATE TO authenticated
    USING (public.has_module('agenda', 2))
    WITH CHECK (public.has_module('agenda', 2));

-- Exclui: nível 3 qualquer evento; nível 2 só os que criou
DROP POLICY IF EXISTS "Agenda: exclusão" ON public.agenda_events;
CREATE POLICY "Agenda: exclusão" ON public.agenda_events FOR DELETE TO authenticated
    USING (public.has_module('agenda', 3) OR (public.has_module('agenda', 2) AND created_by = auth.uid()));

-- 4. Quem usa a agenda escolhe o responsável na lista de funcionários
DROP POLICY IF EXISTS "Agenda: leitura de funcionários" ON public.employees;
CREATE POLICY "Agenda: leitura de funcionários" ON public.employees FOR SELECT TO authenticated
    USING (public.has_module('agenda', 2));
