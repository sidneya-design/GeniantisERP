-- Departamento GUESTA passa a se chamar GHESTA (catálogo e funcionários).
-- Pode ser rodada mais de uma vez.

UPDATE public.departments SET name = 'GHESTA'
WHERE name = 'GUESTA'
  AND NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'GHESTA');

-- Se GHESTA já existia, remove o GUESTA que sobrou (os funcionários são movidos abaixo)
UPDATE public.employees e SET department_id = g.id
FROM public.departments g, public.departments u
WHERE g.name = 'GHESTA' AND u.name = 'GUESTA' AND e.department_id = u.id;
DELETE FROM public.departments WHERE name = 'GUESTA';

UPDATE public.employees SET department_name = 'GHESTA' WHERE department_name = 'GUESTA';
