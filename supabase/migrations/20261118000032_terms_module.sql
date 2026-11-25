-- Módulo "Termos": lugar fácil para RH e ADM (financeiro) cuidarem da licença de uso de imagem:
-- registrar assinaturas de todos os funcionários e editar o texto do modelo.
-- Padrão: Admin exclui, ADM e RH editam, TI vê. Ajustável por pessoa em Usuários › Módulos.
-- Os termos de entrega e devolução continuam só com o Admin.
-- Rode depois da 20261118000031_image_terms.sql. Pode ser rodada mais de uma vez.

-- 1. Padrão por perfil
INSERT INTO public.role_module_defaults (role, module, level) VALUES
    ('admin', 'documents', 3),
    ('adm', 'documents', 2),
    ('ti', 'documents', 1),
    ('rh', 'documents', 2),
    ('financeiro', 'documents', 0),
    ('consulta', 'documents', 0)
ON CONFLICT (role, module) DO NOTHING;

-- 2. Situação da licença: Funcionários OU Termos
DROP POLICY IF EXISTS "Módulo: leitura" ON public.employee_image_terms;
CREATE POLICY "Módulo: leitura" ON public.employee_image_terms FOR SELECT TO authenticated
    USING (public.has_module('employees', 1) OR public.has_module('documents', 1));
DROP POLICY IF EXISTS "Módulo: inclusão" ON public.employee_image_terms;
CREATE POLICY "Módulo: inclusão" ON public.employee_image_terms FOR INSERT TO authenticated
    WITH CHECK (public.has_module('employees', 2) OR public.has_module('documents', 2));
DROP POLICY IF EXISTS "Módulo: alteração" ON public.employee_image_terms;
CREATE POLICY "Módulo: alteração" ON public.employee_image_terms FOR UPDATE TO authenticated
    USING (public.has_module('employees', 2) OR public.has_module('documents', 2))
    WITH CHECK (public.has_module('employees', 2) OR public.has_module('documents', 2));
DROP POLICY IF EXISTS "Módulo: exclusão" ON public.employee_image_terms;
CREATE POLICY "Módulo: exclusão" ON public.employee_image_terms FOR DELETE TO authenticated
    USING (public.has_module('employees', 2) OR public.has_module('documents', 2));

-- 3. PDFs assinados
DROP POLICY IF EXISTS "Documentos de funcionários: leitura" ON storage.objects;
CREATE POLICY "Documentos de funcionários: leitura" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'employee-documents' AND (public.has_module('employees', 1) OR public.has_module('documents', 1)));
DROP POLICY IF EXISTS "Documentos de funcionários: envio" ON storage.objects;
CREATE POLICY "Documentos de funcionários: envio" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'employee-documents' AND (public.has_module('employees', 2) OR public.has_module('documents', 2)));

-- 4. Texto do modelo de uso de imagem: quem edita Termos pode alterar (só esse modelo)
DROP POLICY IF EXISTS "Modelos: leitura por Termos" ON public.document_templates;
CREATE POLICY "Modelos: leitura por Termos" ON public.document_templates FOR SELECT TO authenticated
    USING (public.has_module('documents', 1));
DROP POLICY IF EXISTS "Modelos: imagem inclusão por Termos" ON public.document_templates;
CREATE POLICY "Modelos: imagem inclusão por Termos" ON public.document_templates FOR INSERT TO authenticated
    WITH CHECK (id = 'termo_imagem' AND public.has_module('documents', 2));
DROP POLICY IF EXISTS "Modelos: imagem alteração por Termos" ON public.document_templates;
CREATE POLICY "Modelos: imagem alteração por Termos" ON public.document_templates FOR UPDATE TO authenticated
    USING (id = 'termo_imagem' AND public.has_module('documents', 2))
    WITH CHECK (id = 'termo_imagem' AND public.has_module('documents', 2));
DROP POLICY IF EXISTS "Modelos: imagem exclusão por Termos" ON public.document_templates;
CREATE POLICY "Modelos: imagem exclusão por Termos" ON public.document_templates FOR DELETE TO authenticated
    USING (id = 'termo_imagem' AND public.has_module('documents', 2));

-- 5. Quem usa Termos precisa ver a lista de funcionários
DROP POLICY IF EXISTS "Módulo: leitura" ON public.employees;
CREATE POLICY "Módulo: leitura" ON public.employees FOR SELECT TO authenticated USING (
    public.has_module('employees', 1) OR public.has_module('movements', 1) OR public.has_module('assets', 1)
    OR public.has_module('maintenance', 1) OR public.has_module('subscriptions', 1) OR public.has_module('birthdays', 1)
    OR public.has_module('communications', 2) OR public.has_module('documents', 1)
);
