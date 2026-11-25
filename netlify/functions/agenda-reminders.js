// Lembretes da agenda (agendado no netlify.toml a cada 5 minutos).
// Avisa no sino e por e-mail quem criou o evento, os convidados do ERP e o responsável pela atividade.

const { processarLembretesAgenda } = require('./utils/erpEmail');

exports.handler = async () => {
  try {
    const res = await processarLembretesAgenda();
    if (res.lembretes) console.log('[Lembretes] Enviados:', JSON.stringify(res));
    return { statusCode: 200, body: JSON.stringify(res) };
  } catch (err) {
    console.error('[Lembretes] Falha:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
