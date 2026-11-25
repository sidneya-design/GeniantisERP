-- Controle de Ponto: localização no momento da batida.
--  * O navegador pede permissão e envia latitude, longitude e precisão (em metros) junto com o ponto.
--  * Se a pessoa negar ou o aparelho não conseguir, o ponto é registrado mesmo assim e fica
--    marcado como "negada" ou "indisponível" para o RH.
--  * Só no momento da batida (não há acompanhamento durante o dia). Quem vê as marcações
--    (o próprio funcionário, o RH e os responsáveis pelo departamento) vê a localização delas.
--  * Ajustes e lançamentos manuais do RH não têm localização.
-- Rode depois da 20261123000049. Pode ser rodada mais de uma vez.

ALTER TABLE public.time_punches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.time_punches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.time_punches ADD COLUMN IF NOT EXISTS accuracy_m REAL;
-- ok · negada (pessoa não permitiu) · indisponivel (aparelho não conseguiu) · vazio = sem localização (manual/antigo)
ALTER TABLE public.time_punches ADD COLUMN IF NOT EXISTS location_status VARCHAR(12);
ALTER TABLE public.time_punches DROP CONSTRAINT IF EXISTS time_punches_location_check;
ALTER TABLE public.time_punches ADD CONSTRAINT time_punches_location_check CHECK (
    (location_status IS NULL OR location_status IN ('ok', 'negada', 'indisponivel'))
    AND (latitude IS NULL OR latitude BETWEEN -90 AND 90)
    AND (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

-- Bater o ponto, agora com a localização (a chamada antiga, só com a observação, continua funcionando)
DROP FUNCTION IF EXISTS public.punch_clock(TEXT);
CREATE OR REPLACE FUNCTION public.punch_clock(
    p_note TEXT DEFAULT NULL,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL,
    p_accuracy REAL DEFAULT NULL,
    p_location_status TEXT DEFAULT NULL
)
RETURNS public.time_punches
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_emp UUID := public.my_employee_id();
    v_status TEXT;
    v_row public.time_punches;
    v_ok BOOLEAN := p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180;
BEGIN
    IF v_emp IS NULL THEN
        RAISE EXCEPTION 'Seu usuário não está ligado a um cadastro de funcionário. Fale com o RH.' USING ERRCODE = '42501';
    END IF;
    SELECT status::text INTO v_status FROM public.employees WHERE id = v_emp;
    IF v_status = 'desligado' THEN
        RAISE EXCEPTION 'Cadastro desligado: não é possível registrar ponto.' USING ERRCODE = '42501';
    END IF;
    -- evita marcação dupla por clique repetido
    PERFORM pg_advisory_xact_lock(hashtext('punch_clock:' || v_emp::text));
    IF EXISTS (SELECT 1 FROM public.time_punches WHERE employee_id = v_emp AND punched_at > NOW() - INTERVAL '1 minute') THEN
        RAISE EXCEPTION 'Você registrou o ponto há menos de 1 minuto.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.time_punches (employee_id, punched_at, source, note, created_by, latitude, longitude, accuracy_m, location_status)
    VALUES (
        v_emp, NOW(), 'ponto', NULLIF(LEFT(trim(COALESCE(p_note, '')), 300), ''), auth.uid(),
        CASE WHEN COALESCE(v_ok, false) THEN p_latitude END,
        CASE WHEN COALESCE(v_ok, false) THEN p_longitude END,
        CASE WHEN COALESCE(v_ok, false) AND p_accuracy >= 0 THEN p_accuracy END,
        CASE WHEN COALESCE(v_ok, false) THEN 'ok'
             WHEN p_location_status = 'negada' THEN 'negada'
             ELSE 'indisponivel' END
    )
    RETURNING * INTO v_row;
    RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.punch_clock(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, REAL, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.punch_clock(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, REAL, TEXT) TO authenticated;
