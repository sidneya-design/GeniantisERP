const { autenticarRequisicao, obterStore, conectarBlobs } = require('./utils/auth');

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
        body: JSON.stringify({ error: 'Acesso negado. Token de sessão inválido ou expirado.' })
      };
    }

    const store = obterStore('parabensflow-dados');
    const { httpMethod } = event;

    // GET: Retornar as configurações
    if (httpMethod === 'GET') {
      const rawConfig = await store.get('configuracoes');
      const configs = rawConfig ? JSON.parse(rawConfig) : {};

      // Valores padrão de segurança caso o blob esteja vazio
      if (!configs.email_assunto) configs.email_assunto = 'Feliz Aniversário! 🎉';
      if (!configs.email_template) configs.email_template = 'Olá {{nome}},\n\nDesejamos a você um feliz aniversário! Que o seu dia seja repleto de alegria e realizações.\n\nParabéns! 🎂';

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(configs)
      };
    }

    // POST: Salvar ou atualizar as configurações enviadas
    if (httpMethod === 'POST') {
      if (adminSession.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Acesso negado. Seu perfil possui apenas permissão de visualização.' })
        };
      }
      const body = JSON.parse(event.body || '{}');

      // Obter configs atuais
      const rawConfig = await store.get('configuracoes');
      const configsAtuais = rawConfig ? JSON.parse(rawConfig) : {};

      // Mesclar novas chaves com as antigas e salvar
      const novasConfigs = { ...configsAtuais, ...body };
      await store.set('configuracoes', JSON.stringify(novasConfigs));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Configurações salvas com sucesso!' })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: `Método ${httpMethod} não suportado.` })
    };

  } catch (err) {
    console.error('Erro na função config:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
