const { processarEnvioAniversarios } = require('./utils/sender');
const { conectarBlobs } = require('./utils/auth');

exports.handler = async (event, context) => {
  conectarBlobs(event);
  try {
    const res = await processarEnvioAniversarios();
    console.log('[Scheduler] Disparo diário automático concluído:', res.message);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: res.message })
    };
  } catch (err) {
    console.error('[Scheduler] Falha na execução agendada:', err.message);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
