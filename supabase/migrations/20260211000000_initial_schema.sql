-- ==============================================================================
-- GeniantisERP - Migração Inicial: Perfis, Permissões (RBAC) e Estrutura Base
-- Versão: 20260211000000
-- ==============================================================================

-- 1. Tipos e Enums
CREATE TYPE user_role AS ENUM ('admin', 'ti', 'rh', 'financeiro', 'consulta');

-- 2. Tabela de Unidades e Departamentos da Organização
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Inserir dados padrão de exemplo
INSERT INTO public.units (name) VALUES ('Matriz - São Paulo'), ('Filial 1') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Tecnologia da Informação'), ('Recursos Humanos'), ('Financeiro / Administrativo'), ('Operações'), ('Diretoria') ON CONFLICT DO NOTHING;

-- 3. Tabela de Perfis de Usuário (vinculada a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'consulta',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. Função auxiliar para verificar role do usuário autenticado de forma segura no RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    );
$$;

-- 5. Row Level Security (RLS) para Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Políticas de Units e Departments: qualquer usuário autenticado pode ler, admin e ti podem gerenciar
CREATE POLICY "Leitura de unidades por autenticados" 
    ON public.units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gerenciamento de unidades por admin" 
    ON public.units FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Leitura de departamentos por autenticados" 
    ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gerenciamento de departamentos por admin" 
    ON public.departments FOR ALL TO authenticated USING (public.is_admin());

-- Políticas de Profiles:
-- a) Usuários autenticados podem ver o próprio perfil ou admins veem todos
CREATE POLICY "Usuário vê próprio perfil ou Admin vê todos"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin());

-- b) Usuário pode atualizar seu próprio nome, mas NUNCA seu role ou is_active
CREATE POLICY "Usuário edita próprio nome"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    );

-- c) Apenas Admin pode criar, atualizar roles ou desativar perfis
CREATE POLICY "Admin gerencia todos os perfis"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Trigger para criar perfil automaticamente no primeiro login / criação de usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count INTEGER;
    initial_role user_role;
BEGIN
    -- Se for o primeiríssimo usuário cadastrado no sistema, torna-se 'admin' automaticamente
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    IF user_count = 0 THEN
        initial_role := 'admin'::user_role;
    ELSE
        initial_role := 'consulta'::user_role;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        initial_role,
        true
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Tabela de Auditoria Imutável
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin visualiza logs de auditoria"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Qualquer autenticado insere auditoria"
    ON public.audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
