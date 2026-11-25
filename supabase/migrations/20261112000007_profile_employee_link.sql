-- Liga cada usuário do ERP ao seu cadastro de funcionário.
-- Assim, quando o e-mail do funcionário muda, o sistema sabe qual login
-- precisa ser atualizado (a troca do login é feita só pelo Admin).

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_employee_id
    ON public.profiles(employee_id) WHERE employee_id IS NOT NULL;

-- Usuários que já existem: liga pelo e-mail atual (sem diferenciar maiúsculas)
UPDATE public.profiles p
SET employee_id = e.id
FROM public.employees e
WHERE p.employee_id IS NULL
  AND lower(p.email) = lower(e.email)
  AND NOT EXISTS (SELECT 1 FROM public.profiles x WHERE x.employee_id = e.id);
