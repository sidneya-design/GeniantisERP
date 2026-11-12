// Gestão de usuários do ERP (somente admin).
// Ações que exigem a chave de servidor do Supabase: criar usuário e redefinir senha.
// Listagem e troca de perfil/status são feitas pelo próprio frontend via RLS.

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ROLES_VALIDOS = ['admin', 'adm', 'ti', 'rh'];

function resposta(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function config() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, anonKey, serviceKey };
}

function headersServico(serviceKey) {
  const h = { apikey: serviceKey, 'Content-Type': 'application/json' };
  if (serviceKey.startsWith('eyJ')) h.Authorization = `Bearer ${serviceKey}`;
  return h;
}

// Confirma que quem chama é um admin ativo
async function validarAdmin(event, { url, anonKey }) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) return null;

  const h = { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: h });
  if (!userRes.ok) return null;
  const user = await userRes.json();

  const perfilRes = await fetch(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active`,
    { headers: h }
  );
  if (!perfilRes.ok) return null;
  const [perfil] = await perfilRes.json();
  return perfil && perfil.is_active && perfil.role === 'admin' ? user : null;
}

// Grava no log de auditoria quem (admin) fez a ação — com a chave de servidor
async function registrarLog(cfg, admin, action, summary, details) {
  try {
    await fetch(`${cfg.url}/rest/v1/audit_logs`, {
      method: 'POST',
      headers: headersServico(cfg.serviceKey),
      body: JSON.stringify({
        user_id: admin.id,
        user_email: admin.email,
        action,
        entity: 'usuarios',
        summary,
        details: details || null
      })
    });
  } catch (e) {
    console.error('Falha ao gravar log de auditoria:', e);
  }
}

async function erroSupabase(res) {
  const texto = await res.text();
  try {
    const json = JSON.parse(texto);
    return json.msg || json.message || json.error_description || json.error || texto;
  } catch {
    return texto;
  }
}

async function criarUsuario(dados, cfg, admin) {
  const email = String(dados.email || '').trim().toLowerCase();
  const fullName = String(dados.full_name || '').trim();
  const role = dados.role;
  const password = String(dados.password || '');

  if (!email || !email.includes('@')) return resposta(400, { error: 'Informe um e-mail válido.' });
  if (!fullName) return resposta(400, { error: 'Informe o nome do usuário.' });
  if (!ROLES_VALIDOS.includes(role)) return resposta(400, { error: 'Perfil inválido.' });
  if (password.length < 8) return resposta(400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });

  const h = headersServico(cfg.serviceKey);

  const criarRes = await fetch(`${cfg.url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })
  });
  if (!criarRes.ok) {
    const msg = await erroSupabase(criarRes);
    const jaExiste = /already|registered|exists/i.test(msg);
    return resposta(jaExiste ? 409 : 400, {
      error: jaExiste ? 'Já existe um usuário com esse e-mail.' : `Não foi possível criar o usuário: ${msg}`
    });
  }
  const novo = await criarRes.json();

  // O trigger handle_new_user cria o perfil como 'consulta'; ajusta nome e perfil escolhidos.
  const perfilRes = await fetch(`${cfg.url}/rest/v1/profiles?id=eq.${novo.id}`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({ full_name: fullName, role, is_active: true })
  });
  if (!perfilRes.ok) {
    return resposta(500, {
      error: `Usuário criado, mas o perfil não foi ajustado: ${await erroSupabase(perfilRes)}`
    });
  }
  const [perfil] = await perfilRes.json();
  await registrarLog(cfg, admin, 'create_user', `Criou o usuário ${email}`, { email, role, full_name: fullName });
  return resposta(201, { profile: perfil });
}

async function redefinirSenha(dados, cfg, admin) {
  const id = String(dados.id || '');
  const password = String(dados.password || '');
  if (!id) return resposta(400, { error: 'Usuário não informado.' });
  if (password.length < 8) return resposta(400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });

  const res = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: headersServico(cfg.serviceKey),
    body: JSON.stringify({ password })
  });
  if (!res.ok) return resposta(400, { error: `Não foi possível redefinir a senha: ${await erroSupabase(res)}` });
  await registrarLog(cfg, admin, 'reset_password', `Redefiniu a senha de ${dados.email || id}`, { user_id: id });
  return resposta(200, { message: 'Senha redefinida.' });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resposta(200, {});
  if (event.httpMethod !== 'POST') return resposta(405, { error: 'Método não permitido.' });

  const cfg = config();
  if (!cfg.url || !cfg.anonKey || !cfg.serviceKey) {
    return resposta(500, { error: 'Supabase não configurado (URL, chave pública ou SUPABASE_SERVICE_ROLE_KEY ausente).' });
  }

  try {
    const admin = await validarAdmin(event, cfg);
    if (!admin) return resposta(403, { error: 'Apenas administradores podem gerenciar usuários.' });

    const dados = JSON.parse(event.body || '{}');
    if (dados.action === 'create') return await criarUsuario(dados, cfg, admin);
    if (dados.action === 'reset_password') return await redefinirSenha(dados, cfg, admin);
    return resposta(400, { error: 'Ação desconhecida.' });
  } catch (err) {
    console.error('Erro na função admin-users:', err);
    return resposta(500, { error: 'Erro interno ao gerenciar usuários.' });
  }
};
