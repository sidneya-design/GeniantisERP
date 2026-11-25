-- Adiciona o perfil ADM ao enum sem remover perfis legados.
-- As policies que usam esse valor ficam na migration seguinte, após o commit.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'adm';
