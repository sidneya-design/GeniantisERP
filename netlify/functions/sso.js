const { gerarToken } = require('./utils/auth');

// SSO do GeniantisERP → painel de aniversariantes.
// Recebe o access token da sessão Supabase do ERP, confirma o usuário e o
// perfil no próprio Supabase e devolve um token de sessão assinado do painel.

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function resposta(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// Mapeia o papel do ERP para o papel do painel
function mapearRole(roleErp) {
  if (roleErp === 'admin') return 'admin';
  if (roleErp === 'adm' || roleErp === 'rh') return 'editor';
  return 'viewer';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resposta(200, {});
  if (event.httpMethod !== 'POST') return resposta(405, { error: 'Método não permitido.' });

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return resposta(500, { error: 'Supabase não configurado nas variáveis de ambiente.' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) return resposta(401, { error: 'Sessão do ERP ausente.' });

  const supabaseHeaders = { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` };

  try {
    // 1. Confirma o usuário dono do access token
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: supabaseHeaders });
    if (!userRes.ok) return resposta(401, { error: 'Sessão do ERP inválida ou expirada.' });
    const user = await userRes.json();
    if (!user || !user.id) return resposta(401, { error: 'Sessão do ERP inválida.' });

    // 2. Lê o perfil (RLS permite ao usuário ler o próprio perfil)
    const perfilRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=email,role,is_active`,
      { headers: supabaseHeaders }
    );
    if (!perfilRes.ok) return resposta(403, { error: 'Não foi possível ler o perfil do usuário.' });
    const [perfil] = await perfilRes.json();
    if (!perfil || !perfil.is_active) return resposta(403, { error: 'Usuário sem perfil ativo no ERP.' });

    const email = perfil.email || user.email;
    const role = mapearRole(perfil.role);
    return resposta(200, { token: gerarToken(email, role), email, role });
  } catch (err) {
    console.error('Erro na função sso:', err);
    return resposta(500, { error: 'Falha ao validar a sessão do ERP.' });
  }
};
