-- ==============================================================================
-- GeniantisERP - Migração: Tabela de Funcionários e Aniversários
-- Versão: 20260211000001
-- ==============================================================================

CREATE TYPE employee_status AS ENUM ('ativo', 'afastado', 'desligado');

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    preferential_name VARCHAR(100),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    department_id UUID REFERENCES public.departments(id),
    department_name VARCHAR(100) NOT NULL,
    role_title VARCHAR(100) NOT NULL,
    unit_id UUID REFERENCES public.units(id),
    unit_name VARCHAR(100) NOT NULL,
    manager VARCHAR(255),
    admission_date DATE NOT NULL,
    termination_date DATE,
    birth_date DATE, -- Campo de Aniversário compartilhado com ParabénsFlow
    status employee_status NOT NULL DEFAULT 'ativo',
    photo_url TEXT,
    restricted_notes TEXT, -- Observações restritas (RH / Admin)
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department_name);
CREATE INDEX IF NOT EXISTS idx_employees_birth_date ON public.employees(birth_date);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 1. Políticas de Leitura:
-- Admin, RH e TI podem visualizar todos os colaboradores
-- Financeiro e Consulta podem visualizar apenas dados públicos (sem observações restritas)
CREATE POLICY "Leitura de funcionários por usuários autorizados"
    ON public.employees FOR SELECT
    TO authenticated
    USING (
        public.is_admin() 
        OR public.current_user_role() IN ('ti', 'rh', 'financeiro', 'consulta')
    );

-- 2. Políticas de Gravação / Edição:
-- Apenas Admin e RH podem cadastrar ou alterar dados gerais de funcionários
CREATE POLICY "Escrita de funcionários por Admin e RH"
    ON public.employees FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'rh');

CREATE POLICY "Atualização de funcionários por Admin e RH"
    ON public.employees FOR UPDATE
    TO authenticated
    USING (public.is_admin() OR public.current_user_role() = 'rh')
    WITH CHECK (public.is_admin() OR public.current_user_role() = 'rh');

-- 3. Exclusão restrita (Admin somente)
CREATE POLICY "Exclusão restrita a administradores"
    ON public.employees FOR DELETE
    TO authenticated
    USING (public.is_admin());

