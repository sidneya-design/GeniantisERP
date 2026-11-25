-- Adiciona CPF ao cadastro central de funcionários.

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_cpf_unique
    ON public.employees(cpf)
    WHERE cpf IS NOT NULL AND cpf <> '';
