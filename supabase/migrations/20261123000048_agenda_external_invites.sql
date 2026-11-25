-- Agenda: convite por e-mail para pessoas de fora do ERP.
-- Os e-mails digitados em "Convidados de fora do ERP" recebem o convite (data, horário, local,
-- link da videochamada e arquivo .ics para adicionar ao Google Agenda/Outlook).
-- Esta tabela guarda para quem já foi enviado, para não mandar de novo a cada edição.
-- O envio é feito pela função da Netlify (send-email › agenda_external_invite), com a chave de servidor.
-- Rode depois da 20261123000047. Pode ser rodada mais de uma vez.

CREATE TABLE IF NOT EXISTS public.agenda_external_invites (
    event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (event_id, email)
);

ALTER TABLE public.agenda_external_invites ENABLE ROW LEVEL SECURITY;
-- Quem vê o evento vê para quem o convite foi enviado; gravação só pelo servidor
DROP POLICY IF EXISTS "Convites externos: leitura" ON public.agenda_external_invites;
CREATE POLICY "Convites externos: leitura" ON public.agenda_external_invites FOR SELECT TO authenticated
    USING (public.agenda_event_level(event_id) >= 1);
