-- Comunicados: e-mails para os funcionários (avisos, lembretes), um por pessoa.
-- Permissão própria (módulo 'communications'): Admin exclui, RH envia, ADM e TI só veem o histórico.
-- O envio é feito pela function send-email com a chave de servidor; aqui ficam o comunicado,
-- os destinatários e o resultado de cada envio.
-- Pode ser rodada mais de uma vez.

-- 1. Padrão por perfil
INSERT INTO public.role_module_defaults (role, module, level) VALUES
    ('admin', 'communications', 3),
    ('adm', 'communications', 1),
    ('ti', 'communications', 1),
    ('rh', 'communications', 2),
    ('financeiro', 'communications', 0),
    ('consulta', 'communications', 0)
ON CONFLICT (role, module) DO NOTHING;

-- 2. Remetente dos comunicados: conta Google separada (rh@geniantis.org), com
--    COMUNICADOS_GMAIL_USER e COMUNICADOS_GMAIL_APP_PASSWORD na Netlify
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS comm_sender_name VARCHAR(100) NOT NULL DEFAULT 'RH Geniantis';
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS comm_reply_to VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS comm_signature TEXT NOT NULL DEFAULT '';

-- 3. Comunicados
CREATE TABLE IF NOT EXISTS public.communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL DEFAULT '',          -- texto digitado (para duplicar/editar)
    body_html TEXT NOT NULL DEFAULT '',     -- HTML enviado ({{nome}} trocado na hora do envio)
    attachment_path TEXT,
    attachment_name VARCHAR(255),
    audience TEXT NOT NULL DEFAULT '',      -- resumo legível de quem recebeu (ex.: "Financeiro, TI")
    status VARCHAR(12) NOT NULL DEFAULT 'enviando' CHECK (status IN ('enviando', 'enviado', 'com_falhas')),
    total INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_by_name VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_communications_created ON public.communications(created_at DESC);

-- 4. Destinatários (um e-mail por pessoa)
CREATE TABLE IF NOT EXISTS public.communication_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'falhou')),
    error TEXT,
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comm_recipients_comm ON public.communication_recipients(communication_id, status);

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Módulo: leitura" ON public.communications;
CREATE POLICY "Módulo: leitura" ON public.communications FOR SELECT TO authenticated USING (public.has_module('communications', 1));
DROP POLICY IF EXISTS "Módulo: inclusão" ON public.communications;
CREATE POLICY "Módulo: inclusão" ON public.communications FOR INSERT TO authenticated WITH CHECK (public.has_module('communications', 2));
DROP POLICY IF EXISTS "Módulo: exclusão" ON public.communications;
CREATE POLICY "Módulo: exclusão" ON public.communications FOR DELETE TO authenticated USING (public.has_module('communications', 3));

DROP POLICY IF EXISTS "Módulo: leitura" ON public.communication_recipients;
CREATE POLICY "Módulo: leitura" ON public.communication_recipients FOR SELECT TO authenticated USING (public.has_module('communications', 1));
DROP POLICY IF EXISTS "Módulo: inclusão" ON public.communication_recipients;
CREATE POLICY "Módulo: inclusão" ON public.communication_recipients FOR INSERT TO authenticated WITH CHECK (public.has_module('communications', 2));
-- Status e contagens só mudam pela function (chave de servidor)

DROP TRIGGER IF EXISTS trg_audit_communications ON public.communications;
CREATE TRIGGER trg_audit_communications AFTER INSERT OR DELETE ON public.communications
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 5. Anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-files', 'communication-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Comunicados: leitura de anexos" ON storage.objects;
CREATE POLICY "Comunicados: leitura de anexos" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'communication-files' AND public.has_module('communications', 1));
DROP POLICY IF EXISTS "Comunicados: envio de anexos" ON storage.objects;
CREATE POLICY "Comunicados: envio de anexos" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'communication-files' AND public.has_module('communications', 2));

-- 6. Quem envia comunicados precisa ver a lista de funcionários (nome, e-mail, setor)
DROP POLICY IF EXISTS "Módulo: leitura" ON public.employees;
CREATE POLICY "Módulo: leitura" ON public.employees FOR SELECT TO authenticated USING (
    public.has_module('employees', 1) OR public.has_module('movements', 1) OR public.has_module('assets', 1)
    OR public.has_module('maintenance', 1) OR public.has_module('subscriptions', 1) OR public.has_module('birthdays', 1)
    OR public.has_module('communications', 2)
);
