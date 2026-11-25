-- Catálogo oficial de departamentos da organização.

UPDATE public.departments SET name = 'TI' WHERE name = 'Tecnologia da Informação'
  AND NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'TI');
UPDATE public.departments SET name = 'RH' WHERE name = 'Recursos Humanos'
  AND NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'RH');
UPDATE public.departments SET name = 'Financeiro' WHERE name = 'Financeiro / Administrativo'
  AND NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Financeiro');

INSERT INTO public.departments (name)
VALUES ('TI'), ('RH'), ('Financeiro'), ('Pedagogia'), ('GUESTA')
ON CONFLICT (name) DO NOTHING;

UPDATE public.employees SET department_name = 'TI' WHERE department_name = 'Tecnologia da Informação';
UPDATE public.employees SET department_name = 'RH' WHERE department_name = 'Recursos Humanos';
UPDATE public.employees SET department_name = 'Financeiro' WHERE department_name = 'Financeiro / Administrativo';
