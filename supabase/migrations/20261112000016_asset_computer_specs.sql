-- Ativos: dados técnicos de computadores (Notebook, Desktop e Servidor).
-- Pode ser rodada mais de uma vez.

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS memory VARCHAR(50);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS processor VARCHAR(150);
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS hostname VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_assets_hostname ON public.assets(hostname);
