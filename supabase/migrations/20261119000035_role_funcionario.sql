-- Perfil "funcionario": entra no ERP só para bater o próprio ponto,
-- ver o espelho/banco de horas e pedir ajustes, folgas e férias.
-- Fica numa migration própria porque um valor novo de enum só pode ser
-- usado depois do commit (as regras ficam na migration seguinte).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'funcionario';
