const { processarEnvioAniversarios } = require('./utils/sender');
const { autenticarRequisicao, conectarBlobs } = require('./utils/auth');

exports.handler = async (event, context) => {
  conectarBlobs(event);
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. Validar autenticação do administrador
    const adminSession = await autenticarRequisicao(event);
    if (!adminSession) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Não autorizado. Faça login novamente.' })
      };
    }

    // Bloquear disparo manual para visualizadores
    if (adminSession.role !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Acesso negado. Seu perfil possui apenas permissão de visualização.' })
      };
    }

    // 2. Processar envio de e-mails
    const res = await processarEnvioAniversarios(`manual:${adminSession.email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(res)
    };

  } catch (err) {
    console.error('Erro na função trigger-manual:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
