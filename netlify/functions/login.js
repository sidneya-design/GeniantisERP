const { hashPassword, inicializarUsuariosSeNecessario, gerarToken, obterStore, conectarBlobs } = require('./utils/auth');

exports.handler = async (event, context) => {
  conectarBlobs(event);
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: `Método ${event.httpMethod} não permitido.` })
    };
  }

  try {
    const { email, password } = JSON.parse(event.body || '{}');

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'E-mail e senha são obrigatórios.' })
      };
    }

    const store = obterStore('parabensflow-dados');
    
    // Obter usuários (cria o admin inicial via env vars no primeiro acesso)
    const usuarios = await inicializarUsuariosSeNecessario(store);

    // Buscar o usuário correspondente
    const usuario = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!usuario) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'E-mail ou senha incorretos.' })
      };
    }

    // Verificar senha
    const envSenhaHash = hashPassword(password);
    if (usuario.passwordHash !== envSenhaHash) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'E-mail ou senha incorretos.' })
      };
    }

    // Gerar token com o papel correspondente
    const token = gerarToken(usuario.email, usuario.role || 'viewer');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Autenticado com sucesso!',
        email: usuario.email,
        role: usuario.role || 'viewer',
        token
      })
    };

  } catch (err) {
    console.error('Erro na função login:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
