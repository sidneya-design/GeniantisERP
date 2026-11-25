-- E-mails do ERP: configurações de envio, alertas de vencimento e termo por e-mail.
-- O envio é feito pelas functions da Netlify (Gmail/Workspace) com a chave de servidor;
-- esta migration só guarda as preferências e o histórico para não repetir alertas.
-- Pode ser rodada mais de uma vez.

-- 1. Configurações (uma única linha, id = 1)
CREATE TABLE IF NOT EXISTS public.email_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    sender_name VARCHAR(100) NOT NULL DEFAULT 'Geniantis ERP',
    reply_to VARCHAR(255) NOT NULL DEFAULT '',
    signature TEXT NOT NULL DEFAULT '',
    -- Alertas de vencimento
    alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    alert_recipients TEXT[] NOT NULL DEFAULT '{}',
    alert_days INTEGER[] NOT NULL DEFAULT '{30,7,1}',
    alert_domains BOOLEAN NOT NULL DEFAULT TRUE,
    alert_contracts BOOLEAN NOT NULL DEFAULT TRUE,
    alert_subscriptions BOOLEAN NOT NULL DEFAULT TRUE,
    alert_maintenance BOOLEAN NOT NULL DEFAULT TRUE,
    -- Termo assinado por e-mail
    term_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    term_subject VARCHAR(200) NOT NULL DEFAULT 'Seu termo de {{tipo}} de equipamentos',
    term_body TEXT NOT NULL DEFAULT E'Olá, {{nome}}!\n\nSegue em anexo a cópia do termo de {{tipo}} assinado em {{data}}, referente aos itens:\n\n{{itens}}\n\nGuarde este e-mail para sua referência.',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Leitura por quem usa o ERP (a tela de Entregas precisa saber se o envio do termo está ligado);
-- alteração só Admin.
DROP POLICY IF EXISTS "E-mail: leitura" ON public.email_settings;
CREATE POLICY "E-mail: leitura" ON public.email_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "E-mail: Admin altera" ON public.email_settings;
CREATE POLICY "E-mail: Admin altera" ON public.email_settings FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_email_settings_updated_at ON public.email_settings;
CREATE TRIGGER trg_email_settings_updated_at BEFORE UPDATE ON public.email_settings
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_email_settings ON public.email_settings;
CREATE TRIGGER trg_audit_email_settings AFTER INSERT OR UPDATE OR DELETE ON public.email_settings
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 2. Alertas já enviados (evita repetir o mesmo aviso todo dia).
-- Chave: tipo:id:data_de_vencimento:faixa_de_dias. Só a function (chave de servidor) grava.
CREATE TABLE IF NOT EXISTS public.email_alert_log (
    key TEXT PRIMARY KEY,
    sent_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.email_alert_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Alertas: Admin lê" ON public.email_alert_log;
CREATE POLICY "Alertas: Admin lê" ON public.email_alert_log FOR SELECT TO authenticated USING (public.is_admin());

-- 3. Quando o termo foi enviado ao funcionário
ALTER TABLE public.asset_movements ADD COLUMN IF NOT EXISTS term_emailed_at TIMESTAMPTZ;
ALTER TABLE public.asset_movements ADD COLUMN IF NOT EXISTS term_emailed_to VARCHAR(255);
