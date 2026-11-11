// netlify/functions/utils/sender.js
// ---------------------------------------------------------------
// Integração com Gmail / Google Workspace via SMTP (nodemailer)
// ---------------------------------------------------------------

const nodemailer = require('nodemailer');
const { getContacts, saveContacts, getConfig } = require('./auth');

// Transporte SMTP do Gmail – autentica com a conta e a senha de app
// (GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis de ambiente).
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Substitui a variável {{nome}} pelo primeiro nome do contato.
 * @param {string} template - Texto do e‑mail com placeholders.
 * @param {string} fullName - Nome completo do contato.
 * @returns {string}
 */
function aplicarTemplate(template, fullName) {
  const primeiroNome = fullName.split(' ')[0] || fullName;
  return template.replace(/{{\s*nome\s*}}/gi, primeiroNome);
}

/**
 * Extrai o tipo MIME e os bytes de uma imagem enviada como data URL
 * (formato "data:image/png;base64,....").
 */
function decodificarImagemDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/**
 * Envia um e‑mail usando a conta Gmail configurada.
 * @param {string} to          – endereço de e‑mail do destinatário
 * @param {string} subject     – assunto
 * @param {string} htmlContent – corpo em HTML (ou texto simples)
 * @param {object} [opcoes]
 * @param {string} [opcoes.imagemDataUrl] – imagem opcional (data URL) a embutir no topo do e‑mail
 * @param {string} [opcoes.cc]  – cópia (separada por vírgula)
 * @param {string} [opcoes.bcc] – cópia oculta (separada por vírgula)
 * @returns {Promise<object>}
 */
async function enviarEmail(to, subject, htmlContent, opcoes = {}) {
  const { imagemDataUrl, cc, bcc } = opcoes;
  try {
    const imagem = decodificarImagemDataUrl(imagemDataUrl);
    const attachments = [];
    let corpoFinal = htmlContent;

    if (imagem) {
      attachments.push({
        filename: 'imagem-email',
        content: imagem.buffer,
        cid: 'imagemEmail',
      });
      corpoFinal = `${htmlContent}<br><br><img src="cid:imagemEmail" alt="" style="max-width:100%;">`;
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      html: corpoFinal,
      attachments,
    });
    return { success: true, data: info };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function ehBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

/**
 * Retorna a data atual (ano, mês, dia) no horário de Brasília,
 * independente do fuso horário do servidor onde a function roda.
 */
function obterDataAtualBrasilia() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const mapa = {};
  partes.forEach(p => { mapa[p.type] = p.value; });

  return { ano: Number(mapa.year), mes: mapa.month, dia: mapa.day };
}

/**
 * Verifica se a data de nascimento (YYYY-MM-DD) cai no dia de hoje.
 * Nascidos em 29/fev comemoram em 28/fev nos anos não bissextos,
 * já que essa data não existe nesses anos.
 */
function fazAniversarioHoje(dataNascimento, hoje) {
  if (!dataNascimento) return false;
  const partes = dataNascimento.split('-'); // YYYY-MM-DD
  if (partes.length !== 3) return false;

  const [, mesNasc, diaNasc] = partes;
  if (mesNasc === hoje.mes && diaNasc === hoje.dia) return true;

  if (mesNasc === '02' && diaNasc === '29' && hoje.mes === '02' && hoje.dia === '28' && !ehBissexto(hoje.ano)) {
    return true;
  }

  return false;
}

/**
 * Processa o disparo de e‑mails para todos os aniversariantes do dia.
 * É chamado pela função Netlify `trigger‑manual.js`.
 *
 * @returns {Promise<object>} resumo do disparo
 */
async function processarEnvioAniversarios() {
  // 1️⃣ Carrega contatos e configuração do template
  const contatos = await getContacts();
  const { email_assunto, email_template, email_imagem, email_cc, email_cco } = await getConfig();

  // 2️⃣ Seleciona quem faz aniversário hoje e ainda não recebeu e‑mail este ano
  const hoje = obterDataAtualBrasilia();
  const aniversariantes = contatos.filter(c =>
    fazAniversarioHoje(c.data_nascimento, hoje) && c.ultimo_envio_ano !== hoje.ano
  );

  // 3️⃣ Envia e‑mails
  const resultados = [];
  for (const contato of aniversariantes) {
    const assunto = aplicarTemplate(email_assunto, contato.nome);
    const corpo   = aplicarTemplate(email_template, contato.nome);

    const envio = await enviarEmail(contato.email, assunto, corpo, {
      imagemDataUrl: email_imagem,
      cc: email_cc,
      bcc: email_cco,
    });
    resultados.push({
      email: contato.email,
      nome: contato.nome,
      enviado: !!envio.success,
      detalhe: envio.success ? envio.data : envio.error,
    });

    // Marca o contato como já contemplado neste ano, evitando reenvio
    // em caso de retry do cron ou disparo manual no mesmo dia.
    if (envio.success) {
      contato.ultimo_envio_ano = hoje.ano;
    }
  }

  if (resultados.some(r => r.enviado)) {
    await saveContacts(contatos);
  }

  // 4️⃣ Retorna resumo
  return {
    totalAniversariantes: aniversariantes.length,
    enviados: resultados.filter(r => r.enviado).length,
    falhas: resultados.filter(r => !r.enviado).length,
    detalhes: resultados,
  };
}

module.exports = { processarEnvioAniversarios };
