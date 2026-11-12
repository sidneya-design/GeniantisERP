-- Dados pessoais de funcionários em tabela própria (substitui a restrição por
-- coluna da migration 20261112000008, que quebrava as consultas com junção).
-- employees volta a ser lida normalmente; CPF, endereço, contato de emergência
-- e observações restritas ficam em employee_private, só para Admin, ADM e RH.
-- Pode ser rodada mais de uma vez.

-- 1. Leitura normal da tabela de funcionários (desfaz a restrição por coluna)
GRANT SELECT ON public.employees TO authenticated;

-- 2. Tabela de dados pessoais (1 linha por funcionário)
CREATE TABLE IF NOT EXISTS public.employee_private (
    employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
    cpf VARCHAR(14),
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_relationship VARCHAR(100),
    emergency_contact_phone VARCHAR(30),
    restricted_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- CPF continua único (como era em employees)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_private_cpf_unique
    ON public.employee_private(cpf)
    WHERE cpf IS NOT NULL AND cpf <> '';

ALTER TABLE public.employee_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dados pessoais: leitura Admin ADM RH" ON public.employee_private;
CREATE POLICY "Dados pessoais: leitura Admin ADM RH"
    ON public.employee_private FOR SELECT TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'));

DROP POLICY IF EXISTS "Dados pessoais: inclusão Admin ADM RH" ON public.employee_private;
CREATE POLICY "Dados pessoais: inclusão Admin ADM RH"
    ON public.employee_private FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'));

DROP POLICY IF EXISTS "Dados pessoais: alteração Admin ADM RH" ON public.employee_private;
CREATE POLICY "Dados pessoais: alteração Admin ADM RH"
    ON public.employee_private FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'))
    WITH CHECK (public.is_admin() OR public.current_user_role() IN ('adm', 'rh'));

DROP POLICY IF EXISTS "Dados pessoais: exclusão Admin" ON public.employee_private;
CREATE POLICY "Dados pessoais: exclusão Admin"
    ON public.employee_private FOR DELETE TO authenticated
    USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_employee_private_updated_at ON public.employee_private;
CREATE TRIGGER trg_employee_private_updated_at
    BEFORE UPDATE ON public.employee_private
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auditoria também nesta tabela
DO $$
BEGIN
    IF to_regprocedure('public.audit_row_change()') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS trg_audit_employee_private ON public.employee_private;
        CREATE TRIGGER trg_audit_employee_private AFTER INSERT OR UPDATE OR DELETE ON public.employee_private
            FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
    END IF;
END $$;

-- 3. Copia os dados que já existem e limpa as colunas antigas em employees
INSERT INTO public.employee_private (employee_id, cpf, address, emergency_contact_name,
                                     emergency_contact_relationship, emergency_contact_phone, restricted_notes)
SELECT id, cpf, address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, restricted_notes
FROM public.employees
WHERE COALESCE(cpf, address, emergency_contact_name, emergency_contact_relationship,
               emergency_contact_phone, restricted_notes) IS NOT NULL
ON CONFLICT (employee_id) DO UPDATE SET
    cpf = COALESCE(EXCLUDED.cpf, employee_private.cpf),
    address = COALESCE(EXCLUDED.address, employee_private.address),
    emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, employee_private.emergency_contact_name),
    emergency_contact_relationship = COALESCE(EXCLUDED.emergency_contact_relationship, employee_private.emergency_contact_relationship),
    emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, employee_private.emergency_contact_phone),
    restricted_notes = COALESCE(EXCLUDED.restricted_notes, employee_private.restricted_notes);

UPDATE public.employees
SET cpf = NULL, address = NULL, emergency_contact_name = NULL,
    emergency_contact_relationship = NULL, emergency_contact_phone = NULL, restricted_notes = NULL
WHERE COALESCE(cpf, address, emergency_contact_name, emergency_contact_relationship,
               emergency_contact_phone, restricted_notes) IS NOT NULL;

-- 4. Função da migration anterior não é mais necessária
DROP FUNCTION IF EXISTS public.get_employee_private_data();
