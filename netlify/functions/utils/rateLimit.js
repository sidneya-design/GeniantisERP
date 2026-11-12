// Limite de tentativas guardado no Netlify Blobs (vale para todas as instâncias
// da function, ao contrário de um contador em memória).
const { obterStore } = require('./auth');

/**
 * Registra uma tentativa para `chave` e diz se ainda está dentro do limite.
 * @returns {Promise<boolean>} true = pode seguir; false = limite atingido
 */
async function permitir(chave, limite, janelaMs) {
  try {
    const store = obterStore('seguranca');
    const agora = Date.now();
    const raw = await store.get(chave);
    const tentativas = (raw ? JSON.parse(raw) : []).filter((t) => agora - t < janelaMs);
    if (tentativas.length >= limite) return false;
    tentativas.push(agora);
    await store.set(chave, JSON.stringify(tentativas));
    return true;
  } catch (e) {
    console.error('[rateLimit] Falha ao consultar o limite (seguindo sem bloquear):', e.message);
    return true;
  }
}

function ipDaRequisicao(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
}

module.exports = { permitir, ipDaRequisicao };
