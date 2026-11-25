-- Novo departamento: Administrativo.
-- Pode ser rodada mais de uma vez.

INSERT INTO public.departments (name) VALUES ('Administrativo')
ON CONFLICT (name) DO NOTHING;
