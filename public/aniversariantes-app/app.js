// Configurações Globais

// Modal de confirmação customizado (substitui window.confirm() bloqueado pelo browser)
function mostrarConfirm(mensagem) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmModalMessage');
    const btnOk = document.getElementById('btnConfirmOk');
    const btnCancel = document.getElementById('btnConfirmCancel');
    if (!modal) { resolve(window.confirm(mensagem)); return; }
    msg.textContent = mensagem;
    modal.style.display = 'flex';
    const cleanup = (result) => {
      modal.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
  });
}

const API_BASE = '/.netlify/functions';
let contatosList = [];
let contatosRenderizadosAtuais = [];
let contatosCarregados = false;
let erpEmployees = [];
let erpEmployeesReceived = false;
const contatosSelecionados = new Set();
let emailConfig = {
  email_assunto: 'Feliz Aniversário! 🎉',
  email_template: 'Olá {{nome}},\n\nDesejamos a você um feliz aniversário! Que o seu dia seja repleto de alegria e realizações.\n\nParabéns! 🎂'
};
const IS_LOCAL_PREVIEW = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || window.location.protocol === 'file:';
const LOCAL_PREVIEW_STORAGE_KEY = 'parabensflow_local_preview_state';
const LOCAL_PREVIEW_DEFAULTS = {
  usuarios: [
    { email: 'admin@demo.com', password: 'demo123', role: 'admin' },
    { email: 'viewer@demo.com', password: 'demo123', role: 'viewer' }
  ],
  contatos: [
    { id: '1', nome: 'Daisy Souza', email: 'daisy@example.com', data_nascimento: '1990-01-10' },
    { id: '2', nome: 'Gisele Ramos', email: 'gisele@example.com', data_nascimento: '1988-01-30' },
    { id: '3', nome: 'Eduardo Lima', email: 'eduardo@example.com', data_nascimento: '1992-02-04' },
    { id: '4', nome: 'Juliana Blum', email: 'juliana@example.com', data_nascimento: '1991-03-02' },
    { id: '5', nome: 'José Pereira', email: 'jose@example.com', data_nascimento: '1985-04-12' },
    { id: '6', nome: 'Matheus Costa', email: 'matheus@example.com', data_nascimento: '1997-04-14' },
    { id: '7', nome: 'Isabele Rocha', email: 'isabele@example.com', data_nascimento: '1999-04-27' },
    { id: '8', nome: 'Iana Martins', email: 'iana@example.com', data_nascimento: '1993-05-21' },
    { id: '9', nome: 'Silvio Santos', email: 'silvio@example.com', data_nascimento: '1980-05-26' },
    { id: '10', nome: 'Inez Oliveira', email: 'inez@example.com', data_nascimento: '1987-06-07' },
    { id: '11', nome: 'Albert Nunes', email: 'albert@example.com', data_nascimento: '1990-07-30' },
    { id: '12', nome: 'Jeniffer Alves', email: 'jeniffer@example.com', data_nascimento: '1995-08-01' },
    { id: '13', nome: 'Fernanda Dias', email: 'fernanda@example.com', data_nascimento: '1994-08-10' },
    { id: '14', nome: 'Sidney Amorim', email: 'sidney@example.com', data_nascimento: '1989-08-29' },
    { id: '15', nome: 'Danielle Melo', email: 'danielle@example.com', data_nascimento: '1996-09-03' },
    { id: '16', nome: 'Almir Teixeira', email: 'almir@example.com', data_nascimento: '1982-09-27' },
    { id: '17', nome: 'Aline Barbosa', email: 'aline@example.com', data_nascimento: '1998-10-15' },
    { id: '18', nome: 'Cauã Ferreira', email: 'caua@example.com', data_nascimento: '2000-12-17' },
    { id: '19', nome: 'Henrique Braga', email: 'henrique@example.com', data_nascimento: '1991-12-18' },
    { id: '20', nome: 'Mirna Lopes', email: 'mirna@example.com', data_nascimento: '1986-12-22' },
    { id: '21', nome: 'Célia Prado', email: 'celia@example.com', data_nascimento: '1975-12-31' }
  ],
  config: {
    email_assunto: 'Feliz Aniversário! 🎉',
    email_template: 'Olá {{nome}},\n\nDesejamos um dia incrível!',
    email_cc: '',
    email_cco: '',
    email_imagem: ''
  },
  nextContactId: 22
};
let localPreviewState = null;

function converterFuncionariosERP(employees) {
  return (Array.isArray(employees) ? employees : [])
    .filter(emp => emp && emp.status !== 'desligado' && emp.birth_date)
    .map(emp => ({
      id: `erp-${emp.id}`,
      nome: emp.preferential_name || emp.full_name,
      email: emp.email,
      data_nascimento: emp.birth_date,
      departamento: emp.department
    }));
}

function aplicarFuncionariosERP(employees) {
  erpEmployees = converterFuncionariosERP(employees);
  erpEmployeesReceived = true;
  contatosList = [...erpEmployees];
  contatosCarregados = true;

  if (document.getElementById('contactsTableBody')) {
    renderizarContatos(contatosList);
    atualizarEstatisticas();
    renderizarBanner();
  }
}

function getLocalPreviewState() {
  if (!localPreviewState) {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_PREVIEW_STORAGE_KEY));
      localPreviewState = {
        ...LOCAL_PREVIEW_DEFAULTS,
        ...saved,
        usuarios: saved?.usuarios || LOCAL_PREVIEW_DEFAULTS.usuarios,
        contatos: saved?.contatos || LOCAL_PREVIEW_DEFAULTS.contatos,
        config: { ...LOCAL_PREVIEW_DEFAULTS.config, ...(saved?.config || {}) },
        nextContactId: saved?.nextContactId || LOCAL_PREVIEW_DEFAULTS.nextContactId
      };
    } catch (error) {
      localPreviewState = structuredClone(LOCAL_PREVIEW_DEFAULTS);
    }
  }

  // Sincronização dinâmica com o cadastro central de funcionários do GeniantisERP
  try {
    const geniantisEmployeesRaw = localStorage.getItem('geniantis_employees');
    if (geniantisEmployeesRaw) {
      const geniantisEmployees = JSON.parse(geniantisEmployeesRaw);
      geniantisEmployees.forEach(emp => {
        // Se foi desligado/desativado no cadastro principal, remove da lista de aniversariantes
        if (emp.status === 'desligado') {
          localPreviewState.contatos = localPreviewState.contatos.filter(
            c => !c.email || c.email.toLowerCase() !== emp.email.toLowerCase()
          );
          return;
        }
        if (!emp.birth_date) return;

        const idx = localPreviewState.contatos.findIndex(c =>
          c.email && c.email.toLowerCase() === emp.email.toLowerCase()
        );
        if (idx >= 0) {
          localPreviewState.contatos[idx].nome = emp.full_name;
          localPreviewState.contatos[idx].data_nascimento = emp.birth_date;
          localPreviewState.contatos[idx].departamento = emp.department;
        } else {
          localPreviewState.contatos.push({
            id: `erp-${emp.id}`,
            nome: emp.full_name,
            email: emp.email,
            data_nascimento: emp.birth_date,
            departamento: emp.department
          });
        }
      });
    }
  } catch (eSync) {
    console.warn('Erro ao sincronizar funcionários no ParabénsFlow:', eSync);
  }

  return localPreviewState;
}

function saveLocalPreviewState() {
  if (!IS_LOCAL_PREVIEW) return;
  localStorage.setItem(LOCAL_PREVIEW_STORAGE_KEY, JSON.stringify(localPreviewState || LOCAL_PREVIEW_DEFAULTS));
}

function clonePreviewData(value) {
  return JSON.parse(JSON.stringify(value));
}

function localJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function detectarSeparadorLinha(linha) {
  if (linha.includes('\t')) return '\t';
  if (linha.includes(';')) return ';';
  if (linha.includes(',')) return ',';
  return null;
}

function dividirLinhaCSV(linha, separador) {
  const campos = [];
  let atual = '';
  let emAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];

    if (char === '"') {
      if (emAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        emAspas = !emAspas;
      }
      continue;
    }

    if (char === separador && !emAspas) {
      campos.push(atual.trim());
      atual = '';
      continue;
    }

    atual += char;
  }

  campos.push(atual.trim());
  while (campos.length > 0 && campos[campos.length - 1] === '') {
    campos.pop();
  }
  return campos.map(campo => campo.replace(/^"(.*)"$/, '$1').trim());
}

function normalizarDataNascimento(valor) {
  const texto = String(valor || '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/[,\s;]+$/, '');
  if (!texto) return '';

  const limpo = texto.replace(/\s+/g, ' ');

  let match = limpo.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  if (match) {
    const [, ano, mes, dia] = match;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  match = limpo.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T].*)?$/);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  match = limpo.match(/^(\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  if (match) {
    const [, dia, mes] = match;
    return `2000-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const data = new Date(limpo);
  if (!Number.isNaN(data.getTime())) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  return '';
}

function formatarDataNascimentoExibicao(valor) {
  const texto = String(valor || '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/[,\s;]+$/, '');

  let match = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T].*)?$/);
  if (match) {
    const [, dia, mes, ano] = match;
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
  }

  match = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  if (match) {
    const [, ano, mes, dia] = match;
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
  }

  match = texto.match(/^(\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/);
  if (match) {
    const [, dia, mes] = match;
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}`;
  }

  return texto;
}

function obterDataNascimentoExibicaoContato(contato) {
  if (contato?.data_nascimento_original) return contato.data_nascimento_original;
  if (!contato?.data_nascimento) return '---';

  const partes = contato.data_nascimento.split('-');
  if (partes.length !== 3) return '---';

  if (partes[0] === '2000') {
    return `${partes[2]}/${partes[1]}`;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function linhaEhCabecalho(partes) {
  const normalizadas = partes.map(p => p.toLowerCase().replace(/\s+/g, ' ').trim());
  return normalizadas.some(valor =>
    ['nome', 'name', 'email', 'e-mail', 'mail', 'data', 'data nascimento', 'data_nascimento', 'nascimento', 'birthdate'].includes(valor)
  );
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupSubTabs();
  setupForms();
  setupSearch();
  setupConsole();
  setupBanner();
  
  // Configurar indicador visual de status de conexão com Netlify
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.textContent = '☁️ Modo Nuvem (Netlify)';
    badge.className = 'badge badge-success';
  }
  
  // Validar se há sessão ativa
  checkSession();

  // Escuta mensagens de SSO do GeniantisERP
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'GENIANTIS_SSO_SYNC') {
      const { token, email, role } = event.data;
      if (token && email && role) {
        sessaoInvalidaTratada = false;
        sessionStorage.setItem('parabensflow_token', token);
        sessionStorage.setItem('parabensflow_email', email);
        sessionStorage.setItem('parabensflow_role', role);
        localStorage.setItem('parabensflow_token', token);
        localStorage.setItem('parabensflow_email', email);
        localStorage.setItem('parabensflow_role', role);
        checkSession();
      }
    }

    if (event.data && event.data.type === 'GENIANTIS_EMPLOYEES_SYNC') {
      aplicarFuncionariosERP(event.data.employees || []);
    }
  });
});

// 1. Controle de Sessão e Autenticação (Com suporte a SSO do GeniantisERP)
function checkSession() {
  // Sincroniza com sessão do GeniantisERP se disponível
  let token = sessionStorage.getItem('parabensflow_token') || localStorage.getItem('parabensflow_token') || localStorage.getItem('geniantis_token');
  let email = sessionStorage.getItem('parabensflow_email') || localStorage.getItem('parabensflow_email') || localStorage.getItem('geniantis_email');
  let role = sessionStorage.getItem('parabensflow_role') || localStorage.getItem('parabensflow_role') || localStorage.getItem('geniantis_role');

  // Se o GeniantisERP definiu uma sessão ativa, replica no sessionStorage
  if (token && email && role) {
    sessionStorage.setItem('parabensflow_token', token);
    sessionStorage.setItem('parabensflow_email', email);
    sessionStorage.setItem('parabensflow_role', role);
  }
  
  const loginOverlay = document.getElementById('loginOverlay');
  const userBadge = document.getElementById('userEmailBadge');
  const logoutBtn = document.getElementById('btnHeaderLogout');

  if (token && email && role) {
    // Sessão ativa
    loginOverlay.classList.remove('active');
    userBadge.textContent = `👤 ${email} (${role === 'admin' ? 'Admin' : nomeDoRole(role)})`;
    userBadge.style.display = 'inline-flex';
    logoutBtn.style.display = 'inline-flex';
    
    // Atualizar dados de perfil na tela
    document.getElementById('profileEmail').value = email;

    // Adaptar os elementos visualmente de acordo com a permissão (Admin vs Viewer)
    adaptarInterfacePelasPermissoes();

    // Carregar informações
    carregarConfiguracoes();
    carregarContatos();
    if (role === 'admin') carregarUsuarios();
  } else {
    // Sessão inativa
    loginOverlay.classList.add('active');
    userBadge.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
}

function adaptarInterfacePelasPermissoes() {
  const role = sessionStorage.getItem('parabensflow_role');
  
  const cadastroPanel = document.getElementById('cadastroContatosPanel');
  const contactsBulkBar = document.getElementById('contactsBulkBar');
  const actionsHeaders = document.querySelectorAll('.actions-column');
  const bulkColumns = document.querySelectorAll('.bulk-column');
  const emailSubject = document.getElementById('emailSubject');
  const emailBody = document.getElementById('emailBody');
  const emailImagemInput = document.getElementById('emailImagemInput');
  const btnRemoverImagemTemplate = document.getElementById('btnRemoverImagemTemplate');
  const templateActions = document.querySelector('#tab-template .row-actions');
  const templateNotice = document.getElementById('templateViewOnlyNotice');
  const btnRunManual = document.getElementById('btnRunManual');
  const dispatchNotice = document.getElementById('dispatchViewOnlyNotice');
  const profileNavBtn = document.querySelector('button[data-tab="tab-profile"]');

  // Admin: acesso total | Editor: apenas contatos | Viewer: somente leitura
  const ehAdmin = role === 'admin';
  const podeEditarContatos = ehAdmin || role === 'editor';

  // O cadastro e ativação/desativação de contatos é gerenciado centralmente pelo módulo de Funcionários do ERP
  if (cadastroPanel) cadastroPanel.style.display = 'none';
  if (contactsBulkBar) contactsBulkBar.style.display = 'none';
  actionsHeaders.forEach(el => el.style.display = 'none');
  bulkColumns.forEach(el => el.style.display = 'none');

  // Template de e-mail (somente Admin)
  if (emailSubject) emailSubject.disabled = !ehAdmin;
  if (emailBody) emailBody.disabled = !ehAdmin;
  if (emailImagemInput) emailImagemInput.disabled = !ehAdmin;
  if (btnRemoverImagemTemplate) btnRemoverImagemTemplate.disabled = !ehAdmin;
  if (templateActions) templateActions.style.display = ehAdmin ? 'flex' : 'none';
  if (templateNotice) templateNotice.style.display = ehAdmin ? 'none' : 'block';

  // Disparo manual de e-mail (somente Admin)
  if (btnRunManual) {
    btnRunManual.disabled = !ehAdmin;
    btnRunManual.style.opacity = ehAdmin ? '1' : '0.5';
    btnRunManual.style.cursor = ehAdmin ? 'pointer' : 'not-allowed';
  }
  if (dispatchNotice) dispatchNotice.style.display = ehAdmin ? 'none' : 'block';

  // Botão "Acesso & Perfil" do menu lateral (oculto pois o login é gerenciado pelo ERP)
  if (profileNavBtn) profileNavBtn.style.display = 'none';

  // Se um não-admin por algum motivo estivesse na aba de perfil, redireciona para a aba de contatos
  const tabProfile = document.getElementById('tab-profile');
  if (!ehAdmin && tabProfile && tabProfile.classList.contains('active')) {
    document.querySelectorAll('.nav-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const contactsBtn = document.querySelector('button[data-tab="tab-contacts"]');
    if (contactsBtn) contactsBtn.classList.add('active');
    const contactsTab = document.getElementById('tab-contacts');
    if (contactsTab) contactsTab.classList.add('active');
  }
}

function nomeDoRole(role) {
  if (role === 'admin') return 'Administrador';
  if (role === 'editor') return 'Editor';
  return 'Leitor';
}

async function fazerLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btnSubmit = document.getElementById('btnSubmitLogin');

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<div class="loader"></div> Entrando...';

  try {
    if (IS_LOCAL_PREVIEW) {
      const state = getLocalPreviewState();
      const usuario = state.usuarios.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!usuario) throw new Error('E-mail ou senha incorretos.');
      sessionStorage.setItem('parabensflow_token', 'local-preview-token');
      sessionStorage.setItem('parabensflow_email', usuario.email);
      sessionStorage.setItem('parabensflow_role', usuario.role || 'viewer');
      showToast('Login local ativado para a prévia.', 'success');
      checkSession();
      return;
    }

    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Falha na autenticação.');

    sessionStorage.setItem('parabensflow_token', resData.token);
    sessionStorage.setItem('parabensflow_email', resData.email);
    sessionStorage.setItem('parabensflow_role', resData.role || 'viewer');
    showToast('Bem-vindo ao painel!', 'success');
    checkSession();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Entrar no Painel';
  }
}

function logout(silencioso = false) {
  silencioso = silencioso === true;
  sessionStorage.removeItem('parabensflow_token');
  sessionStorage.removeItem('parabensflow_email');
  sessionStorage.removeItem('parabensflow_role');
  contatosSelecionados.clear();
  
  // Limpar dados exibidos por segurança
  document.getElementById('contactsTableBody').innerHTML = '';
  document.getElementById('statTotal').textContent = '0';
  document.getElementById('statMonth').textContent = '0';
  document.getElementById('statToday').textContent = '0';
  document.getElementById('statMonthList').innerHTML = '';

  if (!silencioso) showToast('Você saiu do sistema.', 'info');
  checkSession();
}

// Sessão recusada pelo servidor: limpa TODAS as cópias do token (inclusive as
// gravadas pelo ERP no localStorage, que reativariam a sessão em loop), avisa
// uma única vez e, dentro do ERP, pede um token novo à página pai.
let ultimoPedidoSSO = 0;
let sessaoInvalidaTratada = false;
function tratarSessaoInvalida() {
  const tinhaSessao = Boolean(sessionStorage.getItem('parabensflow_token'));
  ['parabensflow', 'geniantis'].forEach(prefixo => {
    ['token', 'email', 'role'].forEach(campo => localStorage.removeItem(`${prefixo}_${campo}`));
  });
  if (tinhaSessao) {
    logout(true);
    if (!sessaoInvalidaTratada) {
      showToast('Sessão expirada ou acesso negado. Faça login novamente.', 'error');
      sessaoInvalidaTratada = true;
    }
  }

  const dentroDoERP = window.parent && window.parent !== window;
  if (dentroDoERP && Date.now() - ultimoPedidoSSO > 30000) {
    ultimoPedidoSSO = Date.now();
    window.parent.postMessage({ type: 'GENIANTIS_SSO_REQUEST' }, window.location.origin);
  }
}

// 2. Helper de Requisições Autenticadas
async function fetchAutenticado(endpoint, options = {}) {
  const token = sessionStorage.getItem('parabensflow_token');
  const headers = options.headers || {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (IS_LOCAL_PREVIEW) {
    const state = getLocalPreviewState();
    const method = (options.method || 'GET').toUpperCase();

    if (endpoint === '/contacts' && method === 'GET') {
      contatosList = clonePreviewData(state.contatos);
      return localJsonResponse(contatosList);
    }

    if (endpoint === '/contacts' && method === 'POST') {
      const payload = JSON.parse(options.body || '[]');
      const itens = Array.isArray(payload) ? payload : [payload];
      itens.forEach(item => {
        if (item.id) {
          const idx = state.contatos.findIndex(c => c.id === item.id);
          if (idx >= 0) state.contatos[idx] = { ...state.contatos[idx], ...item };
          else state.contatos.push({ ...item, id: String(state.nextContactId++) });
        } else {
          state.contatos.push({ ...item, id: String(state.nextContactId++) });
        }
      });
      saveLocalPreviewState();
      contatosList = clonePreviewData(state.contatos);
      return localJsonResponse({ message: 'Contatos salvos com sucesso na prévia local.' });
    }

    if (endpoint.startsWith('/contacts?id=') && method === 'DELETE') {
      const id = new URLSearchParams(endpoint.split('?')[1] || '').get('id');
      state.contatos = state.contatos.filter(c => c.id !== id);
      saveLocalPreviewState();
      contatosList = clonePreviewData(state.contatos);
      return localJsonResponse({ message: 'Contato excluído na prévia local.' });
    }

    if (endpoint === '/contacts' && method === 'DELETE') {
      const payload = JSON.parse(options.body || '{}');
      const ids = payload.ids || (payload.id ? [payload.id] : []);
      const idsSet = new Set(ids.map(String));
      const antes = state.contatos.length;
      state.contatos = state.contatos.filter(c => !idsSet.has(String(c.id)));
      const excluidos = antes - state.contatos.length;
      saveLocalPreviewState();
      contatosList = clonePreviewData(state.contatos);
      return localJsonResponse({ message: `${excluidos} contato(s) excluído(s) na prévia local.` });
    }

    if (endpoint === '/config' && method === 'GET') {
      emailConfig = clonePreviewData(state.config);
      return localJsonResponse(emailConfig);
    }

    if (endpoint === '/config' && method === 'POST') {
      const payload = JSON.parse(options.body || '{}');
      state.config = { ...state.config, ...payload };
      saveLocalPreviewState();
      emailConfig = clonePreviewData(state.config);
      return localJsonResponse({ message: 'Configurações salvas na prévia local.' });
    }

    if (endpoint === '/users' && method === 'GET') {
      return localJsonResponse(state.usuarios.map(({ email, role }) => ({ email, role })));
    }

    if (endpoint === '/users' && method === 'POST') {
      const payload = JSON.parse(options.body || '{}');
      if (payload.action === 'criar-usuario') {
        state.usuarios.push({ email: payload.novoEmail, password: payload.novaSenha, role: payload.novoRole });
      } else if (payload.action === 'alterar-permissao') {
        const alvo = state.usuarios.find(u => u.email.toLowerCase() === payload.emailAlvo.toLowerCase());
        if (alvo) alvo.role = payload.novoRole;
      } else if (payload.action === 'redefinir-senha') {
        const alvo = state.usuarios.find(u => u.email.toLowerCase() === payload.emailAlvo.toLowerCase());
        if (alvo) alvo.password = payload.novaSenha;
      } else {
        const usuario = state.usuarios.find(u => u.email.toLowerCase() === (sessionStorage.getItem('parabensflow_email') || '').toLowerCase());
        if (usuario && payload.newEmail) usuario.email = payload.newEmail;
        if (usuario && payload.newPassword) usuario.password = payload.newPassword;
      }
      saveLocalPreviewState();
      return localJsonResponse({ message: 'Usuário atualizado na prévia local.', email: payload.newEmail || sessionStorage.getItem('parabensflow_email') });
    }

    if (endpoint.startsWith('/users?email=') && method === 'DELETE') {
      const emailEnc = new URLSearchParams(endpoint.split('?')[1] || '').get('email');
      const email = decodeURIComponent(emailEnc || '');
      state.usuarios = state.usuarios.filter(u => u.email.toLowerCase() !== email.toLowerCase());
      saveLocalPreviewState();
      return localJsonResponse({ message: 'Usuário removido na prévia local.' });
    }

    if (endpoint === '/trigger-manual' && method === 'POST') {
      return localJsonResponse({ message: 'Disparo manual simulado na prévia local.' });
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    }
  });

  if (res.status === 401) {
    tratarSessaoInvalida();
    throw new Error('Não autorizado');
  }

  return res;
}

// 3. Navegação de Abas
function setupTabs() {
  const tabs = document.querySelectorAll('.nav-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function setupSubTabs() {
  const subTabs = document.querySelectorAll('.sub-tab-btn');
  subTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      subTabs.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-subtab');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// 4. Gestão de Contatos (CRUD)
async function carregarContatos() {
  const tbody = document.getElementById('contactsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="loader"></div> Carregando...</td></tr>';

  try {
    if (erpEmployeesReceived) {
      contatosList = [...erpEmployees];
      contatosCarregados = true;
      renderizarContatos(contatosList);
      atualizarEstatisticas();
      renderizarBanner();
      return;
    }

    const res = await fetchAutenticado('/contacts');
    // A base do ERP é a fonte oficial. Uma resposta antiga do ParabénsFlow
    // não pode sobrescrever os funcionários recebidos via postMessage.
    if (erpEmployeesReceived) {
      contatosList = [...erpEmployees];
      contatosCarregados = true;
      renderizarContatos(contatosList);
      atualizarEstatisticas();
      renderizarBanner();
      return;
    }
    contatosList = await res.json();
    contatosCarregados = true;
    
    renderizarContatos(contatosList);
    atualizarEstatisticas();
    renderizarBanner();
  } catch (error) {
    if (error.message !== 'Não autorizado') {
      showToast(error.message, 'error');
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color: var(--error)">❌ Erro: ${error.message}</td></tr>`;
    }
  }
}

function renderizarContatos(contatos) {
  const tbody = document.getElementById('contactsTableBody');
  const role = sessionStorage.getItem('parabensflow_role');
  const showActions = role !== 'viewer';
  contatosRenderizadosAtuais = [...contatos];
  tbody.innerHTML = '';

  if (contatos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">👥</div>Nenhum contato cadastrado.</td></tr>';
    atualizarControlesSelecaoContatos();
    return;
  }

  contatos.forEach(c => {
    const tr = document.createElement('tr');
    
    let dataFormatada = '---';
    let idade = '---';
    if (c.data_nascimento) {
      dataFormatada = obterDataNascimentoExibicaoContato(c);

      if ((c.data_nascimento_original && /^\d{1,2}\/\d{1,2}$/.test(c.data_nascimento_original)) || (!c.data_nascimento_original && c.data_nascimento.startsWith('2000-'))) {
        idade = 'sem ano';
      } else {
        idade = calcularIdade(c.data_nascimento) + ' anos';
      }
    }

    tr.innerHTML = `
      <td style="font-weight: 600;">${escapeHTML(c.nome)}</td>
      <td>${escapeHTML(c.email)}</td>
      <td>${dataFormatada}</td>
      <td><span class="badge badge-primary">${idade}</span></td>
    `;
    tbody.appendChild(tr);
  });

  atualizarControlesSelecaoContatos();
}

function obterIdsContatosVisiveis() {
  return contatosRenderizadosAtuais.map(c => c.id);
}

function atualizarControlesSelecaoContatos() {
  const role = sessionStorage.getItem('parabensflow_role');
  const showBulkControls = role !== 'viewer';
  const bulkBar = document.getElementById('contactsBulkBar');
  const selectAll = document.getElementById('selectAllContacts');
  const bulkCount = document.getElementById('bulkSelectionCount');
  const bulkDeleteBtn = document.getElementById('btnBulkDeleteContacts');
  const bulkColumns = document.querySelectorAll('.bulk-column');

  bulkColumns.forEach(el => {
    el.style.display = showBulkControls ? '' : 'none';
  });

  if (bulkBar) bulkBar.style.display = showBulkControls ? 'flex' : 'none';

  if (!showBulkControls) {
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    if (bulkCount) bulkCount.textContent = '0 selecionados';
    if (bulkDeleteBtn) {
      bulkDeleteBtn.disabled = true;
      bulkDeleteBtn.textContent = 'Excluir selecionados';
    }
    return;
  }

  const idsVisiveis = obterIdsContatosVisiveis();
  const visiveisSelecionados = idsVisiveis.filter(id => contatosSelecionados.has(id));
  const totalSelecionados = contatosSelecionados.size;

  if (bulkCount) {
    bulkCount.textContent = `${totalSelecionados} selecionado${totalSelecionados === 1 ? '' : 's'}`;
  }

  if (bulkDeleteBtn) {
    bulkDeleteBtn.disabled = totalSelecionados === 0;
    bulkDeleteBtn.textContent = totalSelecionados > 0
      ? `Excluir selecionados (${totalSelecionados})`
      : 'Excluir selecionados';
  }

  if (selectAll) {
    selectAll.disabled = idsVisiveis.length === 0;
    selectAll.checked = idsVisiveis.length > 0 && visiveisSelecionados.length === idsVisiveis.length;
    selectAll.indeterminate = visiveisSelecionados.length > 0 && visiveisSelecionados.length < idsVisiveis.length;
  }
}

function toggleSelecionarContato(id, selecionado) {
  if (selecionado) contatosSelecionados.add(id);
  else contatosSelecionados.delete(id);
  atualizarControlesSelecaoContatos();
}

function selecionarTodosContatosVisiveis(selecionar) {
  obterIdsContatosVisiveis().forEach(id => {
    if (selecionar) contatosSelecionados.add(id);
    else contatosSelecionados.delete(id);
  });

  document.querySelectorAll('.contact-select-checkbox').forEach(cb => {
    cb.checked = selecionar;
  });

  atualizarControlesSelecaoContatos();
}

async function excluirContatosSelecionados() {
  if (contatosSelecionados.size === 0) {
    showToast('Selecione pelo menos um contato.', 'error');
    return;
  }

  const quantidade = contatosSelecionados.size;
  if (!await mostrarConfirm(`Deseja realmente excluir ${quantidade} contato${quantidade === 1 ? '' : 's'}?`)) return;

  const btn = document.getElementById('btnBulkDeleteContacts');
  const textoOriginal = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div> Excluindo...';
  }

  try {
    const ids = Array.from(contatosSelecionados);

    // Envia todos os IDs em uma única requisição para evitar race condition no Netlify Blobs
    const res = await fetchAutenticado('/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    const data = await res.json();

    contatosSelecionados.clear();
    await carregarContatos();

    if (res.ok) {
      showToast(data.message || `${ids.length} contato(s) excluído(s) com sucesso!`, 'success');
    } else {
      showToast(data.error || 'Erro ao excluir contatos.', 'error');
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = textoOriginal || 'Excluir selecionados';
    }
    atualizarControlesSelecaoContatos();
  }
}

async function salvarContato(event) {
  event.preventDefault();
  
  const id = document.getElementById('contactId').value;
  const nome = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const data_nascimento = document.getElementById('contactBirthdate').value;

  if (!nome || !email || !data_nascimento) {
    showToast('Por favor, preencha todos os campos.', 'error');
    return;
  }

  const contatoData = { nome, email, data_nascimento };
  if (id) contatoData.id = id;

  const btnSubmit = document.getElementById('btnSubmitContact');
  const textoOriginal = btnSubmit.textContent;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<div class="loader"></div> Salvando...';

  try {
    const res = await fetchAutenticado('/contacts', {
      method: 'POST',
      body: JSON.stringify(contatoData)
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao salvar contato no servidor.');

    showToast(resData.message || 'Contato salvo com sucesso!', 'success');
    limparFormularioContato();
    await carregarContatos();
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = textoOriginal;
  }
}

function iniciarEdicao(id) {
  const contato = contatosList.find(c => c.id === id);
  if (!contato) return;

  document.getElementById('contactId').value = contato.id;
  document.getElementById('contactName').value = contato.nome;
  document.getElementById('contactEmail').value = contato.email;
  document.getElementById('contactBirthdate').value = contato.data_nascimento;

  document.getElementById('btnSubmitContact').textContent = 'Atualizar Contato';
  document.getElementById('btnCancelEdit').style.display = 'inline-flex';
  
  document.getElementById('contactForm').scrollIntoView({ behavior: 'smooth' });
}

function limparFormularioContato() {
  document.getElementById('contactId').value = '';
  document.getElementById('contactName').value = '';
  document.getElementById('contactEmail').value = '';
  document.getElementById('contactBirthdate').value = '';

  document.getElementById('btnSubmitContact').textContent = 'Salvar Contato';
  document.getElementById('btnCancelEdit').style.display = 'none';
}

async function excluirContato(id) {
  if (!await mostrarConfirm('Deseja realmente excluir este contato?')) return;

  try {
    const res = await fetchAutenticado(`/contacts?id=${id}`, {
      method: 'DELETE'
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao excluir contato.');

    contatosSelecionados.delete(id);
    showToast(resData.message || 'Contato excluído!', 'success');
    await carregarContatos();
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  }
}

// 5. Importação em Lote
async function importarListaContatos(event) {
  event.preventDefault();

  const text = document.getElementById('bulkTextarea').value;
  if (!text.trim()) {
    showToast('A lista de contatos está vazia.', 'error');
    return;
  }

  const linhas = text.split('\n');
  const contatosValidos = [];
  const erros = [];

  linhas.forEach((linha, index) => {
    const l = linha.trim().replace(/\r$/, '');
    if (!l) return;

    const separador = detectarSeparadorLinha(l);
    if (!separador) {
      erros.push(`Linha ${index + 1}: separador não identificado.`);
      return;
    }

    const partes = dividirLinhaCSV(l, separador);

    if (partes.length < 3) {
      erros.push(`Linha ${index + 1}: Deve conter Nome, E-mail e Data.`);
      return;
    }

    if (index === 0 && linhaEhCabecalho(partes)) {
      return;
    }

    const [nome, email, ...resto] = partes;
    const dataNascStr = resto.join(separador === '\t' ? '\t' : separador).trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      erros.push(`Linha ${index + 1}: E-mail inválido (${email}).`);
      return;
    }

    const dataNascimento = normalizarDataNascimento(dataNascStr);
    if (!dataNascimento) {
      erros.push(`Linha ${index + 1}: Formato de data desconhecido (${dataNascStr}). Use DD/MM/AAAA, DD-MM-AAAA ou AAAA-MM-DD.`);
      return;
    }

    contatosValidos.push({
      nome,
      email,
      data_nascimento: dataNascimento,
      data_nascimento_original: formatarDataNascimentoExibicao(dataNascStr)
    });
  });

  if (contatosValidos.length === 0) {
    showToast('Nenhum contato válido encontrado.', 'error');
    if (erros.length > 0) {
      logConsole('[Importador] Erros de validação:\n' + erros.join('\n'), 'error');
    }
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitBulk');
  const textoOriginal = btnSubmit.textContent;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<div class="loader"></div> Importando...';

  try {
    const res = await fetchAutenticado('/contacts', {
      method: 'POST',
      body: JSON.stringify(contatosValidos)
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao importar contatos.');

    showToast(resData.message || 'Contatos importados!', 'success');
    logConsole(`[Importador] Sucesso: contatos salvos no Netlify Blobs.`, 'success');
    
    if (erros.length > 0) {
      logConsole(`[Importador] Linhas ignoradas:\n` + erros.join('\n'), 'warning');
    }

    document.getElementById('bulkTextarea').value = '';
    await carregarContatos();
  } catch (error) {
    if (error.message !== 'Não autorizado') {
      showToast(error.message, 'error');
      logConsole(`[Importador] Erro: ${error.message}`, 'error');
    }
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = textoOriginal;
  }
}

// 6. Gestão de Configurações / Template
let imagemTemplateRemovida = false;

async function carregarConfiguracoes() {
  try {
    const res = await fetchAutenticado('/config');
    emailConfig = await res.json();

    document.getElementById('emailSubject').value = emailConfig.email_assunto || '';
    document.getElementById('emailBody').value = emailConfig.email_template || '';
    document.getElementById('emailCC').value = emailConfig.email_cc || '';
    document.getElementById('emailCCO').value = emailConfig.email_cco || '';
    document.getElementById('emailImagemInput').value = '';
    imagemTemplateRemovida = false;
    exibirPreviewImagemTemplate(emailConfig.email_imagem || '');
  } catch (error) {
    console.error('Erro ao carregar configurações:', error);
  }
}

function exibirPreviewImagemTemplate(dataUrl) {
  const wrapper = document.getElementById('emailImagemPreviewWrapper');
  const preview = document.getElementById('emailImagemPreview');
  if (dataUrl) {
    preview.src = dataUrl;
    wrapper.style.display = 'block';
  } else {
    preview.src = '';
    wrapper.style.display = 'none';
  }
}

function lerArquivoComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

function removerImagemTemplate() {
  imagemTemplateRemovida = true;
  document.getElementById('emailImagemInput').value = '';
  exibirPreviewImagemTemplate('');
}

async function salvarConfiguracoes(event) {
  event.preventDefault();

  const email_assunto = document.getElementById('emailSubject').value.trim();
  const email_template = document.getElementById('emailBody').value.trim();

  if (!email_assunto || !email_template) {
    showToast('Preencha o assunto e o corpo do e-mail.', 'error');
    return;
  }

  const email_cc = document.getElementById('emailCC').value.trim();
  const email_cco = document.getElementById('emailCCO').value.trim();

  const payload = { email_assunto, email_template, email_cc, email_cco };

  const arquivoImagem = document.getElementById('emailImagemInput').files[0];
  if (arquivoImagem) {
    if (arquivoImagem.size > 1.5 * 1024 * 1024) {
      showToast('A imagem deve ter no máximo 1,5 MB.', 'error');
      return;
    }
    try {
      payload.email_imagem = await lerArquivoComoBase64(arquivoImagem);
    } catch (error) {
      showToast(error.message, 'error');
      return;
    }
  } else if (imagemTemplateRemovida) {
    payload.email_imagem = '';
  }

  try {
    const res = await fetchAutenticado('/config', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao salvar configurações.');

    emailConfig = { ...emailConfig, ...payload };
    imagemTemplateRemovida = false;
    document.getElementById('emailImagemInput').value = '';
    showToast(resData.message || 'Configurações de e-mail salvas!', 'success');
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  }
}

// 7. Gestão de Perfil / Acesso
async function alterarPerfil(event) {
  event.preventDefault();

  const newEmail = document.getElementById('profileEmail').value.trim();
  const newPassword = document.getElementById('profileNewPassword').value;
  const confirmPassword = document.getElementById('profileConfirmPassword').value;
  const currentPassword = document.getElementById('profileCurrentPassword').value;
  const btnSubmit = document.getElementById('btnSubmitProfile');

  if (!currentPassword) {
    showToast('A senha atual é necessária para confirmar.', 'error');
    return;
  }

  if (newPassword && newPassword.length < 6) {
    showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (newPassword && newPassword !== confirmPassword) {
    showToast('As senhas não coincidem.', 'error');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<div class="loader"></div> Salvando...';

  try {
    const res = await fetchAutenticado('/users', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newEmail, newPassword })
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao alterar dados no servidor.');

    sessionStorage.setItem('parabensflow_email', resData.email);
    showToast(resData.message || 'Dados atualizados!', 'success');
    
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';
    document.getElementById('profileCurrentPassword').value = '';
    checkSession();
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Salvar Alterações';
  }
}

async function adicionarNovoAdmin(event) {
  event.preventDefault();

  const novoEmail = document.getElementById('newAdminEmail').value.trim();
  const novaSenha = document.getElementById('newAdminPassword').value;
  const novoRole = document.getElementById('newAdminRole').value;
  const btnSubmit = document.getElementById('btnSubmitNewAdmin');

  if (novaSenha.length < 6) {
    showToast('A senha provisória deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<div class="loader"></div> Adicionando...';

  try {
    const res = await fetchAutenticado('/users', {
      method: 'POST',
      body: JSON.stringify({ action: 'criar-usuario', novoEmail, novaSenha, novoRole })
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao adicionar usuário.');

    showToast(resData.message || 'Usuário adicionado!', 'success');
    document.getElementById('newAdminForm').reset();
    await carregarUsuarios();
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Adicionar Usuário';
  }
}

async function carregarUsuarios() {
  const tbody = document.getElementById('usersTableBody');
  const meuEmail = (sessionStorage.getItem('parabensflow_email') || '').toLowerCase();

  try {
    const res = await fetchAutenticado('/users');
    const usuarios = await res.json();

    tbody.innerHTML = '';
    usuarios.forEach(u => {
      const ehVoceMesmo = u.email.toLowerCase() === meuEmail;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(u.email)}</td>
        <td>${ehVoceMesmo
          ? `<span class="badge badge-primary">${nomeDoRole(u.role)}</span>`
          : `<select class="form-control role-select" onchange="alterarPermissao('${encodeURIComponent(u.email)}', this)" data-role-atual="${u.role || 'viewer'}">
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador</option>
              <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
              <option value="viewer" ${u.role !== 'admin' && u.role !== 'editor' ? 'selected' : ''}>Leitor</option>
            </select>`
        }</td>
        <td>${ehVoceMesmo
          ? '<span style="color: var(--text-secondary); font-size: 0.85rem;">Você</span>'
          : `<div class="actions-cell">
              <button type="button" class="action-btn" onclick="abrirRedefinirSenha('${encodeURIComponent(u.email)}')" title="Redefinir senha">🔑</button>
              <button type="button" class="action-btn delete" onclick="removerUsuario('${encodeURIComponent(u.email)}')" title="Remover">🗑️</button>
            </div>`
        }</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    if (error.message !== 'Não autorizado') {
      tbody.innerHTML = `<tr><td colspan="3" class="empty-state" style="color: var(--error)">❌ Erro: ${error.message}</td></tr>`;
    }
  }
}

async function removerUsuario(emailCodificado) {
  const email = decodeURIComponent(emailCodificado);
  if (!await mostrarConfirm(`Remover o acesso de ${email}?`)) return;

  try {
    const res = await fetchAutenticado(`/users?email=${emailCodificado}`, {
      method: 'DELETE'
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao remover usuário.');

    showToast(resData.message || 'Usuário removido!', 'success');
    await carregarUsuarios();
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  }
}

async function alterarPermissao(emailCodificado, select) {
  const email = decodeURIComponent(emailCodificado);
  const novoRole = select.value;
  const roleAnterior = select.dataset.roleAtual;
  const nomeRole = nomeDoRole(novoRole);

  if (!await mostrarConfirm(`Alterar o acesso de ${email} para ${nomeRole}?`)) {
    select.value = roleAnterior;
    return;
  }

  select.disabled = true;
  try {
    const res = await fetchAutenticado('/users', {
      method: 'POST',
      body: JSON.stringify({ action: 'alterar-permissao', emailAlvo: email, novoRole })
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao alterar permissão.');

    select.dataset.roleAtual = novoRole;
    showToast(resData.message || 'Permissão alterada!', 'success');
  } catch (error) {
    select.value = roleAnterior;
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  } finally {
    select.disabled = false;
  }
}

function abrirRedefinirSenha(emailCodificado) {
  const email = decodeURIComponent(emailCodificado);
  document.getElementById('resetPasswordEmail').value = email;
  document.getElementById('resetPasswordEmailLabel').textContent = email;
  document.getElementById('resetPasswordNew').value = '';
  document.getElementById('resetPasswordConfirm').value = '';
  document.getElementById('resetPasswordModal').classList.add('active');
  document.getElementById('resetPasswordNew').focus();
}

function fecharRedefinirSenha() {
  document.getElementById('resetPasswordModal').classList.remove('active');
}

async function salvarRedefinirSenha(e) {
  e.preventDefault();
  const emailAlvo = document.getElementById('resetPasswordEmail').value;
  const novaSenha = document.getElementById('resetPasswordNew').value;
  const confirmacao = document.getElementById('resetPasswordConfirm').value;

  if (novaSenha.length < 6) {
    showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }
  if (novaSenha !== confirmacao) {
    showToast('As senhas não conferem.', 'error');
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitResetPassword');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Salvando...';

  try {
    const res = await fetchAutenticado('/users', {
      method: 'POST',
      body: JSON.stringify({ action: 'redefinir-senha', emailAlvo, novaSenha })
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || 'Erro ao redefinir senha.');

    showToast(resData.message || 'Senha redefinida!', 'success');
    fecharRedefinirSenha();
  } catch (error) {
    if (error.message !== 'Não autorizado') showToast(error.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Salvar Nova Senha';
  }
}

// 8. Estatísticas Rápidas
function atualizarEstatisticas() {
  const total = contatosList.length;
  document.getElementById('statTotal').textContent = total;

  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const diaAtual = String(hoje.getDate()).padStart(2, '0');

  let niverMes = 0;
  let niverHoje = 0;
  const aniversariantesMes = [];

  contatosList.forEach(c => {
    if (c.data_nascimento) {
      const partes = c.data_nascimento.split('-');
      const mes = partes[1];
      const dia = partes[2];

      if (mes === mesAtual) {
        niverMes++;
        aniversariantesMes.push({ nome: c.nome, dia, hoje: dia === diaAtual });
        if (dia === diaAtual) {
          niverHoje++;
        }
      }
    }
  });

  document.getElementById('statMonth').textContent = niverMes;
  document.getElementById('statToday').textContent = niverHoje;

  // Lista de nomes dos aniversariantes do mês, ordenada por dia
  aniversariantesMes.sort((a, b) => a.dia.localeCompare(b.dia));
  document.getElementById('statMonthList').innerHTML = aniversariantesMes
    .map(a => `<li class="${a.hoje ? 'today' : ''}"><span class="stat-names-day">${a.dia}</span>${escapeHTML(a.nome)}${a.hoje ? ' 🎂' : ''}</li>`)
    .join('');
}

// 9. Barra de Busca
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    const termo = e.target.value.toLowerCase().trim();
    if (!termo) {
      renderizarContatos(contatosList);
      return;
    }

    const filtrados = contatosList.filter(c => {
      const nomeMatch = c.nome && c.nome.toLowerCase().includes(termo);
      const emailMatch = c.email && c.email.toLowerCase().includes(termo);
      return nomeMatch || emailMatch;
    });

    renderizarContatos(filtrados);
  });
}

// 10. Disparo Manual & Console
function setupConsole() {
  const btnClear = document.getElementById('btnClearConsole');
  btnClear.addEventListener('click', () => {
    const consoleDiv = document.getElementById('systemConsole');
    consoleDiv.innerHTML = '<div class="console-line info">[Sistema] Console limpo.</div>';
  });

  const btnRun = document.getElementById('btnRunManual');
  btnRun.addEventListener('click', executarVerificacaoManual);
}

async function executarVerificacaoManual() {
  const btnRun = document.getElementById('btnRunManual');
  const consoleStatus = document.getElementById('consoleStatus');
  
  btnRun.disabled = true;
  btnRun.innerHTML = '<div class="loader"></div> Processando...';
  consoleStatus.textContent = 'Processando...';
  logConsole('[Cron] Iniciando verificação manual de aniversariantes...', 'info');

  try {
    const res = await fetchAutenticado('/trigger-manual');
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || `Erro no servidor (HTTP ${res.status})`);

    const detalhes = resData.detalhes || [];
    logConsole(`[Servidor] Aniversariantes encontrados: ${resData.totalAniversariantes ?? detalhes.length}`, 'info');

    detalhes.forEach(env => {
      if (env.enviado) {
        logConsole(`[Sucesso] E-mail enviado para: ${env.nome} (${env.email})`, 'success');
      } else {
        logConsole(`[Falha] Erro ao enviar para: ${env.nome} (${env.email}) - Detalhe: ${JSON.stringify(env.detalhe)}`, 'error');
      }
    });

    if (detalhes.length > 0) {
      showToast(`Envio concluído! Sucessos: ${resData.enviados}`, 'success');
    } else {
      showToast('Nenhum aniversariante hoje.', 'info');
    }
  } catch (error) {
    if (error.message !== 'Não autorizado') {
      logConsole(`[Erro Crítico] ${error.message}`, 'error');
      showToast(error.message, 'error');
    }
  } finally {
    btnRun.disabled = false;
    btnRun.textContent = '🚀 Verificar e Disparar E-mails do Dia';
    consoleStatus.textContent = 'Pronto';
  }
}

// 11. Funções Utilitárias
function logConsole(message, type = 'info') {
  const consoleDiv = document.getElementById('systemConsole');
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = message;
  consoleDiv.appendChild(line);
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span>${escapeHTML(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Calcular Idade
function calcularIdade(dataNasc) {
  if (!dataNasc) return 0;
  const nasc = new Date(dataNasc);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 12. Banner de Aniversariantes (calendário anual para impressão)
const BANNER_LS_KEY = 'parabensflow_banner_config';
const BANNER_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const BANNER_FORMATOS = {
  a4: {
    pageWidth: 794,
    pageHeight: 1123,
    scale: 1,
    jsPdfFormat: 'a4',
    pageClass: 'banner-format-a4',
    pageName: 'banner-a4'
  },
  a3: {
    pageWidth: 1123,
    pageHeight: 1587,
    scale: Math.SQRT2,
    jsPdfFormat: 'a3',
    pageClass: 'banner-format-a3',
    pageName: 'banner-a3'
  }
};

const BANNER_PALETAS = {
  colorida: {
    titulo: '#2A9D8F',
    ligacao: '#2A9D8F',
    cores: ['#D7362E', '#F2A33C', '#83305D', '#2E9C82', '#332C5C', '#2FA8DF', '#2D6DB4', '#A04434', '#DE3D7B', '#33998A', '#9C86C6', '#74B043']
  },
  pastel: {
    titulo: '#8AB6C9',
    ligacao: '#F2AECB',
    cores: ['#F2A6A2', '#F7C59F', '#D4A5C9', '#9FD8C3', '#B3AEDC', '#A5D8F3', '#A9C7EB', '#E0B0A0', '#F4B8D0', '#ABD9C7', '#CBBCE8', '#BCD9A0']
  },
  azul: {
    titulo: '#2660A4',
    ligacao: '#56A3D9',
    cores: ['#1B3B6F', '#2660A4', '#3D85C6', '#56A3D9', '#76B9E3', '#1F4E79', '#2E75B6', '#4A90C4', '#63A5D8', '#274472', '#3566A0', '#5C8FC7']
  },
  elegante: {
    titulo: '#B08D3E',
    ligacao: '#8A8A8A',
    cores: ['#333333', '#B08D3E', '#5C5C5C', '#8A6D2F', '#404040', '#C09A45', '#2B2B2B', '#9C7B35', '#4D4D4D', '#B08D3E', '#383838', '#8A6D2F']
  }
};

const BANNER_CONFIG_PADRAO = {
  titulo1: 'Calendário',
  ligacao: 'dos',
  titulo2: 'Aniversariantes',
  paleta: 'colorida',
  fonte: "'Dancing Script', cursive",
  corNomes: '#2A66C9',
  nomeExibicao: 'primeiro',
  formato: 'a4',
  baloes: true,
  bolo: true,
  dia: true
};

let bannerConfig = { ...BANNER_CONFIG_PADRAO };

function setupBanner() {
  try {
    const salvo = JSON.parse(localStorage.getItem(BANNER_LS_KEY));
    if (salvo) bannerConfig = { ...BANNER_CONFIG_PADRAO, ...salvo };
  } catch (e) { /* configuração corrompida: usa o padrão */ }

  aplicarConfigBannerNosControles();

  const atualizarBanner = () => {
    lerConfigBannerDosControles();
    localStorage.setItem(BANNER_LS_KEY, JSON.stringify(bannerConfig));
    renderizarBanner();
  };

  document.getElementById('bannerForm').addEventListener('input', atualizarBanner);
  document.getElementById('bannerForm').addEventListener('change', atualizarBanner);

  document.getElementById('btnBannerReset').addEventListener('click', () => {
    bannerConfig = { ...BANNER_CONFIG_PADRAO };
    localStorage.removeItem(BANNER_LS_KEY);
    aplicarConfigBannerNosControles();
    renderizarBanner();
    showToast('Banner restaurado para o padrão.', 'info');
  });

  document.getElementById('btnBannerPDF').addEventListener('click', baixarBannerPDF);
  document.getElementById('btnBannerPrint').addEventListener('click', imprimirBanner);

  // A aba fica oculta (display: none) até ser aberta, então a escala precisa ser recalculada ao entrar nela
  const navBanner = document.querySelector('button[data-tab="tab-banner"]');
  if (navBanner) {
    navBanner.addEventListener('click', () => {
      renderizarBanner();
      requestAnimationFrame(ajustarEscalaBanner);
    });
  }
  window.addEventListener('resize', ajustarEscalaBanner);

  renderizarBanner();
}

function aplicarConfigBannerNosControles() {
  document.getElementById('bannerTitulo1').value = bannerConfig.titulo1;
  document.getElementById('bannerLigacao').value = bannerConfig.ligacao;
  document.getElementById('bannerTitulo2').value = bannerConfig.titulo2;
  document.getElementById('bannerPaleta').value = bannerConfig.paleta;
  document.getElementById('bannerFonte').value = bannerConfig.fonte;
  document.getElementById('bannerCorNomes').value = bannerConfig.corNomes;
  document.getElementById('bannerNomeExibicao').value = bannerConfig.nomeExibicao;
  document.getElementById('bannerMostrarBaloes').checked = bannerConfig.baloes;
  document.getElementById('bannerMostrarBolo').checked = bannerConfig.bolo;
  document.getElementById('bannerMostrarDia').checked = bannerConfig.dia;
}

function lerConfigBannerDosControles() {
  bannerConfig = {
    titulo1: document.getElementById('bannerTitulo1').value,
    ligacao: document.getElementById('bannerLigacao').value,
    titulo2: document.getElementById('bannerTitulo2').value,
    paleta: document.getElementById('bannerPaleta').value,
    fonte: document.getElementById('bannerFonte').value,
    corNomes: document.getElementById('bannerCorNomes').value,
    nomeExibicao: document.getElementById('bannerNomeExibicao').value,
    formato: 'a4',
    baloes: document.getElementById('bannerMostrarBaloes').checked,
    bolo: document.getElementById('bannerMostrarBolo').checked,
    dia: document.getElementById('bannerMostrarDia').checked
  };
}

function obterFormatoBanner() {
  return BANNER_FORMATOS[bannerConfig.formato] || BANNER_FORMATOS.a4;
}

function bannerBalaoSVG() {
  const bolinhas = [
    [30, 20, 9, '#D7362E'], [45, 28, 6, '#F2A33C'], [18, 28, 6, '#74B043'],
    [30, 38, 7, '#2D6DB4'], [42, 42, 5, '#83305D'], [19, 42, 4, '#E0447C'],
    [33, 52, 5, '#F2A33C'], [24, 12, 4, '#2FA8DF'], [40, 13, 4, '#74B043']
  ];
  const circulos = bolinhas.map(([cx, cy, r, cor]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cor}"/>`).join('');
  return `<svg viewBox="0 0 60 104" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="32" rx="26" ry="30" fill="#ffffff" stroke="#444444" stroke-width="1.5"/>
    ${circulos}
    <path d="M27 62 l3 6 l3 -6 z" fill="#444444"/>
    <path d="M30 68 q -6 12 0 22 q 5 8 -2 12" stroke="#444444" fill="none" stroke-width="1.5"/>
  </svg>`;
}

function bannerBoloSVG() {
  return `<img src="assets/bolo_ia.png" alt="Bolo de aniversário" />`;
}

function bannerFrameSVG(cor, index) {
  return '';
}

function renderizarBanner() {
  const page = document.getElementById('bannerPage');
  if (!page) return;

  const cfg = bannerConfig;
  const formato = obterFormatoBanner();
  const paleta = BANNER_PALETAS[cfg.paleta] || BANNER_PALETAS.colorida;

  // Atualiza o título da prévia com o formato correto
  const tituloPrevia = document.querySelector('#tab-banner .glass-panel:last-child .form-title');
  if (tituloPrevia) {
    tituloPrevia.innerHTML = `<span>👁️</span> Prévia (folha A4)`;
  }

  // Agrupa os contatos por mês de aniversário
  const meses = Array.from({ length: 12 }, () => []);
  contatosList.forEach(c => {
    if (!c.data_nascimento) return;
    const partes = c.data_nascimento.split('-');
    const mesIndex = parseInt(partes[1], 10) - 1;
    if (mesIndex < 0 || mesIndex > 11) return;

    let nome = (c.nome || '').trim();
    if (cfg.nomeExibicao === 'primeiro') nome = nome.split(/\s+/)[0];
    meses[mesIndex].push({ dia: partes[2], nome });
  });
  meses.forEach(lista => lista.sort((a, b) => parseInt(a.dia, 10) - parseInt(b.dia, 10)));

  const cards = BANNER_MESES.map((nomeMes, i) => {
    const cor = paleta.cores[i % paleta.cores.length];
    const lista = meses[i];
    const densidade = lista.length > 7 ? ' dense' : (lista.length > 5 ? ' medium' : '');
    const nomesHTML = lista
      .map(p => cfg.dia
        ? `<div class="birthday-entry"><span class="bday-day">${p.dia}</span><span class="bday-name">${escapeHTML(p.nome)}</span></div>`
        : `<div class="birthday-entry no-day"><span class="bday-name">${escapeHTML(p.nome)}</span></div>`)
      .join('');
    return `<div class="month-card" style="--mc: ${cor}">
      <div class="month-tab">${escapeHTML(nomeMes)}</div>
      <div class="month-names${densidade}"><div class="names-list${cfg.dia ? '' : ' no-day'}">${nomesHTML || '<span class="bday-name" style="opacity:0.35">Carregando...</span>'}</div></div>
    </div>`;
  }).join('');

  const baloes = cfg.baloes ? `
    <div class="banner-balloon" style="top: 218px; left: 16px;">${bannerBalaoSVG()}</div>
    <div class="banner-balloon" style="top: 478px; right: 10px;">${bannerBalaoSVG()}</div>
    <div class="banner-balloon" style="top: 712px; left: 12px;">${bannerBalaoSVG()}</div>
    <div class="banner-balloon" style="top: 942px; right: 252px;">${bannerBalaoSVG()}</div>` : '';

  page.style.setProperty('--banner-font', cfg.fonte);
  page.style.setProperty('--names-color', cfg.corNomes);
  page.style.setProperty('--banner-page-width', `${formato.pageWidth}px`);
  page.style.setProperty('--banner-page-height', `${formato.pageHeight}px`);
  page.style.setProperty('--banner-sheet-scale', String(formato.scale));
  page.dataset.formato = cfg.formato || 'a4';

  page.innerHTML = `
    <div class="banner-sheet">
      <svg width="0" height="0" style="position:absolute; pointer-events:none;" aria-hidden="true">
        <defs>
          <filter id="brush-stroke" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="3" result="noise"></feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          </filter>
        </defs>
      </svg>
      ${baloes}
      <div class="banner-header">
        ${cfg.bolo ? `<div class="banner-cake">${bannerBoloSVG()}</div>` : ''}
        <div class="banner-title">
          <div><span class="t1" style="color: ${paleta.titulo}">${escapeHTML(cfg.titulo1)}</span>${cfg.ligacao ? ` <span class="lig" style="color: ${paleta.ligacao}">${escapeHTML(cfg.ligacao)}</span>` : ''}</div>
          <div><span class="t2" style="color: ${paleta.titulo}">${escapeHTML(cfg.titulo2)}</span></div>
        </div>
      </div>
      <div class="banner-grid">${cards}</div>
    </div>`;

  ajustarEscalaBanner();
}

function ajustarEscalaBanner() {
  const wrap = document.getElementById('bannerPreviewWrap');
  const page = document.getElementById('bannerPage');
  if (!wrap || !page) return;

  const formato = obterFormatoBanner();
  const largura = wrap.clientWidth;
  if (!largura) return; // aba oculta

  const escala = Math.min(1, largura / formato.pageWidth);
  page.style.transform = `scale(${escala})`;
  wrap.style.height = `${Math.ceil(formato.pageHeight * escala)}px`;
}

async function baixarBannerPDF() {
  if (typeof html2pdf === 'undefined') {
    showToast('Biblioteca de PDF não carregada. Use "Imprimir" e salve como PDF.', 'error');
    return;
  }

  const btn = document.getElementById('btnBannerPDF');
  const formato = obterFormatoBanner();

  renderizarBanner();
  btn.disabled = true;
  btn.innerHTML = '<div class="loader"></div> Gerando PDF...';
  document.body.classList.add('pdf-banner-mode');

  const source = document.getElementById('bannerPage');
  if (source) {
    source.classList.add('pdf-banner-mode');
  }
  const wrap = document.getElementById('bannerPreviewWrap');
  if (!source) {
    btn.disabled = false;
    btn.textContent = '📥 Baixar PDF';
    showToast('Não foi possível preparar o banner para exportação.', 'error');
    return;
  }

  const originalStyle = source.getAttribute('style');
  const originalWrapStyle = wrap?.getAttribute('style') || null;

  source.style.transform = 'none';
  source.style.width = '794px';
  source.style.height = '1123px';
  source.style.margin = '0';
  source.style.borderRadius = '0';
  source.style.boxShadow = 'none';
  source.style.background = '#ffffff';
  source.style.backgroundImage = 'none';
  source.style.position = 'relative';
  source.style.left = '0';
  source.style.top = '0';
  source.style.setProperty('--banner-sheet-scale', '1');

  if (wrap) {
    wrap.style.overflow = 'visible';
    wrap.style.width = '100%';
  }

  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  try {
    const filename = `banner-aniversariantes-${new Date().getFullYear()}.pdf`;

    if (typeof htmlToImage === 'undefined') {
      throw new Error('Biblioteca de exportação de imagem não carregada.');
    }

    // Captura com htmlToImage para suportar os wobbly borders de forma idêntica à tela
    const dataUrl = await htmlToImage.toPng(source, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: {
        transform: 'none',
        width: '794px',
        height: '1123px',
        margin: '0',
        borderRadius: '0',
        boxShadow: 'none',
        left: '0',
        top: '0',
        background: '#ffffff'
      }
    });

    const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDFClass) {
      throw new Error('Biblioteca de geração de PDF não encontrada.');
    }

    const pdf = new jsPDFClass({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);

    showToast('PDF do banner gerado com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao gerar PDF: ' + error.message, 'error');
  } finally {
    if (originalStyle === null) {
      source.removeAttribute('style');
    } else {
      source.setAttribute('style', originalStyle);
    }

    if (wrap) {
      if (originalWrapStyle === null) {
        wrap.removeAttribute('style');
      } else {
        wrap.setAttribute('style', originalWrapStyle);
      }
    }

    document.body.classList.remove('pdf-banner-mode', 'banner-format-a4', 'banner-format-a3');
    if (source) {
      source.classList.remove('pdf-banner-mode', 'banner-format-a4', 'banner-format-a3');
    }
    btn.disabled = false;
    btn.textContent = '📥 Baixar PDF';
    ajustarEscalaBanner();
  }
}

function imprimirBanner() {
  renderizarBanner();

  document.body.classList.add('print-banner-mode');
  
  const source = document.getElementById('bannerPage');
  if (source) {
    source.classList.add('print-banner-mode');
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-banner-mode');
    if (source) {
      source.classList.remove('print-banner-mode');
    }
  }, { once: true });
  setTimeout(() => window.print(), 100);
}

function setupForms() {
  document.getElementById('loginForm').addEventListener('submit', fazerLogin);
  document.getElementById('resetPasswordForm').addEventListener('submit', salvarRedefinirSenha);
  document.getElementById('btnHeaderLogout').addEventListener('click', () => logout());
  document.getElementById('profileForm').addEventListener('submit', alterarPerfil);
  document.getElementById('newAdminForm').addEventListener('submit', adicionarNovoAdmin);
  document.getElementById('contactForm').addEventListener('submit', salvarContato);
  document.getElementById('bulkForm').addEventListener('submit', importarListaContatos);
  document.getElementById('templateForm').addEventListener('submit', salvarConfiguracoes);
  document.getElementById('selectAllContacts').addEventListener('change', (e) => {
    selecionarTodosContatosVisiveis(e.target.checked);
  });
  document.getElementById('btnBulkDeleteContacts').addEventListener('click', excluirContatosSelecionados);
  document.getElementById('emailImagemInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await lerArquivoComoBase64(file);
      exibirPreviewImagemTemplate(dataUrl);
      imagemTemplateRemovida = false;
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
  document.getElementById('btnRemoverImagemTemplate').addEventListener('click', removerImagemTemplate);
  document.getElementById('btnCancelEdit').addEventListener('click', limparFormularioContato);
}
