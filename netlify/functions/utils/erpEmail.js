// netlify/functions/utils/erpEmail.js
// ---------------------------------------------------------------
// E-mails do ERP: configurações (tabela email_settings), alertas de
// vencimento e termo assinado por e-mail. Usa a chave de servidor do
// Supabase (SUPABASE_SERVICE_ROLE_KEY), que nunca vai para o navegador.
// ---------------------------------------------------------------

const { enviarEmail, contaComunicados } = require('./sender');

const TZ = 'America/Sao_Paulo';

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  }
  return { url, anonKey, serviceKey };
}

function headersServico(serviceKey, extra = {}) {
  const h = { apikey: serviceKey, 'Content-Type': 'application/json', ...extra };
  // Chaves legadas (JWT) também precisam ir no Authorization
  if (serviceKey.startsWith('eyJ')) h.Authorization = `Bearer ${serviceKey}`;
  return h;
}

async function erroDe(res) {
  const texto = await res.text();
  try {
    const json = JSON.parse(texto);
    return json.message || json.msg || json.error || texto;
  } catch {
    return texto;
  }
}

/** GET/POST/PATCH na API REST do Supabase com a chave de servidor */
async function rest(path, { method = 'GET', body, prefer } = {}) {
  const cfg = supabaseConfig();
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: headersServico(cfg.serviceKey, prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase (HTTP ${res.status}): ${await erroDe(res)}`);
  const texto = await res.text();
  return texto ? JSON.parse(texto) : null;
}

// ---------- Quem está chamando (functions HTTP) ----------

/**
 * Valida o token de sessão do Supabase enviado pelo ERP e devolve
 * { user, profile, token }, ou null se não for um usuário ativo.
 */
async function usuarioDaRequisicao(event) {
  const cfg = supabaseConfig();
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  // Cada recusa registra o motivo no log da function (sem token nem chave), para diagnóstico
  const recusar = (motivo) => { console.error(`[send-email] Login recusado: ${motivo}`); return null; };
  if (!token) return recusar('requisição sem token');
  if (!cfg.anonKey) return recusar('SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY ausente na Netlify');

  const h = { apikey: cfg.anonKey, Authorization: `Bearer ${token}` };
  const userRes = await fetch(`${cfg.url}/auth/v1/user`, { headers: h });
  if (!userRes.ok) return recusar(`auth/v1/user respondeu HTTP ${userRes.status}: ${(await userRes.text()).slice(0, 200)}`);
  const user = await userRes.json();

  const perfilRes = await fetch(
    `${cfg.url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_active,full_name,email`,
    { headers: h },
  );
  if (!perfilRes.ok) return recusar(`leitura do perfil respondeu HTTP ${perfilRes.status}: ${(await perfilRes.text()).slice(0, 200)}`);
  const [profile] = await perfilRes.json();
  if (!profile) return recusar(`perfil não encontrado para o usuário ${user.id}`);
  if (!profile.is_active) return recusar(`perfil inativo (${user.id})`);
  return { user, profile, token };
}

/** Confere no banco (has_module) se o usuário tem o nível pedido no módulo */
async function temModulo(sessao, modulo, nivel) {
  const cfg = supabaseConfig();
  const res = await fetch(`${cfg.url}/rest/v1/rpc/has_module`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${sessao.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_module: modulo, p_level: nivel }),
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

// ---------- Configurações e montagem do e-mail ----------

const PADRAO = {
  sender_name: 'Geniantis ERP',
  reply_to: '',
  signature: '',
  alerts_enabled: false,
  alert_recipients: [],
  alert_days: [30, 7, 1],
  alert_domains: true,
  alert_contracts: true,
  alert_subscriptions: true,
  alert_maintenance: true,
  term_email_enabled: true,
  comm_sender_name: 'RH Geniantis',
  comm_reply_to: '',
  comm_signature: '',
  term_subject: 'Seu termo de {{tipo}} de equipamentos',
  term_body: 'Olá, {{nome}}!\n\nSegue em anexo a cópia do termo de {{tipo}} assinado em {{data}}, referente aos itens:\n\n{{itens}}\n\nGuarde este e-mail para sua referência.',
};

async function carregarConfiguracoes() {
  const [linha] = (await rest('email_settings?id=eq.1&select=*')) || [];
  return { ...PADRAO, ...(linha || {}) };
}

function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Texto simples digitado na tela → HTML (escapa e mantém as quebras de linha) */
function textoParaHtml(texto) {
  return escapar(texto).replace(/\r?\n/g, '<br>');
}

/** Moldura comum: corpo + assinatura das configurações */
function montarHtml(corpoHtml, config) {
  const assinatura = config.signature
    ? `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;color:#475569;font-size:13px">${textoParaHtml(config.signature)}</p>`
    : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;max-width:640px">${corpoHtml}${assinatura}</div>`;
}

function opcoesRemetente(config) {
  return { fromName: config.sender_name || undefined, replyTo: config.reply_to || undefined };
}

// ---------- Datas (sempre no horário de Brasília) ----------

function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function diasEntre(deISO, ateISO) {
  return Math.round((Date.parse(`${ateISO}T00:00:00Z`) - Date.parse(`${deISO}T00:00:00Z`)) / 86400000);
}

function somarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// ---------- Log de auditoria ----------

async function registrarLog(linhas) {
  try {
    await rest('audit_logs', { method: 'POST', body: linhas, prefer: 'return=minimal' });
  } catch (e) {
    console.error('Falha ao gravar envio no log:', e.message);
  }
}

function linhaLog({ sessao, ok, resumo, entityId, detalhes }) {
  return {
    user_id: sessao ? sessao.user.id : null,
    user_email: sessao ? sessao.user.email : 'sistema',
    user_name: sessao ? sessao.profile.full_name || null : null,
    action: ok ? 'email_sent' : 'email_failed',
    entity: 'emails',
    entity_id: entityId || null,
    summary: resumo,
    details: detalhes || null,
  };
}

// ---------- E-mail de teste ----------

async function enviarTeste(sessao, para) {
  const config = await carregarConfiguracoes();
  const html = montarHtml(
    `<p>Olá!</p><p>Este é um e-mail de teste do <strong>Geniantis ERP</strong>, enviado por ${escapar(sessao.profile.full_name || sessao.user.email)} em ${escapar(new Date().toLocaleString('pt-BR', { timeZone: TZ }))}.</p><p>Se você recebeu esta mensagem, o envio está funcionando.</p>`,
    config,
  );
  const envio = await enviarEmail(para, 'Teste de envio — Geniantis ERP', html, opcoesRemetente(config));
  await registrarLog([linhaLog({
    sessao,
    ok: envio.success,
    resumo: `${envio.success ? 'E-mail de teste enviado para' : 'Falha no e-mail de teste para'} ${para}`,
    detalhes: { tipo: 'teste', email: para, ...(envio.success ? {} : { erro: envio.error }) },
  })]);
  if (!envio.success) throw new Error(`Não foi possível enviar: ${envio.error}`);
  return { to: para };
}

// ---------- Termo assinado por e-mail ----------

function descricaoAtivo(asset) {
  if (!asset) return '';
  return [asset.brand, asset.model].filter(Boolean).join(' ') || asset.category || '';
}

async function enviarTermo(sessao, movimentoId) {
  const config = await carregarConfiguracoes();
  if (!config.term_email_enabled) {
    throw new Error('O envio do termo por e-mail está desativado em Configurações › E-mails.');
  }

  const [mov] = (await rest(
    `asset_movements?id=eq.${encodeURIComponent(movimentoId)}&select=id,type,movement_date,term_status,term_file_path,term_file_name,employee:employees(full_name,preferential_name,email),asset_movement_items(asset:assets(patrimony,brand,model,category))`,
  )) || [];
  if (!mov) throw new Error('Movimentação não encontrada.');
  if (!mov.term_file_path || mov.term_file_path.startsWith('data:')) {
    throw new Error('Esta movimentação ainda não tem o PDF do termo assinado anexado.');
  }
  const funcionario = Array.isArray(mov.employee) ? mov.employee[0] : mov.employee;
  const para = funcionario && String(funcionario.email || '').trim();
  if (!para) throw new Error('O funcionário não tem e-mail no cadastro.');

  // Baixa o PDF do bucket privado
  const cfg = supabaseConfig();
  const caminho = caminhoArquivoSeguro(mov.term_file_path);
  const pdfRes = await fetch(`${cfg.url}/storage/v1/object/asset-terms/${caminho}`, { headers: headersServico(cfg.serviceKey) });
  if (!pdfRes.ok) throw new Error(`Não foi possível ler o PDF do termo (HTTP ${pdfRes.status}).`);
  const pdf = Buffer.from(await pdfRes.arrayBuffer());

  const nome = (funcionario.preferential_name || funcionario.full_name || '').trim();
  const primeiroNome = nome.split(' ')[0] || nome;
  const tipo = mov.type === 'entrega' ? 'entrega' : 'devolução';
  const itens = (mov.asset_movement_items || [])
    .map((i) => (Array.isArray(i.asset) ? i.asset[0] : i.asset))
    .filter(Boolean)
    .map((a) => `• ${a.patrimony}${descricaoAtivo(a) ? ` — ${descricaoAtivo(a)}` : ''}`);

  const valores = { nome: primeiroNome, nome_completo: funcionario.full_name || nome, tipo, data: dataBR(mov.movement_date), itens: itens.join('\n') };
  const aplicar = (texto) => String(texto || '').replace(/{{\s*(\w+)\s*}}/g, (m, chave) => (chave in valores ? valores[chave] : m));

  const assunto = aplicar(config.term_subject).replace(/\s+/g, ' ').trim() || `Termo de ${tipo}`;
  const html = montarHtml(`<p style="margin:0">${textoParaHtml(aplicar(config.term_body))}</p>`, config);
  const nomeArquivo = mov.term_file_name || `termo-${mov.type}.pdf`;

  const envio = await enviarEmail(para, assunto, html, {
    ...opcoesRemetente(config),
    attachments: [{ filename: nomeArquivo, content: pdf, contentType: 'application/pdf' }],
  });

  await registrarLog([linhaLog({
    sessao,
    ok: envio.success,
    entityId: mov.id,
    resumo: `${envio.success ? 'Termo de' : 'Falha ao enviar termo de'} ${tipo} ${envio.success ? 'enviado para' : 'para'} ${nome} (${para})`,
    detalhes: { tipo: 'termo', movimentacao: mov.id, email: para, nome, ...(envio.success ? {} : { erro: envio.error }) },
  })]);
  if (!envio.success) throw new Error(`Não foi possível enviar: ${envio.error}`);

  const enviadoEm = new Date().toISOString();
  await rest(`asset_movements?id=eq.${encodeURIComponent(mov.id)}`, {
    method: 'PATCH',
    body: { term_emailed_at: enviadoEm, term_emailed_to: para },
    prefer: 'return=minimal',
  });
  return { to: para, sent_at: enviadoEm };
}

// ---------- Licença de uso de imagem por e-mail ----------

async function enviarTermoImagem(sessao, funcionarioId) {
  const config = await carregarConfiguracoes();
  const id = encodeURIComponent(funcionarioId);
  const [termo] = (await rest(`employee_image_terms?employee_id=eq.${id}&select=status,signed_at,file_path,file_name`)) || [];
  if (!termo || !termo.file_path) throw new Error('Anexe o PDF assinado antes de enviar.');
  const [func] = (await rest(`employees?id=eq.${id}&select=full_name,preferential_name,email`)) || [];
  const para = func && String(func.email || '').trim();
  if (!para) throw new Error('O funcionário não tem e-mail no cadastro.');

  const cfg = supabaseConfig();
  const caminho = caminhoArquivoSeguro(termo.file_path);
  const pdfRes = await fetch(`${cfg.url}/storage/v1/object/employee-documents/${caminho}`, { headers: headersServico(cfg.serviceKey) });
  if (!pdfRes.ok) throw new Error(`Não foi possível ler o PDF (HTTP ${pdfRes.status}).`);
  const pdf = Buffer.from(await pdfRes.arrayBuffer());

  const nome = (func.preferential_name || func.full_name || '').trim();
  const primeiro = nome.split(/\s+/)[0] || nome;
  const quando = termo.signed_at ? ` em ${dataBR(termo.signed_at)}` : '';
  const html = montarHtml(
    `<p style="margin:0 0 14px">Olá, ${escapar(primeiro)}!</p><p style="margin:0 0 14px">Segue em anexo a cópia da sua <strong>Licença de Uso de Imagem</strong>, assinada${escapar(quando)}.</p><p style="margin:0">Guarde este e-mail para sua referência.</p>`,
    config,
  );
  const envio = await enviarEmail(para, 'Sua licença de uso de imagem', html, {
    ...opcoesRemetente(config),
    attachments: [{ filename: termo.file_name || 'licenca-uso-de-imagem.pdf', content: pdf, contentType: 'application/pdf' }],
  });

  await registrarLog([linhaLog({
    sessao,
    ok: envio.success,
    entityId: funcionarioId,
    resumo: `${envio.success ? 'Licença de uso de imagem enviada para' : 'Falha ao enviar licença de uso de imagem para'} ${nome} (${para})`,
    detalhes: { tipo: 'termo_imagem', email: para, nome, ...(envio.success ? {} : { erro: envio.error }) },
  })]);
  if (!envio.success) throw new Error(`Não foi possível enviar: ${envio.error}`);

  const enviadoEm = new Date().toISOString();
  await rest(`employee_image_terms?employee_id=eq.${id}`, {
    method: 'PATCH', body: { emailed_at: enviadoEm, emailed_to: para }, prefer: 'return=minimal',
  });
  return { to: para, sent_at: enviadoEm };
}

// ---------- Alertas de vencimento ----------

/**
 * Faixa de aviso em que a data cai hoje: a menor faixa configurada que já
 * foi alcançada (ex.: faltam 5 dias com faixas 30/7/1 → faixa 7).
 * Vencido → 'vencido'. Fora de todas as faixas → null.
 */
function faixaAtual(diasRestantes, faixas) {
  if (diasRestantes < 0) return 'vencido';
  const alcancadas = faixas.filter((f) => diasRestantes <= f);
  return alcancadas.length ? Math.min(...alcancadas) : null;
}

function textoPrazo(dias) {
  if (dias < 0) return `venceu há ${-dias} dia(s)`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `faltam ${dias} dias`;
}

/** Lista o que está para vencer hoje, conforme as configurações */
async function coletarAlertas(config) {
  const hoje = hojeISO();
  const faixas = (config.alert_days || []).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  const maiorFaixa = faixas.length ? Math.max(...faixas) : 0;
  const limite = somarDias(hoje, maiorFaixa);
  const itens = [];

  const adicionar = (grupo, id, vencimento, titulo, detalhe) => {
    const dias = diasEntre(hoje, vencimento);
    const faixa = faixaAtual(dias, faixas);
    if (faixa === null) return;
    itens.push({ grupo, key: `${grupo}:${id}:${vencimento}:${faixa}`, titulo, detalhe, vencimento, dias, prazo: textoPrazo(dias) });
  };

  if (config.alert_domains) {
    const dominios = await rest(`domains?select=id,domain,registrar,auto_renew,expiration_date&status=eq.ativo&expiration_date=lte.${limite}&order=expiration_date`);
    for (const d of dominios || []) {
      adicionar('dominio', d.id, d.expiration_date, d.domain,
        [d.registrar, d.auto_renew ? 'renovação automática' : 'renovação manual'].filter(Boolean).join(' · '));
    }
  }

  if (config.alert_contracts) {
    // Com aviso prévio, a data que importa é o último dia para avisar o fornecedor
    const contratos = await rest('supplier_contracts?select=id,name,contract_number,end_date,notice_days,auto_renew,supplier:suppliers(name)&status=eq.vigente&end_date=not.is.null&order=end_date');
    for (const c of contratos || []) {
      const aviso = Number(c.notice_days) > 0 ? somarDias(c.end_date, -Number(c.notice_days)) : null;
      const prazo = aviso || c.end_date;
      if (prazo > limite) continue;
      const fornecedor = Array.isArray(c.supplier) ? c.supplier[0] : c.supplier;
      adicionar('contrato', c.id, prazo, `${fornecedor ? `${fornecedor.name} — ` : ''}${c.name}`,
        [
          c.contract_number ? `nº ${c.contract_number}` : '',
          `término ${dataBR(c.end_date)}`,
          aviso ? `aviso prévio de ${c.notice_days} dias (avisar até ${dataBR(aviso)})` : '',
          c.auto_renew ? 'renova automaticamente' : '',
        ].filter(Boolean).join(' · '));
    }
  }

  if (config.alert_subscriptions) {
    const assinaturas = await rest(`subscriptions?select=id,service_name,provider,amount,auto_renew,renewal_date&status=eq.ativa&renewal_date=lte.${limite}&order=renewal_date`);
    for (const s of assinaturas || []) {
      const valor = Number(s.amount) ? Number(s.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
      adicionar('assinatura', s.id, s.renewal_date, s.service_name,
        [s.provider, valor, s.auto_renew ? 'renovação automática' : 'renovação manual'].filter(Boolean).join(' · '));
    }
  }

  if (config.alert_maintenance) {
    // Manutenção em andamento com a previsão de retorno já passada (avisa uma vez por previsão)
    const manutencoes = await rest(`maintenance_orders?select=id,issue,provider,forecast_date,asset:assets(patrimony,brand,model,category)&status=eq.em_andamento&forecast_date=lt.${hoje}&order=forecast_date`);
    for (const m of manutencoes || []) {
      const ativo = Array.isArray(m.asset) ? m.asset[0] : m.asset;
      const dias = diasEntre(hoje, m.forecast_date);
      itens.push({
        grupo: 'manutencao',
        key: `manutencao:${m.id}:${m.forecast_date}:atrasada`,
        titulo: ativo ? `${ativo.patrimony}${descricaoAtivo(ativo) ? ` — ${descricaoAtivo(ativo)}` : ''}` : 'Ativo',
        detalhe: [m.issue, m.provider].filter(Boolean).join(' · '),
        vencimento: m.forecast_date,
        dias,
        prazo: `previsão passou há ${-dias} dia(s)`,
      });
    }
  }

  return itens;
}

const GRUPOS = [
  { id: 'dominio', titulo: 'Domínios' },
  { id: 'contrato', titulo: 'Contratos de fornecedores' },
  { id: 'assinatura', titulo: 'Assinaturas e licenças' },
  { id: 'manutencao', titulo: 'Manutenções com previsão vencida' },
];

function htmlAlertas(itens) {
  const secoes = GRUPOS.map((g) => {
    const doGrupo = itens.filter((i) => i.grupo === g.id);
    if (!doGrupo.length) return '';
    const linhas = doGrupo.map((i) => {
      const cor = i.dias < 0 ? '#be123c' : i.dias <= 7 ? '#b45309' : '#334155';
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top"><strong>${escapar(i.titulo)}</strong>${i.detalhe ? `<br><span style="color:#64748b;font-size:12px">${escapar(i.detalhe)}</span>` : ''}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap">${dataBR(i.vencimento)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;color:${cor};font-weight:bold">${escapar(i.prazo)}</td>
      </tr>`;
    }).join('');
    return `<h3 style="margin:20px 0 6px;font-size:15px;color:#0f172a">${g.titulo} (${doGrupo.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f8fafc;text-align:left"><th style="padding:8px">Item</th><th style="padding:8px">Data</th><th style="padding:8px">Prazo</th></tr>
        ${linhas}
      </table>`;
  }).join('');
  return `<p style="margin:0">Estes itens do Geniantis ERP precisam de atenção:</p>${secoes}<p style="margin-top:20px;color:#64748b;font-size:12px">Cada item é avisado uma vez por faixa de prazo. Ajuste os destinatários e as faixas em Configurações › E-mails.</p>`;
}

/**
 * Roda os alertas: coleta, descarta o que já foi avisado e envia um resumo
 * único aos destinatários. dryRun = só lista, sem enviar nem registrar.
 */
async function processarAlertas({ sessao = null, dryRun = false } = {}) {
  const config = await carregarConfiguracoes();
  if (!dryRun && !config.alerts_enabled) {
    return { message: 'Alertas desativados nas configurações.', enviados: 0, itens: [] };
  }

  const itens = await coletarAlertas(config);
  let pendentes = itens;
  if (itens.length) {
    const chaves = itens.map((i) => `"${i.key.replace(/"/g, '')}"`).join(',');
    const jaEnviados = (await rest(`email_alert_log?select=key&key=in.(${encodeURIComponent(chaves)})`)) || [];
    const enviados = new Set(jaEnviados.map((r) => r.key));
    pendentes = itens.map((i) => ({ ...i, ja_avisado: enviados.has(i.key) }));
  }
  const novos = pendentes.filter((i) => !i.ja_avisado);

  if (dryRun) {
    return {
      message: `${itens.length} item(ns) dentro das faixas de aviso; ${novos.length} ainda não avisado(s).`,
      destinatarios: config.alert_recipients,
      itens: pendentes,
    };
  }

  const destinatarios = (config.alert_recipients || []).map((e) => String(e).trim()).filter(Boolean);
  if (!novos.length) return { message: 'Nada novo para avisar hoje.', enviados: 0, itens: [] };
  if (!destinatarios.length) throw new Error('Nenhum destinatário de alertas configurado.');

  const assunto = `Alertas do ERP: ${novos.length} item(ns) para acompanhar`;
  const envio = await enviarEmail(destinatarios.join(', '), assunto, montarHtml(htmlAlertas(novos), config), opcoesRemetente(config));

  await registrarLog([linhaLog({
    sessao,
    ok: envio.success,
    resumo: `${envio.success ? 'Alertas de vencimento enviados' : 'Falha ao enviar alertas de vencimento'} (${novos.length} item(ns)) para ${destinatarios.join(', ')}`,
    detalhes: {
      tipo: 'alertas',
      origem: sessao ? 'manual' : 'automatico',
      email: destinatarios.join(', '),
      itens: novos.map((i) => `${i.titulo} — ${i.prazo}`),
      ...(envio.success ? {} : { erro: envio.error }),
    },
  })]);
  if (!envio.success) throw new Error(`Não foi possível enviar os alertas: ${envio.error}`);

  await rest('email_alert_log', {
    method: 'POST',
    body: novos.map((i) => ({ key: i.key })),
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });

  return { message: `Resumo com ${novos.length} item(ns) enviado para ${destinatarios.length} destinatário(s).`, enviados: novos.length, itens: novos };
}

// ---------- Comunicados (um e-mail por funcionário) ----------

const LOTE_COMUNICADO = 5;

function primeiroNome(nome) {
  const n = String(nome || '').trim();
  return n.split(/\s+/)[0] || n;
}

/** Troca {{nome}} / {{nome_completo}} no HTML (escapado) e no assunto (texto) */
function personalizar(texto, nome, html) {
  const valores = { nome: primeiroNome(nome), nome_completo: String(nome || '').trim() };
  return String(texto || '').replace(/{{\s*(nome|nome_completo)\s*}}/g, (m, k) => (html ? escapar(valores[k]) : valores[k]));
}

/**
 * Caminho de arquivo do Storage pronto para a URL, recusando "." e "..", barra invertida e "%".
 * Sem isso, um caminho como "../../../../rest/v1/tabela" sairia do bucket e chegaria
 * em qualquer endpoint do Supabase.
 */
function caminhoArquivoSeguro(caminho) {
  const partes = String(caminho || '').split('/');
  const invalido = partes.some((p) => !p || p === '.' || p === '..' || /[\\%\u0000-\u001f]/.test(p));
  if (invalido) throw new Error('Caminho de arquivo inválido.');
  return partes.map(encodeURIComponent).join('/');
}

/**
 * Texto digitado no comunicado → HTML de e-mail.
 * Mesmo resultado de textToEmailHtml (src/lib/emailFormat.ts): o HTML é sempre gerado aqui
 * a partir do texto, nunca aceito pronto do navegador.
 */
function textoComunicadoParaHtml(texto) {
  const inline = (t) => escapar(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#2563eb">$1</a>');
  const blocos = String(texto || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocos.map((bloco) => {
    if (bloco.startsWith('## ')) {
      return `<h3 style="margin:20px 0 8px;font-size:16px;color:#0f172a">${inline(bloco.slice(3))}</h3>`;
    }
    const linhas = bloco.split('\n');
    if (linhas.every((l) => /^\s*[-•]\s+/.test(l))) {
      const itens = linhas.map((l) => `<li style="margin:2px 0">${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('');
      return `<ul style="margin:0 0 14px;padding-left:20px">${itens}</ul>`;
    }
    return `<p style="margin:0 0 14px">${linhas.map(inline).join('<br>')}</p>`;
  }).join('');
}

/** Baixa o anexo do comunicado com o token de quem está enviando (vale o RLS do Storage) */
async function baixarAnexo(sessao, caminho, nome) {
  if (!caminho) return [];
  const cfg = supabaseConfig();
  const url = `${cfg.url}/storage/v1/object/communication-files/${caminhoArquivoSeguro(caminho)}`;
  const res = await fetch(url, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${sessao.token}` } });
  if (!res.ok) throw new Error(`Não foi possível ler o anexo (HTTP ${res.status}).`);
  return [{ filename: nome || 'anexo', content: Buffer.from(await res.arrayBuffer()) }];
}

/** Moldura e remetente próprios dos comunicados (outra conta Google) */
function configComunicados(config) {
  return { ...config, signature: config.comm_signature, sender_name: config.comm_sender_name, reply_to: config.comm_reply_to };
}

function opcoesComunicado(config, anexos) {
  return { ...opcoesRemetente(configComunicados(config)), attachments: anexos, conta: 'comunicados' };
}

/** Endereço que envia os comunicados (sem a senha), para mostrar na tela */
function remetenteComunicados() {
  const conta = contaComunicados();
  return { address: conta ? conta.user : null };
}

/** Envia o comunicado (ainda não salvo) só para quem está montando, para conferir */
async function enviarComunicadoTeste(sessao, { subject, body, attachment_path, attachment_name }) {
  if (!String(subject || '').trim()) throw new Error('Informe o assunto.');
  const config = await carregarConfiguracoes();
  const para = sessao.user.email;
  const nome = sessao.profile.full_name || para;
  const anexos = await baixarAnexo(sessao, attachment_path, attachment_name);
  const envio = await enviarEmail(
    para,
    `[TESTE] ${personalizar(subject, nome, false)}`,
    montarHtml(personalizar(textoComunicadoParaHtml(body), nome, true), configComunicados(config)),
    opcoesComunicado(config, anexos),
  );
  if (!envio.success) throw new Error(`Não foi possível enviar: ${envio.error}`);
  return { to: para };
}

/**
 * Envia o próximo lote de destinatários pendentes de um comunicado.
 * O navegador chama em sequência até pending = 0 (cada chamada cabe no tempo limite da function).
 * retryFailed = volta os que falharam para pendente antes (reenviar para quem falhou).
 */
async function enviarLoteComunicado(sessao, comunicadoId, { retryFailed = false } = {}) {
  const id = encodeURIComponent(comunicadoId);
  const [com] = (await rest(`communications?id=eq.${id}&select=*`)) || [];
  if (!com) throw new Error('Comunicado não encontrado.');

  if (retryFailed) {
    await rest(`communication_recipients?communication_id=eq.${id}&status=eq.falhou`, {
      method: 'PATCH', body: { status: 'pendente', error: null }, prefer: 'return=minimal',
    });
    await rest(`communications?id=eq.${id}`, { method: 'PATCH', body: { status: 'enviando', finished_at: null }, prefer: 'return=minimal' });
  }

  const lote = (await rest(`communication_recipients?communication_id=eq.${id}&status=eq.pendente&select=id,name,email&order=name&limit=${LOTE_COMUNICADO}`)) || [];

  // Sem a conta dos comunicados, para antes de marcar todo mundo como "falhou"
  if (lote.length && !contaComunicados()) {
    throw new Error('A conta dos comunicados não está configurada (COMUNICADOS_GMAIL_USER e COMUNICADOS_GMAIL_APP_PASSWORD).');
  }

  if (lote.length) {
    const config = await carregarConfiguracoes();
    const anexos = await baixarAnexo(sessao, com.attachment_path, com.attachment_name);
    const opcoes = opcoesComunicado(config, anexos);
    const moldura = configComunicados(config);
    const corpoHtml = textoComunicadoParaHtml(com.body);
    const resultados = await Promise.all(lote.map(async (r) => {
      const envio = await enviarEmail(r.email, personalizar(com.subject, r.name, false), montarHtml(personalizar(corpoHtml, r.name, true), moldura), opcoes);
      return { r, envio };
    }));
    const agora = new Date().toISOString();
    await Promise.all(resultados.map(({ r, envio }) => rest(`communication_recipients?id=eq.${encodeURIComponent(r.id)}`, {
      method: 'PATCH',
      body: envio.success ? { status: 'enviado', error: null, sent_at: agora } : { status: 'falhou', error: String(envio.error || 'erro desconhecido').slice(0, 500) },
      prefer: 'return=minimal',
    })));
  }

  // Recalcula as contagens do comunicado
  const todos = (await rest(`communication_recipients?communication_id=eq.${id}&select=status`)) || [];
  const conta = (st) => todos.filter((t) => t.status === st).length;
  const sent = conta('enviado');
  const failed = conta('falhou');
  const pending = conta('pendente');
  const terminou = pending === 0;
  const status = terminou ? (failed ? 'com_falhas' : 'enviado') : 'enviando';
  await rest(`communications?id=eq.${id}`, {
    method: 'PATCH',
    body: { sent_count: sent, failed_count: failed, total: todos.length, status, ...(terminou ? { finished_at: new Date().toISOString() } : {}) },
    prefer: 'return=minimal',
  });

  if (terminou && (lote.length || retryFailed)) {
    await registrarLog([linhaLog({
      sessao,
      ok: failed === 0,
      entityId: com.id,
      resumo: `Comunicado "${com.subject}" enviado para ${sent} de ${todos.length} funcionário(s)${failed ? ` (${failed} falha(s))` : ''}`,
      detalhes: { tipo: 'comunicado', comunicado: com.id, enviados: sent, falhas: failed, publico: com.audience },
    })]);
  }

  return { sent, failed, pending, total: todos.length, status };
}

// ---------- Avisos da agenda por e-mail ----------

/**
 * Envia por e-mail os avisos pendentes que a própria pessoa gerou nos últimos 15 minutos
 * (compartilhou agenda, convidou, atribuiu atividade). Os avisos são criados pelo banco;
 * aqui só se envia o que já existe, então ninguém dispara e-mails com texto próprio.
 */
async function enviarAvisosAgenda(sessao) {
  const desde = new Date(Date.now() - 15 * 60000).toISOString();
  const pendentes = (await rest(
    `notifications?actor_id=eq.${encodeURIComponent(sessao.user.id)}&email_status=eq.pendente&created_at=gte.${encodeURIComponent(desde)}&select=id&limit=50`,
  )) || [];
  if (!pendentes.length) return { enviados: 0, falhas: 0 };

  // Reserva os avisos (marca como enviados antes de mandar) para não duplicar se a tela chamar duas vezes
  const ids = pendentes.map((a) => a.id).join(',');
  const avisos = (await rest(`notifications?id=in.(${ids})&email_status=eq.pendente&select=id,user_id,title,body,link`, {
    method: 'PATCH',
    body: { email_status: 'enviado', emailed_at: new Date().toISOString() },
    prefer: 'return=representation',
  })) || [];
  if (!avisos.length) return { enviados: 0, falhas: 0 };

  const pessoasIds = [...new Set(avisos.map((a) => a.user_id))].join(',');
  const pessoas = new Map(((await rest(`profiles?id=in.(${pessoasIds})&select=id,email,full_name,notify_email,is_active`)) || []).map((p) => [p.id, p]));
  const config = await carregarConfiguracoes();
  const base = (process.env.URL || 'https://admgeniantis.netlify.app').replace(/\/+$/, '');

  let enviados = 0;
  let falhas = 0;
  const logs = [];
  for (const a of avisos) {
    const p = pessoas.get(a.user_id);
    if (!p || !p.email || !p.is_active || !p.notify_email) {
      await rest(`notifications?id=eq.${a.id}`, { method: 'PATCH', body: { email_status: 'nao_envia', emailed_at: null }, prefer: 'return=minimal' });
      continue;
    }
    const link = `${base}${a.link || '/agenda'}`;
    const html = montarHtml(
      `<p>Olá, ${escapar(primeiroNome(p.full_name || ''))}!</p>` +
      `<p style="font-size:16px"><strong>${escapar(a.title)}</strong></p>` +
      (a.body ? `<p>${textoParaHtml(a.body)}</p>` : '') +
      `<p style="margin:20px 0"><a href="${escapar(link)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir na Agenda</a></p>` +
      `<p style="color:#64748b;font-size:12px">Para não receber estes e-mails, desligue em Agenda › Configurações › Avisos por e-mail.</p>`,
      config,
    );
    const envio = await enviarEmail(p.email, a.title, html, opcoesRemetente(config));
    if (envio.success) enviados += 1;
    else {
      falhas += 1;
      await rest(`notifications?id=eq.${a.id}`, { method: 'PATCH', body: { email_status: 'falhou' }, prefer: 'return=minimal' });
    }
    logs.push(linhaLog({
      sessao,
      ok: envio.success,
      resumo: `${envio.success ? 'Aviso da agenda enviado para' : 'Falha no aviso da agenda para'} ${p.email}`,
      entityId: a.id,
      detalhes: { tipo: 'aviso_agenda', email: p.email, titulo: a.title, ...(envio.success ? {} : { erro: envio.error }) },
    }));
  }
  if (logs.length) await registrarLog(logs);
  return { enviados, falhas };
}

// ---------- Convite por e-mail para pessoas de fora do ERP ----------

const EMAIL_EXTERNO = /[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+/g;
const MAX_EXTERNOS = 20;

/** E-mails digitados no campo de convidados de fora (sem repetir, no máximo 20) */
function emailsExternos(texto) {
  const lista = (String(texto || '').match(EMAIL_EXTERNO) || []).map((e) => e.toLowerCase().replace(/[.]+$/, ''));
  return [...new Set(lista)].slice(0, MAX_EXTERNOS);
}

/** Nível da pessoa no evento, conferido no banco com o token dela */
async function nivelNoEvento(sessao, eventoId) {
  const cfg = supabaseConfig();
  const res = await fetch(`${cfg.url}/rest/v1/rpc/agenda_event_level`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${sessao.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_event: eventoId }),
  });
  if (!res.ok) return 0;
  return Number(await res.json()) || 0;
}

const icsTexto = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Quebra as linhas do .ics em 75 caracteres, como pede o padrão */
const icsDobrar = (linha) => {
  const partes = [];
  let resto = linha;
  while (resto.length > 74) { partes.push(resto.slice(0, 74)); resto = ' ' + resto.slice(74); }
  partes.push(resto);
  return partes.join('\r\n');
};
const somenteData = (iso) => iso.replace(/-/g, '');
const dataHora = (iso, hora) => `${somenteData(iso)}T${String(hora).slice(0, 5).replace(':', '')}00`;

/** Arquivo .ics (METHOD:PUBLISH: "adicionar à agenda", sem pedir resposta) */
function montarIcs(ev, organizador) {
  const RR = { diaria: 'FREQ=DAILY', semanal: 'FREQ=WEEKLY', quinzenal: 'FREQ=WEEKLY;INTERVAL=2', mensal: 'FREQ=MONTHLY', anual: 'FREQ=YEARLY' };
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Geniantis ERP//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${ev.id}@geniantis-erp`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
  ];
  if (ev.start_time) {
    linhas.push(`DTSTART;TZID=America/Sao_Paulo:${dataHora(ev.start_date, ev.start_time)}`);
    linhas.push(`DTEND;TZID=America/Sao_Paulo:${dataHora(ev.end_date, ev.end_time || ev.start_time)}`);
  } else {
    linhas.push(`DTSTART;VALUE=DATE:${somenteData(ev.start_date)}`);
    linhas.push(`DTEND;VALUE=DATE:${somenteData(somarDias(ev.end_date, 1))}`);
  }
  if (RR[ev.recurrence]) {
    linhas.push(`RRULE:${RR[ev.recurrence]}${ev.recurrence_until ? `;UNTIL=${somenteData(ev.recurrence_until)}T235959Z` : ''}`);
  }
  linhas.push(`SUMMARY:${icsTexto(ev.title)}`);
  if (ev.location) linhas.push(`LOCATION:${icsTexto(ev.location)}`);
  const desc = [ev.description, ev.meeting_url ? `Videochamada: ${ev.meeting_url}` : ''].filter(Boolean).join('\n\n');
  if (desc) linhas.push(`DESCRIPTION:${icsTexto(desc)}`);
  if (ev.meeting_url) linhas.push(`URL:${ev.meeting_url}`);
  if (organizador) linhas.push(`ORGANIZER;CN=${icsTexto(organizador.nome)}:mailto:${organizador.email}`);
  if (ev.reminder_minutes !== null && ev.reminder_minutes !== undefined) {
    // Dia inteiro: lembrete conta a partir das 8h do dia (o início do evento é 0h)
    const min = ev.start_time ? Number(ev.reminder_minutes) : Number(ev.reminder_minutes) - 8 * 60;
    const gatilho = min >= 0 ? `-PT${min}M` : `PT${-min}M`;
    linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsTexto(ev.title)}`, `TRIGGER:${gatilho}`, 'END:VALARM');
  }
  linhas.push('END:VEVENT', 'END:VCALENDAR');
  return linhas.map(icsDobrar).join('\r\n') + '\r\n';
}

function quandoTexto(ev) {
  const d1 = dataBR(ev.start_date);
  if (!ev.start_time) return ev.end_date && ev.end_date !== ev.start_date ? `${d1} a ${dataBR(ev.end_date)} (dia inteiro)` : `${d1} (dia inteiro)`;
  const h1 = String(ev.start_time).slice(0, 5);
  const h2 = String(ev.end_time || ev.start_time).slice(0, 5);
  return ev.end_date && ev.end_date !== ev.start_date ? `${d1} às ${h1} até ${dataBR(ev.end_date)} às ${h2}` : `${d1}, das ${h1} às ${h2}`;
}

/**
 * Envia o convite aos e-mails de fora do ERP digitados no evento. Cada endereço recebe uma vez;
 * com reenviar = true, manda de novo para todos (ex.: mudou o horário).
 */
async function enviarConvitesExternos(sessao, eventoId, { reenviar = false } = {}) {
  if ((await nivelNoEvento(sessao, eventoId)) < 2) {
    const e = new Error('Você não pode enviar convites deste evento.');
    e.status = 403;
    throw e;
  }
  const [ev] = (await rest(`agenda_events?id=eq.${encodeURIComponent(eventoId)}&select=*`)) || [];
  if (!ev) throw new Error('Evento não encontrado.');
  const todos = emailsExternos(ev.guests);
  if (!todos.length) return { enviados: 0, ja_enviados: 0, falhas: 0, emails: [] };

  const jaFeitos = new Set(((await rest(`agenda_external_invites?event_id=eq.${ev.id}&select=email`)) || []).map((r) => r.email));
  const alvo = reenviar ? todos : todos.filter((e) => !jaFeitos.has(e));
  if (!alvo.length) return { enviados: 0, ja_enviados: todos.length, falhas: 0, emails: [] };

  const config = await carregarConfiguracoes();
  const remetente = (/<([^>]+)>/.exec(process.env.EMAIL_FROM || '') || [])[1] || process.env.EMAIL_FROM || process.env.GMAIL_USER || '';
  const quem = sessao.profile.full_name || sessao.user.email;
  const ics = montarIcs(ev, remetente ? { nome: config.sender_name || quem, email: remetente } : null);
  const assunto = `${reenviar && jaFeitos.size ? 'Convite atualizado' : 'Convite'}: ${ev.title} — ${quandoTexto(ev)}`;
  const html = montarHtml(
    `<p>Olá!</p>` +
    `<p><strong>${escapar(quem)}</strong> convidou você para:</p>` +
    `<p style="font-size:17px;margin:4px 0"><strong>${escapar(ev.title)}</strong></p>` +
    `<p style="margin:4px 0">📅 ${escapar(quandoTexto(ev))}</p>` +
    (ev.location ? `<p style="margin:4px 0">📍 ${escapar(ev.location)}</p>` : '') +
    (ev.description ? `<p style="margin:12px 0 0">${textoParaHtml(ev.description)}</p>` : '') +
    (ev.meeting_url
      ? `<p style="margin:20px 0"><a href="${escapar(ev.meeting_url)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Entrar na videochamada</a></p><p style="color:#64748b;font-size:12px">${escapar(ev.meeting_url)}</p>`
      : '') +
    `<p style="color:#64748b;font-size:12px;margin-top:16px">O arquivo anexo (convite.ics) adiciona o evento ao Google Agenda, Outlook ou à agenda do celular.</p>`,
    config,
  );

  let enviados = 0;
  let falhas = 0;
  const logs = [];
  const enviadosLista = [];
  for (const para of alvo) {
    const envio = await enviarEmail(para, assunto, html, {
      ...opcoesRemetente(config),
      attachments: [{ filename: 'convite.ics', content: ics, contentType: 'text/calendar; charset=UTF-8; method=PUBLISH' }],
    });
    if (envio.success) {
      enviados += 1;
      enviadosLista.push(para);
      await rest('agenda_external_invites?on_conflict=event_id,email', {
        method: 'POST',
        body: { event_id: ev.id, email: para, sent_at: new Date().toISOString(), sent_by: sessao.user.id },
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
    } else {
      falhas += 1;
    }
    logs.push(linhaLog({
      sessao,
      ok: envio.success,
      resumo: `${envio.success ? 'Convite da agenda enviado para' : 'Falha no convite da agenda para'} ${para}`,
      entityId: ev.id,
      detalhes: { tipo: 'convite_agenda_externo', email: para, evento: ev.title, ...(envio.success ? {} : { erro: envio.error }) },
    }));
  }
  if (logs.length) await registrarLog(logs);
  return { enviados, ja_enviados: todos.length - alvo.length, falhas, emails: enviadosLista };
}

// ---------- Lembretes da agenda (função agendada a cada 5 minutos) ----------

const PASSO_DIAS = { diaria: 1, semanal: 7, quinzenal: 14 };
const diasNoMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** Dias em que o evento começa dentro de [de, ate] (AAAA-MM-DD) */
function diasDoEvento(ev, de, ate) {
  const fim = ev.recurrence_until && ev.recurrence_until < ate ? ev.recurrence_until : ate;
  if (ev.recurrence === 'nenhuma') return ev.start_date >= de && ev.start_date <= ate ? [ev.start_date] : [];
  const dias = [];
  const passo = PASSO_DIAS[ev.recurrence];
  if (passo) {
    const ini = Math.max(0, Math.floor(diasEntre(ev.start_date, de) / passo));
    for (let i = ini; i < ini + 400; i++) {
      const d = somarDias(ev.start_date, i * passo);
      if (d > fim) break;
      if (d >= de) dias.push(d);
    }
    return dias;
  }
  const [a0, m0, d0] = ev.start_date.split('-').map(Number);
  for (let i = 0; i < 1200; i++) {
    const a = ev.recurrence === 'mensal' ? a0 + Math.floor((m0 - 1 + i) / 12) : a0 + i;
    const m = ev.recurrence === 'mensal' ? ((m0 - 1 + i) % 12) + 1 : m0;
    if (`${a}-${String(m).padStart(2, '0')}-01` > fim) break;
    if (d0 > diasNoMes(a, m)) continue;
    const d = `${a}-${String(m).padStart(2, '0')}-${String(d0).padStart(2, '0')}`;
    if (d >= de && d <= fim) dias.push(d);
  }
  return dias;
}

/** Início da ocorrência em milissegundos (horário de Brasília; dia inteiro = 8h) */
const inicioMs = (dia, hora) => Date.parse(`${dia}T${hora ? String(hora).slice(0, 5) : '08:00'}:00-03:00`);

async function processarLembretesAgenda() {
  const agora = Date.now();
  const hoje = hojeISO();
  const ontem = somarDias(hoje, -1);
  const limite = somarDias(hoje, 8); // lembrete de até 7 dias antes
  const eventos = (await rest(
    `agenda_events?reminder_minutes=not.is.null&start_date=lte.${limite}` +
    `&or=(recurrence.neq.nenhuma,start_date.gte.${ontem})` +
    `&select=id,title,kind,status,start_date,end_date,start_time,end_time,recurrence,recurrence_until,reminder_minutes,location,meeting_url,created_by,assignee_id,agenda_event_guests(user_id,response)&limit=2000`,
  )) || [];

  // Ocorrências cujo horário do lembrete já chegou (até 60 min de atraso) e que ainda não começaram há mais de 10 min
  const devidos = [];
  for (const ev of eventos) {
    if (ev.recurrence_until && ev.recurrence_until < ontem) continue;
    for (const dia of diasDoEvento(ev, ontem, limite)) {
      const inicio = inicioMs(dia, ev.start_time);
      const aviso = inicio - Number(ev.reminder_minutes) * 60000;
      if (aviso <= agora && agora - aviso <= 60 * 60000 && agora <= inicio + 10 * 60000) devidos.push({ ev, dia });
    }
  }
  if (!devidos.length) return { lembretes: 0 };

  // Atividades já finalizadas não precisam de lembrete
  const recorrentes = [...new Set(devidos.filter((x) => x.ev.recurrence !== 'nenhuma').map((x) => x.ev.id))];
  const finalizadas = new Set();
  if (recorrentes.length) {
    const occ = (await rest(`agenda_task_occurrences?event_id=in.(${recorrentes.join(',')})&status=eq.finalizado&select=event_id,occurrence_date`)) || [];
    occ.forEach((o) => finalizadas.add(`${o.event_id}|${o.occurrence_date}`));
  }

  const linhas = [];
  for (const { ev, dia } of devidos) {
    // Evento ou atividade já finalizado não precisa de lembrete
    if (ev.recurrence === 'nenhuma' ? ev.status === 'finalizado' : finalizadas.has(`${ev.id}|${dia}`)) continue;
    const pessoas = new Set([ev.created_by, ev.assignee_id, ...(ev.agenda_event_guests || []).filter((g) => g.response !== 'nao').map((g) => g.user_id)].filter(Boolean));
    pessoas.forEach((u) => linhas.push({ event_id: ev.id, occurrence_date: dia, user_id: u }));
  }
  if (!linhas.length) return { lembretes: 0 };

  // Reserva (só volta o que ainda não tinha sido enviado)
  const novos = (await rest('agenda_reminders_sent?on_conflict=event_id,occurrence_date,user_id', {
    method: 'POST', body: linhas, prefer: 'resolution=ignore-duplicates,return=representation',
  })) || [];
  if (!novos.length) return { lembretes: 0 };

  const porId = new Map(eventos.map((e) => [e.id, e]));
  const ids = [...new Set(novos.map((n) => n.user_id))].join(',');
  // notify_activities vem da migration 20261124000052; antes dela, busca sem a coluna
  let perfis;
  try {
    perfis = await rest(`profiles?id=in.(${ids})&select=id,email,full_name,notify_email,is_active,notify_activities`);
  } catch {
    perfis = await rest(`profiles?id=in.(${ids})&select=id,email,full_name,notify_email,is_active`);
  }
  const pessoas = new Map((perfis || []).map((p) => [p.id, p]));
  const config = await carregarConfiguracoes();
  const base = (process.env.URL || 'https://admgeniantis.netlify.app').replace(/\/+$/, '');

  let enviados = 0;
  const logs = [];
  for (const n of novos) {
    const ev = porId.get(n.event_id);
    const p = pessoas.get(n.user_id);
    if (!ev || !p || !p.is_active) continue;
    // Pessoa desligou os avisos de atividades
    if (ev.kind === 'atividade' && p.notify_activities === false) continue;
    const quando = quandoTexto({ ...ev, start_date: n.occurrence_date, end_date: somarDias(n.occurrence_date, diasEntre(ev.start_date, ev.end_date)) });
    const titulo = `${ev.kind === 'atividade' ? 'Lembrete de atividade' : 'Lembrete'}: ${ev.title}`;
    const corpo = `${ev.kind === 'atividade' ? 'Prazo' : 'Quando'}: ${quando}${ev.location ? ` · ${ev.location}` : ''}${ev.meeting_url ? `\nVideochamada: ${ev.meeting_url}` : ''}`;
    const link = ev.kind === 'atividade' ? '/agenda?visao=atividades' : `/agenda?data=${n.occurrence_date}`;
    let status = 'nao_envia';
    if (p.email && p.notify_email) {
      const html = montarHtml(
        `<p>Olá, ${escapar(primeiroNome(p.full_name || ''))}!</p>` +
        `<p style="font-size:16px"><strong>${escapar(titulo)}</strong></p><p>${textoParaHtml(corpo)}</p>` +
        (ev.meeting_url ? `<p style="margin:16px 0"><a href="${escapar(ev.meeting_url)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Entrar na videochamada</a></p>` : '') +
        `<p style="margin:16px 0"><a href="${escapar(base + link)}">Abrir na Agenda</a></p>`,
        config,
      );
      const envio = await enviarEmail(p.email, titulo, html, opcoesRemetente(config));
      status = envio.success ? 'enviado' : 'falhou';
      if (envio.success) enviados += 1;
      logs.push(linhaLog({
        sessao: null,
        ok: envio.success,
        resumo: `${envio.success ? 'Lembrete da agenda enviado para' : 'Falha no lembrete da agenda para'} ${p.email}`,
        entityId: ev.id,
        detalhes: { tipo: 'lembrete_agenda', email: p.email, evento: ev.title, dia: n.occurrence_date, ...(envio.success ? {} : { erro: envio.error }) },
      }));
    }
    await rest('notifications', {
      method: 'POST',
      body: { user_id: n.user_id, actor_id: null, kind: 'agenda_reminder', title: titulo, body: corpo, link, email_status: status, emailed_at: status === 'enviado' ? new Date().toISOString() : null },
      prefer: 'return=minimal',
    });
  }
  if (logs.length) await registrarLog(logs);
  return { lembretes: novos.length, emails: enviados };
}

module.exports = {
  usuarioDaRequisicao,
  temModulo,
  enviarTeste,
  enviarTermo,
  enviarTermoImagem,
  processarAlertas,
  enviarComunicadoTeste,
  enviarLoteComunicado,
  remetenteComunicados,
  enviarAvisosAgenda,
  enviarConvitesExternos,
  processarLembretesAgenda,
  diasDoEvento,
  emailsExternos,
  montarIcs,
};
