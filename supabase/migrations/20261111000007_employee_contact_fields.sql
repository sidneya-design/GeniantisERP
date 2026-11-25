-- Dados complementares de contato dos funcionários.

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
