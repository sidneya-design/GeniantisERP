const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

// Conecta o Netlify Blobs no ambiente local (`netlify dev`), que envia o
// contexto do sandbox dentro do evento Lambda. Em produção o evento não
// possui essa propriedade e a chamada é ignorada.
function conectarBlobs(event) {
  try {
    if (event && event.blobs) connectLambda(event);
  } catch (e) {
    // Segue com a configuração via variáveis de ambiente (produção)
  }
}

// Criptografar senha usando SHA-256 nativo
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Obter store do Netlify Blobs.
// Em alguns sites o contexto automático (siteID/token injetados pela Netlify)
// não chega até a function; nesse caso configuramos manualmente via env vars.
function obterStore(nome) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name: nome, siteID, token });
  }

  return getStore(nome);
}

// Iniciar os administradores padrão caso não existam
async function inicializarUsuariosSeNecessario(store) {
  const rawUsers = await store.get('usuarios');

  if (!rawUsers) {
    const defaultUsers = [
      { email: 'admin@demo.com', passwordHash: hashPassword('admin123'), role: 'admin' },
      { email: 'admin2@demo.com', passwordHash: hashPassword('admin123'), role: 'admin' },
      { email: 'admin3@demo.com', passwordHash: hashPassword('admin123'), role: 'viewer' }
    ];
    await store.set('usuarios', JSON.stringify(defaultUsers));
    console.log('[Auth] Usuários administradores inicializados.');
    return defaultUsers;
  }

  // As senhas são gerenciadas pelo painel; não sobrescrever usuários existentes
  return JSON.parse(rawUsers);
}

// Obter contatos do store
async function getContacts() {
  const store = obterStore('parabensflow-dados');
  const rawData = await store.get('contatos');
  return rawData ? JSON.parse(rawData) : [];
}

// Salvar contatos no store
async function saveContacts(contatos) {
  const store = obterStore('parabensflow-dados');
  await store.set('contatos', JSON.stringify(contatos));
}

// Obter configurações de e-mail do store
async function getConfig() {
  const store = obterStore('parabensflow-dados');
  const rawConfig = await store.get('configuracoes');
  const configs = rawConfig ? JSON.parse(rawConfig) : {};
  if (!configs.email_assunto) configs.email_assunto = 'Feliz Aniversário! 🎉';
  if (!configs.email_template) configs.email_template = 'Olá {{nome}},\n\nDesejamos a você um feliz aniversário! Que o seu dia seja repleto de alegria e realizações.\n\nParabéns! 🎂';
  return configs;
}

// Segredo usado para assinar os tokens de sessão.
// Usa JWT_SECRET dedicado; se ausente, cai para RESEND_API_KEY (compatibilidade
// com deploys existentes). Nunca usa um valor fixo hardcoded no código.
function obterSegredoToken() {
  const segredo = process.env.JWT_SECRET || process.env.RESEND_API_KEY;
  if (!segredo) {
    throw new Error('JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET no Netlify.');
  }
  return segredo;
}

// Gerar token assinado de sessão com role (expira em 24h)
function gerarToken(email, role) {
  const expiraEm = Date.now() + 1000 * 60 * 60 * 24; // 24 horas
  const payload = JSON.stringify({ email, role, expiraEm });

  const segredo = obterSegredoToken();
  const assinatura = crypto.createHmac('sha256', segredo).update(payload).digest('hex');
  
  const payloadBase64 = Buffer.from(payload).toString('base64');
  return `${payloadBase64}.${assinatura}`;
}

// Validar token vindo no header "Authorization: Bearer <token>"
function validarToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  
  try {
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    
    const [payloadBase64, assinaturaRecebida] = partes;
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    
    const segredo = obterSegredoToken();
    const assinaturaEsperada = crypto.createHmac('sha256', segredo).update(payloadStr).digest('hex');
    
    if (assinaturaRecebida !== assinaturaEsperada) {
      return null;
    }
    
    const payload = JSON.parse(payloadStr);
    if (Date.now() > payload.expiraEm) {
      return null; // Token expirado
    }
    
    return payload; // Retorna { email, role, expiraEm }
  } catch (e) {
    return null;
  }
}

// Helper para validar a requisição e retornar se está autenticado
async function autenticarRequisicao(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  return validarToken(authHeader);
}

module.exports = {
  hashPassword,
  conectarBlobs,
  obterStore,
  inicializarUsuariosSeNecessario,
  getContacts,
  saveContacts,
  getConfig,
  gerarToken,
  autenticarRequisicao
};
