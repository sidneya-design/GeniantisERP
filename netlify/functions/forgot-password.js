// "Esqueci minha senha": gera um link de redefinição no Supabase e envia pelo
// Gmail corporativo (o e-mail padrão do Supabase tem limite de poucos envios/hora).
// Sempre responde a mesma mensagem, exista ou não o e-mail, para não revelar
// quem tem conta no ERP.

const { enviarEmail } = require('./utils/sender');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const MENSAGEM = 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha em alguns minutos.';
const PERFIS_COM_LOGIN = ['admin', 'adm', 'ti', 'rh'];

// Freio simples contra abuso: 1 pedido por e-mail a cada 2 min (por instância)
const ultimosPedidos = new Map();

function resposta(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resposta(200, {});
  if (event.httpMethod !== 'POST') return resposta(405, { error: 'Método não permitido.' });

  let email = '';
  try {
    email = String(JSON.parse(event.body || '{}').email || '').trim().toLowerCase();
  } catch {
    return resposta(400, { error: 'Requisição inválida.' });
  }
  if (!email || !email.includes('@') || email.length > 255) {
    return resposta(400, { error: 'Informe um e-mail válido.' });
  }

  const agora = Date.now();
  if (agora - (ultimosPedidos.get(email) || 0) < 120000) return resposta(200, { message: MENSAGEM });
  ultimosPedidos.set(email, agora);

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const chave = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  // Endereço do próprio site (definido pela Netlify), nunca o que vem na requisição
  const site = (process.env.URL || 'https://admgeniantis.netlify.app').replace(/\/+$/, '');
  if (!url || !chave) {
    console.error('[forgot-password] Supabase não configurado.');
    return resposta(200, { message: MENSAGEM });
  }

  const h = { apikey: chave, 'Content-Type': 'application/json' };
  if (chave.startsWith('eyJ')) h.Authorization = `Bearer ${chave}`;

  try {
    // Só envia para usuários ativos com perfil que pode entrar no ERP
    const perfilRes = await fetch(
      `${url}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=full_name,role,is_active`,
      { headers: h }
    );
    const [perfil] = perfilRes.ok ? await perfilRes.json() : [];
    if (!perfil || !perfil.is_active || !PERFIS_COM_LOGIN.includes(perfil.role)) {
      return resposta(200, { message: MENSAGEM });
    }

    const linkRes = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ type: 'recovery', email, redirect_to: `${site}/redefinir-senha` })
    });
    if (!linkRes.ok) {
      console.error('[forgot-password] generate_link falhou:', linkRes.status, await linkRes.text());
      return resposta(200, { message: MENSAGEM });
    }
    const link = await linkRes.json();
    const actionLink = link.action_link || (link.properties && link.properties.action_link);
    if (!actionLink) {
      console.error('[forgot-password] generate_link sem action_link.');
      return resposta(200, { message: MENSAGEM });
    }

    const nome = escapeHtml((perfil.full_name || '').split(' ')[0] || 'olá');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1e293b">
        <h2 style="color:#1e293b">Redefinição de senha — GeniantisERP</h2>
        <p>Olá, ${nome}!</p>
        <p>Recebemos um pedido para criar uma nova senha para a sua conta no GeniantisERP.</p>
        <p style="margin:28px 0">
          <a href="${actionLink}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">
            Criar nova senha
          </a>
        </p>
        <p style="font-size:13px;color:#64748b">O link vale por 1 hora e só pode ser usado uma vez.
        Se você não pediu, ignore este e-mail — sua senha atual continua valendo.</p>
      </div>`;

    const envio = await enviarEmail(email, 'Redefinição de senha — GeniantisERP', html);
    if (!envio.success) console.error('[forgot-password] Falha no envio:', envio.error);
  } catch (err) {
    console.error('[forgot-password] Erro:', err);
  }

  return resposta(200, { message: MENSAGEM });
};
