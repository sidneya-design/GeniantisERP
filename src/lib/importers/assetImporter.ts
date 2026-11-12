import { EMAIL_RE, ImportColumn, matchOption, parseDate, parseMoney } from '../csv';
import { AssetService } from '../../services/assetService';
import { Asset, AssetCondition, AssetStatus } from '../../types/asset';
import { Employee } from '../../types/employee';
import { Importer, ImportError, PreparedRow } from './types';

const CATEGORY_LABELS = ['Notebook', 'Desktop', 'Monitor', 'Celular / Tablet', 'Equipamento de rede', 'Periférico'];

const BASE_COLUMNS: ImportColumn[] = [
  { key: 'patrimony', header: 'Patrimônio', required: true, hint: 'Chave do cadastro: se já existir, a linha atualiza', example: 'GEN-0001' },
  { key: 'category', header: 'Categoria', required: true, options: CATEGORY_LABELS, example: 'Notebook' },
  { key: 'unit', header: 'Unidade', required: true, example: 'Matriz - São Paulo' },
  { key: 'serial_number', header: 'Número de série', example: '5CD1234XYZ' },
  { key: 'brand', header: 'Marca', example: 'Dell' },
  { key: 'model', header: 'Modelo', example: 'Latitude 5440' },
  { key: 'condition', header: 'Condição', options: ['Excelente', 'Bom', 'Regular', 'Ruim'], hint: 'Vazio = Bom', example: 'Bom' },
  { key: 'status', header: 'Situação', options: ['Disponível', 'Em uso', 'Em manutenção', 'Baixado'], hint: 'Vazio = Disponível (ou Em uso, com responsável)', example: 'Em uso' },
  { key: 'responsible_email', header: 'E-mail do responsável', hint: 'E-mail de um funcionário cadastrado', example: 'maria.souza@geniantis.com' },
  { key: 'acquisition_date', header: 'Data de aquisição', kind: 'date', hint: 'DD/MM/AAAA', example: '10/01/2025' },
  { key: 'purchase_cost', header: 'Custo de aquisição', kind: 'money', hint: 'Ex.: 4.599,90 (entra no Financeiro no mês da aquisição)', example: '4.599,90' },
  { key: 'warranty_until', header: 'Garantia até', kind: 'date', hint: 'DD/MM/AAAA', example: '10/01/2028' },
  { key: 'notes', header: 'Observações', example: '' },
];

const CATEGORY_OPTIONS: { value: string; labels: string[] }[] = [
  { value: 'notebook', labels: ['Notebook', 'Laptop'] },
  { value: 'desktop', labels: ['Desktop', 'Computador', 'CPU'] },
  { value: 'monitor', labels: ['Monitor'] },
  { value: 'celular', labels: ['Celular', 'Tablet', 'Celular / Tablet', 'Smartphone'] },
  { value: 'rede', labels: ['Rede', 'Equipamento de rede'] },
  { value: 'perifericos', labels: ['Periférico', 'Periféricos', 'Perifericos'] },
];

const CONDITION_OPTIONS: { value: AssetCondition; labels: string[] }[] = [
  { value: 'excelente', labels: ['Excelente', 'Novo'] },
  { value: 'bom', labels: ['Bom'] },
  { value: 'regular', labels: ['Regular'] },
  { value: 'ruim', labels: ['Ruim'] },
];

const STATUS_OPTIONS: { value: AssetStatus; labels: string[] }[] = [
  { value: 'disponivel', labels: ['Disponível', 'Em estoque', 'Estoque'] },
  { value: 'em_uso', labels: ['Em uso', 'Em_uso', 'Uso'] },
  { value: 'em_manutencao', labels: ['Em manutenção', 'Manutenção'] },
  { value: 'baixado', labels: ['Baixado', 'Baixa'] },
];

/**
 * Importação de ativos. O patrimônio identifica o ativo: patrimônio novo cria,
 * existente atualiza só as colunas preenchidas. Com responsável e sem situação, vira "Em uso".
 */
export function createAssetImporter(existing: Asset[], employees: Employee[]): Importer {
  // Responsável: lista com os e-mails dos funcionários não desligados
  const responsibleEmails = employees
    .filter((e) => e.status !== 'desligado' && e.email)
    .map((e) => e.email.trim().toLowerCase())
    .sort();
  const columns = BASE_COLUMNS.map((c) => (c.key === 'responsible_email' ? { ...c, options: responsibleEmails } : c));

  return {
    entityPlural: 'ativos',
    templateFileName: 'modelo_importacao_ativos.xlsx',
    columns,
    notes: [
      'O patrimônio identifica o ativo: patrimônio que já existe atualiza o cadastro, patrimônio novo cria.',
      'Na atualização, célula vazia mantém o valor atual (não apaga).',
      'Com e-mail do responsável e Situação vazia, o ativo entra como "Em uso". A importação não gera termo de entrega.',
      'Categoria, Condição, Situação e Responsável têm lista de seleção no modelo: escolha em vez de digitar.',
      'Datas no formato DD/MM/AAAA. Envie a própria planilha .xlsx (não precisa converter).',
    ],
    prepare(rows) {
      const norm = (v: string) => v.trim().toUpperCase();
      const byPatrimony = new Map(existing.map((a) => [norm(a.patrimony), a]));
      const employeeByEmail = new Map(employees.map((e) => [e.email.trim().toLowerCase(), e]));
      const prepared: PreparedRow[] = [];
      const errors: ImportError[] = [];
      const seenPatrimony = new Set<string>();
      const seenSerial = new Map<string, string>();

      for (const { line, values } of rows) {
        const fail = (message: string) => errors.push({ line, message });
        const patrimony = (values.patrimony || '').trim();
        if (!patrimony) { fail('Patrimônio não preenchido.'); continue; }
        const key = norm(patrimony);
        if (seenPatrimony.has(key)) { fail(`Patrimônio ${patrimony} aparece mais de uma vez no arquivo.`); continue; }
        seenPatrimony.add(key);

        const current = byPatrimony.get(key);
        const lineErrors: string[] = [];
        const text = (k: 'serial_number' | 'brand' | 'model' | 'notes' | 'unit') =>
          values[k] || (current ? String(current[k] ?? '') : '');

        let category = current?.category || '';
        if (values.category) {
          const match = matchOption(values.category, CATEGORY_OPTIONS);
          if (!match) lineErrors.push(`Categoria inválida: "${values.category}".`);
          else category = match;
        }
        if (!category && !values.category) lineErrors.push('Categoria não preenchida.');

        const unit = text('unit');
        if (!unit) lineErrors.push('Unidade não preenchida.');

        let condition: AssetCondition = current?.condition || 'bom';
        if (values.condition) {
          const match = matchOption(values.condition, CONDITION_OPTIONS);
          if (!match) lineErrors.push(`Condição inválida: "${values.condition}" (use Excelente, Bom, Regular ou Ruim).`);
          else condition = match;
        }

        let assignedId: string | null = current?.assigned_employee_id || null;
        if (values.responsible_email) {
          const email = values.responsible_email.toLowerCase();
          const employee = EMAIL_RE.test(email) ? employeeByEmail.get(email) : undefined;
          if (!employee) lineErrors.push(`Responsável não encontrado em Funcionários: "${values.responsible_email}".`);
          else if (employee.status === 'desligado') lineErrors.push(`Responsável ${employee.full_name} está desligado.`);
          else assignedId = employee.id;
        }

        let status: AssetStatus = current?.status || (assignedId ? 'em_uso' : 'disponivel');
        if (values.status) {
          const match = matchOption(values.status, STATUS_OPTIONS);
          if (!match) lineErrors.push(`Situação inválida: "${values.status}".`);
          else status = match;
        } else if (values.responsible_email && assignedId) {
          status = 'em_uso';
        }
        if (status === 'em_uso' && !assignedId && !values.responsible_email) lineErrors.push('Situação "Em uso" precisa do e-mail do responsável.');
        if (status === 'disponivel' && values.responsible_email && assignedId) {
          lineErrors.push('Ativo "Disponível" não pode ter responsável. Deixe a Situação vazia ou use "Em uso".');
        }
        if (status === 'disponivel' || status === 'baixado') assignedId = null;

        const dateField = (k: 'acquisition_date' | 'warranty_until', label: string) => {
          const raw = values[k] || '';
          if (!raw) return current ? current[k] ?? null : null;
          const parsed = parseDate(raw);
          if (parsed === undefined) lineErrors.push(`${label} inválida: "${raw}" (use DD/MM/AAAA).`);
          return parsed ?? null;
        };
        const acquisition_date = dateField('acquisition_date', 'Data de aquisição');
        const warranty_until = dateField('warranty_until', 'Garantia');

        let purchase_cost = current?.purchase_cost ?? null;
        if (values.purchase_cost) {
          const parsed = parseMoney(values.purchase_cost);
          if (parsed === undefined) lineErrors.push(`Custo inválido: "${values.purchase_cost}".`);
          else purchase_cost = parsed;
        }

        const serial_number = text('serial_number');
        if (serial_number) {
          const s = norm(serial_number);
          const owner = existing.find((a) => a.serial_number && norm(a.serial_number) === s && norm(a.patrimony) !== key);
          const inFile = seenSerial.get(s);
          if (owner) lineErrors.push(`Número de série ${serial_number} já pertence ao patrimônio ${owner.patrimony}.`);
          else if (inFile && inFile !== key) lineErrors.push(`Número de série ${serial_number} repetido no arquivo.`);
          seenSerial.set(s, key);
        }

        if (lineErrors.length) { lineErrors.forEach(fail); continue; }

        const asset = {
          id: current?.id,
          patrimony: current?.patrimony || patrimony,
          category,
          unit,
          condition,
          status,
          assigned_employee_id: assignedId,
          serial_number: serial_number || undefined,
          brand: text('brand') || undefined,
          model: text('model') || undefined,
          acquisition_date,
          warranty_until,
          purchase_cost,
          notes: text('notes') || null,
        };

        prepared.push({
          line,
          label: asset.patrimony,
          detail: [asset.brand, asset.model].filter(Boolean).join(' ') || category,
          action: current ? 'atualizar' : 'novo',
          save: async () => {
            await AssetService.saveAsset(asset);
          },
        });
      }

      return { rows: prepared, errors };
    },
  };
}
