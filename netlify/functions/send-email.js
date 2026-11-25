// E-mails disparados pelo ERP (usuário logado no Supabase):
//   test   — e-mail de teste (Admin)
//   term   — envia o PDF do termo assinado ao funcionário (quem edita Entregas)
//   image_term — envia a licença de uso de imagem assinada ao funcionário (quem edita Funcionários ou Termos)
//   alerts — prévia (dry_run) ou envio agora dos alertas de vencimento (Admin)
//   broadcast_sender — endereço da conta que envia os comunicados (sem senha)
//   broadcast_test  — comunicado de teste para quem está montando (quem envia Comunicados)
//   broadcast_batch — envia o próximo lote de um comunicado (quem envia Comunicados)
//   agenda_notify   — envia por e-mail os avisos da agenda que a própria pessoa gerou (quem usa a Agenda)
//   agenda_external_invite — convite por e-mail aos convidados de fora do ERP (quem edita o evento)

const { usuarioDaRequisicao, temModulo, enviarTeste, enviarTermo, enviarTermoImagem, processarAlertas, enviarComunicadoTeste, enviarLoteComunicado, remetenteComunicados, enviarAvisosAgenda, enviarConvitesExternos } = require('./utils/erpEmail');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const resposta = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resposta(200, {});
  if (event.httpMethod !== 'POST') return resposta(405, { error: 'Método não permitido.' });

  try {
    const sessao = await usuarioDaRequisicao(event);
    if (!sessao) return resposta(401, { error: 'Sessão expirada. Entre novamente.' });

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return resposta(400, { error: 'Requisição inválida.' });
    }
    const isAdmin = sessao.profile.role === 'admin';

    switch (body.action) {
      case 'test': {
        if (!isAdmin) return resposta(403, { error: 'Apenas administradores podem enviar o teste.' });
        const para = String(body.to || sessao.user.email || '').trim();
        if (!EMAIL_VALIDO.test(para)) return resposta(400, { error: 'Informe um e-mail válido.' });
        return resposta(200, await enviarTeste(sessao, para));
      }
      case 'term': {
        if (!body.movement_id) return resposta(400, { error: 'Movimentação não informada.' });
        if (!(await temModulo(sessao, 'movements', 2))) {
          return resposta(403, { error: 'Você não tem permissão para enviar termos.' });
        }
        return resposta(200, await enviarTermo(sessao, String(body.movement_id)));
      }
      case 'image_term': {
        if (!body.employee_id) return resposta(400, { error: 'Funcionário não informado.' });
        if (!(await temModulo(sessao, 'employees', 2)) && !(await temModulo(sessao, 'documents', 2))) return resposta(403, { error: 'Você não tem permissão para enviar este termo.' });
        return resposta(200, await enviarTermoImagem(sessao, String(body.employee_id)));
      }
      case 'alerts': {
        if (!isAdmin) return resposta(403, { error: 'Apenas administradores podem disparar os alertas.' });
        return resposta(200, await processarAlertas({ sessao, dryRun: !!body.dry_run }));
      }
      case 'broadcast_sender': {
        if (!(await temModulo(sessao, 'communications', 1)) && !isAdmin) return resposta(403, { error: 'Sem acesso.' });
        return resposta(200, remetenteComunicados());
      }
      case 'broadcast_test': {
        if (!(await temModulo(sessao, 'communications', 2))) return resposta(403, { error: 'Você não tem permissão para enviar comunicados.' });
        return resposta(200, await enviarComunicadoTeste(sessao, body));
      }
      case 'broadcast_batch': {
        if (!body.communication_id) return resposta(400, { error: 'Comunicado não informado.' });
        if (!(await temModulo(sessao, 'communications', 2))) return resposta(403, { error: 'Você não tem permissão para enviar comunicados.' });
        return resposta(200, await enviarLoteComunicado(sessao, String(body.communication_id), { retryFailed: !!body.retry_failed }));
      }
      case 'agenda_notify': {
        if (!(await temModulo(sessao, 'agenda', 1))) return resposta(403, { error: 'Sem acesso à agenda.' });
        return resposta(200, await enviarAvisosAgenda(sessao));
      }
      case 'agenda_external_invite': {
        if (!body.event_id) return resposta(400, { error: 'Evento não informado.' });
        if (!(await temModulo(sessao, 'agenda', 1))) return resposta(403, { error: 'Sem acesso à agenda.' });
        try {
          return resposta(200, await enviarConvitesExternos(sessao, String(body.event_id), { reenviar: !!body.resend }));
        } catch (e) {
          if (e.status === 403) return resposta(403, { error: e.message });
          throw e;
        }
      }
      default:
        return resposta(400, { error: 'Ação desconhecida.' });
    }
  } catch (err) {
    console.error('Erro na função send-email:', err);
    return resposta(500, { error: err.message || 'Erro interno ao enviar e-mail.' });
  }
};
