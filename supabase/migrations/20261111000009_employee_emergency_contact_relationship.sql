-- Grau de parentesco do contato emergencial dos funcionários.

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100);

-- Atualiza o cache de schema usado pela API REST do Supabase.
NOTIFY pgrst, 'reload schema';
