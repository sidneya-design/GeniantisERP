-- Novo departamento: Serviços Gerais (limpeza, copa, manutenção predial e portaria).
-- Pode ser rodada mais de uma vez.

INSERT INTO public.departments (name) VALUES ('Serviços Gerais')
ON CONFLICT (name) DO NOTHING;
