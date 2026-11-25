-- Licenças atribuídas a contas de serviço (ex.: e-mail usado no Facebook e nas redes sociais),
-- e não só a funcionários.
ALTER TABLE public.subscription_assignments
    ALTER COLUMN employee_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS account_label VARCHAR(150),
    ADD COLUMN IF NOT EXISTS account_email VARCHAR(255);

ALTER TABLE public.subscription_assignments
    DROP CONSTRAINT IF EXISTS subscription_assignments_owner_check;
ALTER TABLE public.subscription_assignments
    ADD CONSTRAINT subscription_assignments_owner_check
    CHECK (employee_id IS NOT NULL OR nullif(trim(coalesce(account_label, '')), '') IS NOT NULL);
