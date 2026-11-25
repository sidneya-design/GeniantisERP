-- Nome do contato emergencial dos funcionários.

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
