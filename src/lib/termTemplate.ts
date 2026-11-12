// Modelos editáveis dos termos de entrega/devolução e montagem do documento para impressão.
import { isSupabaseConfigured, supabase } from './supabase';

export type TermTemplateId = 'termo_entrega' | 'termo_devolucao';

export interface TermTemplate {
  id: TermTemplateId;
  title: string;
  /** Texto do termo. Linha em branco separa parágrafos; **texto** = negrito; "## " no início = subtítulo */
  body: string;
  /** Uma assinatura por linha (linha em branco para assinar à mão + o texto embaixo) */
  signatures: string;
  /** Texto do rodapé (vazio = sem rodapé) */
  footer: string;
  show_logo: boolean;
  updated_at?: string;
}

export interface TermData {
  type: 'entrega' | 'devolucao';
  employee: {
    full_name: string;
    email?: string;
    role_title?: string;
    department?: string;
    unit?: string;
    registration_number?: string;
    cpf?: string;
  };
  items: { patrimony: string; description?: string }[];
  date: string; // AAAA-MM-DD
  notes?: string | null;
  responsible?: string | null;
}

export const ORGANIZATION_NAME = (import.meta.env.VITE_ORGANIZATION_NAME as string) || 'Geniantis';

export const TERM_LABEL: Record<TermTemplateId, string> = {
  termo_entrega: 'Termo de entrega',
  termo_devolucao: 'Termo de devolução',
};

const BLANK_NAME = '______________________________________________';
const BLANK_CPF = '_____________________';
const BLANK_DATE = 'São Paulo, _____ de ____________________ de ________.';

// Padrão baseado no termo em papel da Fundação Geniantis: nome, CPF e data em
// branco para preencher à mão, e linhas de assinatura só com a função.
export const DEFAULT_TEMPLATES: Record<TermTemplateId, TermTemplate> = {
  termo_entrega: {
    id: 'termo_entrega',
    title: 'TERMO DE RECEBIMENTO – ENTREGA DE EQUIPAMENTO',
    body: [
      `Eu, ${BLANK_NAME} CPF: ${BLANK_CPF}, funcionário(a) da organização **FUNDAÇÃO GENIANTIS**, inscrita no CNPJ sob o número 03.177.308/0001-03, declaro para os devidos fins estar retirando neste ato o(s) equipamento(s) relacionado(s) abaixo, com carregador e bateria, para utilização estritamente profissional, sobre o(s) qual(is) assumo integral responsabilidade, devendo indenizar prejuízos decorrentes de eventual sinistro, ou reparos necessários, oriundos de má utilização, comprometendo-me a devolver prontamente o(s) equipamento(s) à empresa, quando solicitado, nas mesmas condições de uso em que fora(m) retirado(s).`,
      '{{ativos}}',
      'Declaro, ainda, ter ciência de que o equipamento poderá eventualmente ser substituído ao longo do tempo, por um equivalente ou superior, sem que isso venha a isentar qualquer responsabilidade aqui assumida.',
      'Sendo a presente declaração a expressão da verdade, firmo-a na presença da testemunha abaixo, para todos os efeitos legais.',
      `[centro]${BLANK_DATE}`,
    ].join('\n\n'),
    signatures: 'Colaborador(a)\nFundação Geniantis\nTestemunha',
    footer: 'Fundação Geniantis',
    show_logo: true,
  },
  termo_devolucao: {
    id: 'termo_devolucao',
    title: 'TERMO DE DEVOLUÇÃO DE EQUIPAMENTO',
    body: [
      `Eu, ${BLANK_NAME} CPF: ${BLANK_CPF}, funcionário(a) da organização **FUNDAÇÃO GENIANTIS**, inscrita no CNPJ sob o número 03.177.308/0001-03, declaro para os devidos fins estar devolvendo neste ato o(s) equipamento(s) relacionado(s) abaixo, que estava(m) sob minha responsabilidade.`,
      '{{ativos}}',
      'A **FUNDAÇÃO GENIANTIS** declara ter recebido o(s) equipamento(s) acima, conferido(s) no ato da devolução, ressalvadas as observações registradas neste termo.',
      '{{observacoes}}',
      'Sendo a presente declaração a expressão da verdade, firmo-a na presença da testemunha abaixo, para todos os efeitos legais.',
      `[centro]${BLANK_DATE}`,
    ].join('\n\n'),
    signatures: 'Colaborador(a)\nFundação Geniantis\nTestemunha',
    footer: 'Fundação Geniantis',
    show_logo: true,
  },
};

export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'funcionario', label: 'Nome do funcionário' },
  { key: 'cargo', label: 'Cargo' },
  { key: 'departamento', label: 'Departamento' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'email', label: 'E-mail' },
  { key: 'cpf', label: 'CPF' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'data', label: 'Data (DD/MM/AAAA)' },
  { key: 'data_extenso', label: 'Data por extenso' },
  { key: 'ativos', label: 'Tabela de ativos' },
  { key: 'quantidade', label: 'Quantidade de ativos' },
  { key: 'observacoes', label: 'Observações' },
  { key: 'responsavel', label: 'Responsável (quem imprime)' },
  { key: 'empresa', label: 'Nome da empresa' },
];

export const SAMPLE_DATA: TermData = {
  type: 'entrega',
  employee: {
    full_name: 'Maria da Silva Souza',
    email: 'maria.souza@geniantis.com',
    role_title: 'Analista Financeiro',
    department: 'Financeiro',
    unit: 'Matriz - São Paulo',
    registration_number: '000123',
    cpf: '123.456.789-09',
  },
  items: [
    { patrimony: '000003', description: 'Dell Inspiron 15 3511 · S/N 3J60WY3' },
    { patrimony: '000021', description: 'Monitor Dell P2422H' },
  ],
  date: new Date().toISOString().slice(0, 10),
  notes: 'Acompanha carregador e mouse.',
  responsible: 'Sidney Amorim',
};

/** Modelos salvos; o que não tiver linha no banco usa o padrão */
export async function loadTermTemplates(): Promise<Record<TermTemplateId, TermTemplate>> {
  const result = { ...DEFAULT_TEMPLATES };
  if (!isSupabaseConfigured) return result;
  const { data, error } = await supabase.from('document_templates').select('*');
  if (error) return result; // tabela ainda não criada ou sem acesso: usa o padrão
  for (const row of (data || []) as TermTemplate[]) {
    if (row.id in result) result[row.id] = { ...result[row.id], ...row };
  }
  return result;
}

export async function saveTermTemplate(template: TermTemplate, userId?: string): Promise<void> {
  const { error } = await supabase.from('document_templates').upsert({
    id: template.id,
    title: template.title,
    body: template.body,
    signatures: template.signatures,
    footer: template.footer,
    show_logo: template.show_logo,
    updated_by: userId || null,
  });
  if (error) {
    if (/document_templates/.test(error.message) && /exist|schema cache/i.test(error.message)) {
      throw new Error('A tabela de modelos ainda não existe. Rode a migration 20261112000013_document_templates.sql.');
    }
    if (error.code === '42501') throw new Error('Só o Admin pode alterar os modelos de termo.');
    throw new Error(error.message);
  }
}

/** Volta ao texto padrão (apaga o modelo salvo) */
export async function resetTermTemplate(id: TermTemplateId): Promise<void> {
  const { error } = await supabase.from('document_templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return `${d} de ${month} de ${y}`;
}

function assetsTable(items: TermData['items']): string {
  const rows = items
    .map((i) => `<tr><td class="pat">${escapeHtml(i.patrimony)}</td><td>${escapeHtml(i.description || 'Ativo')}</td></tr>`)
    .join('');
  return `<table class="assets"><thead><tr><th>Patrimônio</th><th>Descrição</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Monta o HTML completo do termo a partir do modelo e dos dados da movimentação */
export function renderTermHtml(template: TermTemplate, data: TermData, origin = window.location.origin): string {
  const values: Record<string, string> = {
    funcionario: data.employee.full_name || '',
    cargo: data.employee.role_title || '',
    departamento: data.employee.department || '',
    unidade: data.employee.unit || '',
    email: data.employee.email || '',
    cpf: data.employee.cpf || '',
    matricula: data.employee.registration_number || '',
    data: formatDate(data.date),
    data_extenso: formatDateLong(data.date),
    quantidade: String(data.items.length),
    observacoes: data.notes ? `Observações: ${data.notes}` : '',
    responsavel: data.responsible || '',
    empresa: ORGANIZATION_NAME,
  };

  // Texto já escapado; variáveis entram escapadas; **negrito**
  const fill = (text: string) => escapeHtml(text)
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key) => (key in values ? escapeHtml(values[key]) : match))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  let paragraphs = 0;
  const blocks = template.body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^\{\{\s*ativos\s*\}\}$/.test(block)) return assetsTable(data.items);
      if (block.startsWith('## ')) return `<h2>${fill(block.slice(3))}</h2>`;
      const centered = block.startsWith('[centro]');
      const html = fill(centered ? block.slice(8).trim() : block).replace(/\n/g, '<br>');
      if (!html.replace(/<[^>]+>/g, '').trim()) return ''; // ex.: {{observacoes}} vazio
      if (centered) return `<p class="center">${html}</p>`;
      paragraphs += 1;
      // Como no termo em papel: 1º parágrafo sem recuo, os seguintes com recuo
      return `<p${paragraphs > 1 ? ' class="indent"' : ''}>${html}</p>`;
    })
    .join('\n');

  const signatures = template.signatures
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<div class="sig"><div class="line"></div>${fill(s)}</div>`)
    .join('');
  const footer = (template.footer || '').trim();

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(template.title)}</title><style>
    @page { size: A4; margin: 2cm 2.5cm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; max-width: 720px; margin: 32px auto; line-height: 1.55; font-size: 14px; }
    .page { min-height: 100%; display: flex; flex-direction: column; }
    .logo { margin-bottom: 56px; } .logo img { height: 46px; }
    h1 { font-size: 15px; font-weight: bold; text-align: center; margin: 0 0 40px; }
    h2 { font-size: 14px; margin: 20px 0 8px; }
    p { margin: 0 0 14px; text-align: justify; }
    p.indent { text-indent: 2.5em; }
    p.center { text-align: center; margin-top: 28px; }
    table.assets { width: 100%; border-collapse: collapse; margin: 4px 0 18px; }
    table.assets th, table.assets td { border: 1px solid #9ca3af; padding: 5px 10px; text-align: left; font-size: 13px; }
    table.assets th { background: #f3f4f6; } td.pat { font-family: monospace; white-space: nowrap; width: 110px; }
    .sigs { margin: 64px auto 0; width: 75%; }
    .sig { text-align: center; font-size: 13px; margin-bottom: 64px; }
    .sig:last-child { margin-bottom: 0; }
    .sig .line { border-top: 1px solid #111827; margin-bottom: 4px; }
    .footer { margin-top: 64px; border-top: 1px solid #6b7280; padding-top: 6px; text-align: center; font-style: italic; font-size: 12px; color: #374151; }
    @media print {
      body { margin: 0 auto; padding-bottom: 40px; }
      .footer { position: fixed; bottom: 0; left: 0; right: 0; margin: 0; background: #fff; }
    }
  </style></head><body>
    ${template.show_logo ? `<div class="logo"><img src="${origin}/logo-geniantis.svg" alt="${escapeHtml(ORGANIZATION_NAME)}"></div>` : ''}
    <h1>${fill(template.title)}</h1>
    ${blocks}
    ${signatures ? `<div class="sigs">${signatures}</div>` : ''}
    ${footer ? `<div class="footer">${fill(footer)}</div>` : ''}
  </body></html>`;
}
