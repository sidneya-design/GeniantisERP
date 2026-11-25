-- Banners: cores e tamanhos dos textos escolhidos por banner.
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS style JSONB NOT NULL DEFAULT '{}'::jsonb;
