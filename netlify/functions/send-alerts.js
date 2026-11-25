// Disparo diário dos alertas de vencimento (agendado no netlify.toml).
// Liga/desliga, destinatários e faixas de dias ficam em Configurações › E-mails.

const { processarAlertas } = require('./utils/erpEmail');

exports.handler = async () => {
  try {
    const res = await processarAlertas();
    console.log('[Alertas] Execução diária concluída:', res.message);
    return { statusCode: 200, body: JSON.stringify({ message: res.message }) };
  } catch (err) {
    console.error('[Alertas] Falha na execução agendada:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
