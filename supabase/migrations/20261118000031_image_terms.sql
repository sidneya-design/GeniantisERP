-- Licença de uso de imagem: modelo editável (Configurações › Modelos de termo) e
-- a situação de cada funcionário (autorizado / não autorizado; sem linha = pendente),
-- com o PDF assinado num bucket privado.
-- Acesso pelo módulo Funcionários: ver = consulta, editar = imprimir, anexar e marcar.
-- Pode ser rodada mais de uma vez.

-- 1. Terceiro modelo de termo
ALTER TABLE public.document_templates DROP CONSTRAINT IF EXISTS document_templates_id_check;
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_id_check
    CHECK (id IN ('termo_entrega', 'termo_devolucao', 'termo_imagem'));

-- Quem cuida de Funcionários (ex.: RH) precisa ler o modelo para imprimir
DROP POLICY IF EXISTS "Modelos: leitura por Funcionários" ON public.document_templates;
CREATE POLICY "Modelos: leitura por Funcionários" ON public.document_templates FOR SELECT TO authenticated
    USING (public.has_module('employees', 1));

-- 2. Situação por funcionário
CREATE TABLE IF NOT EXISTS public.employee_image_terms (
    employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('autorizado', 'nao_autorizado')),
    signed_at DATE,
    file_path TEXT,
    file_name VARCHAR(255),
    notes TEXT,
    emailed_at TIMESTAMPTZ,
    emailed_to VARCHAR(255),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE public.employee_image_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Módulo: leitura" ON public.employee_image_terms;
CREATE POLICY "Módulo: leitura" ON public.employee_image_terms FOR SELECT TO authenticated USING (public.has_module('employees', 1));
DROP POLICY IF EXISTS "Módulo: inclusão" ON public.employee_image_terms;
CREATE POLICY "Módulo: inclusão" ON public.employee_image_terms FOR INSERT TO authenticated WITH CHECK (public.has_module('employees', 2));
DROP POLICY IF EXISTS "Módulo: alteração" ON public.employee_image_terms;
CREATE POLICY "Módulo: alteração" ON public.employee_image_terms FOR UPDATE TO authenticated
    USING (public.has_module('employees', 2)) WITH CHECK (public.has_module('employees', 2));
DROP POLICY IF EXISTS "Módulo: exclusão" ON public.employee_image_terms;
CREATE POLICY "Módulo: exclusão" ON public.employee_image_terms FOR DELETE TO authenticated USING (public.has_module('employees', 2));

DROP TRIGGER IF EXISTS trg_employee_image_terms_updated_at ON public.employee_image_terms;
CREATE TRIGGER trg_employee_image_terms_updated_at BEFORE UPDATE ON public.employee_image_terms
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_employee_image_terms ON public.employee_image_terms;
CREATE TRIGGER trg_audit_employee_image_terms AFTER INSERT OR UPDATE OR DELETE ON public.employee_image_terms
    FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 3. PDFs assinados
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Documentos de funcionários: leitura" ON storage.objects;
CREATE POLICY "Documentos de funcionários: leitura" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'employee-documents' AND public.has_module('employees', 1));
DROP POLICY IF EXISTS "Documentos de funcionários: envio" ON storage.objects;
CREATE POLICY "Documentos de funcionários: envio" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'employee-documents' AND public.has_module('employees', 2));
