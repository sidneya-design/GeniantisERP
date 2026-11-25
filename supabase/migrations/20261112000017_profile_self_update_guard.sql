-- Endurecimento das regras do próprio usuário (revisão de RLS de 12/11/2026).
-- Pode ser rodada mais de uma vez.

-- 1. No próprio perfil, o usuário só muda nome e foto. Antes também conseguia
--    trocar o e-mail e o vínculo com funcionário pela API (o perfil e o
--    "ativo" já eram protegidos). O e-mail errado aparecia nos logs e no
--    painel de aniversariantes. Admin continua podendo tudo pela regra própria.
DROP POLICY IF EXISTS "Usuário edita próprio nome" ON public.profiles;
CREATE POLICY "Usuário edita próprio nome"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
        AND email IS NOT DISTINCT FROM (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
        AND employee_id IS NOT DISTINCT FROM (SELECT p.employee_id FROM public.profiles p WHERE p.id = auth.uid())
    );

-- 2. Eventos de sessão no log (entrada, saída, troca de senha): o e-mail e o
--    nome gravados precisam ser os do próprio perfil, para ninguém registrar
--    um acesso em nome de outra pessoa.
DROP POLICY IF EXISTS "Usuário registra os próprios eventos de sessão" ON public.audit_logs;
CREATE POLICY "Usuário registra os próprios eventos de sessão"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND action IN ('login', 'logout', 'password_change')
        AND entity = 'sessao'
        AND user_email IS NOT DISTINCT FROM (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
        AND user_name IS NOT DISTINCT FROM (SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid())
    );
