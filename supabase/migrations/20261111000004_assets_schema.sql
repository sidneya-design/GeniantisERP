-- Inventário central de ativos de TI.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status') THEN
    CREATE TYPE public.asset_status AS ENUM ('disponivel', 'em_uso', 'em_manutencao', 'baixado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_condition') THEN
    CREATE TYPE public.asset_condition AS ENUM ('excelente', 'bom', 'regular', 'ruim');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patrimony VARCHAR(50) NOT NULL UNIQUE,
    serial_number VARCHAR(150) UNIQUE,
    category VARCHAR(50) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(150),
    unit_name VARCHAR(100) NOT NULL,
    condition public.asset_condition NOT NULL DEFAULT 'bom',
    status public.asset_status NOT NULL DEFAULT 'disponivel',
    assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    warranty_until DATE,
    acquisition_date DATE,
    purchase_cost NUMERIC(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_employee ON public.assets(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_warranty ON public.assets(warranty_until);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura de ativos por usuários autorizados" ON public.assets;
CREATE POLICY "Leitura de ativos por usuários autorizados"
    ON public.assets FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'ti', 'financeiro', 'consulta')
    );

DROP POLICY IF EXISTS "Escrita de ativos por Admin ADM e TI" ON public.assets;
CREATE POLICY "Escrita de ativos por Admin ADM e TI"
    ON public.assets FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'ti')
    );

DROP POLICY IF EXISTS "Atualização de ativos por Admin ADM e TI" ON public.assets;
CREATE POLICY "Atualização de ativos por Admin ADM e TI"
    ON public.assets FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'ti')
    )
    WITH CHECK (
        public.is_admin()
        OR public.current_user_role() IN ('adm', 'ti')
    );

DROP POLICY IF EXISTS "Exclusão de ativos por Admin" ON public.assets;
CREATE POLICY "Exclusão de ativos por Admin"
    ON public.assets FOR DELETE
    TO authenticated
    USING (public.is_admin());
