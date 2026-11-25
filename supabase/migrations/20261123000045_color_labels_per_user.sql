-- Etiquetas de cor da agenda passam a ser de cada usuário (cada um dá os próprios nomes às cores).
-- As etiquetas que já existem ficam com quem as criou.
-- Qualquer pessoa com acesso à Agenda cria as suas. Rode depois da 20261123000044. Pode ser rodada mais de uma vez.

ALTER TABLE public.agenda_color_labels ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE public.agenda_color_labels SET user_id = created_by WHERE user_id IS NULL;
DELETE FROM public.agenda_color_labels WHERE user_id IS NULL;
ALTER TABLE public.agenda_color_labels ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.agenda_color_labels ALTER COLUMN user_id SET NOT NULL;

-- Chave: a mesma cor pode ter nomes diferentes para pessoas diferentes
ALTER TABLE public.agenda_color_labels DROP CONSTRAINT IF EXISTS agenda_color_labels_pkey;
ALTER TABLE public.agenda_color_labels ADD CONSTRAINT agenda_color_labels_pkey PRIMARY KEY (user_id, color);

-- Regras: cada um só vê e altera as próprias
DROP POLICY IF EXISTS "Etiquetas: leitura" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: leitura" ON public.agenda_color_labels FOR SELECT TO authenticated
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Etiquetas: inclusão" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: inclusão" ON public.agenda_color_labels FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND public.has_module('agenda', 1));
DROP POLICY IF EXISTS "Etiquetas: alteração" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: alteração" ON public.agenda_color_labels FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Etiquetas: exclusão" ON public.agenda_color_labels;
CREATE POLICY "Etiquetas: exclusão" ON public.agenda_color_labels FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Etiquetas pessoais não precisam ir para o log de atividade
DROP TRIGGER IF EXISTS trg_audit_agenda_color_labels ON public.agenda_color_labels;
