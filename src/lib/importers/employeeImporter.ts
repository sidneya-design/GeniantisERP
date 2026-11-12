import { EMAIL_RE, ImportColumn, matchOption, parseDate } from '../csv';
import { formatCpf, isValidCpf } from '../cpf';
import { EmployeeService } from '../../services/employeeService';
import { Employee, EmployeeStatus } from '../../types/employee';
import { Importer, ImportError, PreparedRow } from './types';

// Mesmas opções das listas do formulário de cadastro (Employees.tsx)
export const DEPARTMENTS = ['TI', 'RH', 'Financeiro', 'Pedagogia', 'GUESTA'];
export const UNITS = ['Matriz - São Paulo', 'Filial 1'];

const PRIVATE_KEYS = new Set(['cpf', 'address', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone']);

// Mesmos campos, ordem e nomes do formulário "Novo Funcionário"
const ALL_COLUMNS: ImportColumn[] = [
  { key: 'full_name', header: 'Nome Completo', required: true, example: 'Carlos Eduardo Silva' },
  { key: 'preferential_name', header: 'Nome de Preferência', example: 'Eduardo' },
  { key: 'email', header: 'E-mail', required: true, hint: 'Se já existir, a linha atualiza o cadastro', example: 'nome@geniantis.com' },
  { key: 'phone', header: 'Contato', example: '(11) 90000-0000' },
  { key: 'cpf', header: 'CPF', example: '000.000.000-00' },
  { key: 'address', header: 'Endereço', example: 'Rua, número, complemento, bairro e cidade' },
  { key: 'emergency_contact_name', header: 'Nome do contato emergencial', example: 'Maria da Silva' },
  { key: 'emergency_contact_relationship', header: 'Relação', example: 'Mãe' },
  { key: 'emergency_contact_phone', header: 'Telefone para contato emergencial', example: '(11) 90000-0000' },
  { key: 'department', header: 'Departamento', required: true, options: DEPARTMENTS, example: 'TI' },
  { key: 'role_title', header: 'Cargo', example: 'Analista de Sistemas' },
  { key: 'unit', header: 'Unidade', required: true, options: UNITS, example: 'Matriz - São Paulo' },
  { key: 'birth_date', header: 'Data de Nascimento', kind: 'date', hint: 'DD/MM/AAAA (usada nos e-mails de aniversário)', example: '15/08/1990' },
  { key: 'admission_date', header: 'Data de Admissão', required: true, kind: 'date', hint: 'DD/MM/AAAA', example: '01/03/2024' },
  { key: 'manager', header: 'Gestor Responsável', example: 'Nome do gestor' },
  { key: 'status', header: 'Situação', options: ['Ativo', 'Afastado', 'Desligado'], hint: 'Vazio = Ativo', example: 'Ativo' },
  { key: 'termination_date', header: 'Data de Desligamento', kind: 'date', hint: 'DD/MM/AAAA, obrigatória se Desligado', example: '' },
];

const STATUS_OPTIONS: { value: EmployeeStatus; labels: string[] }[] = [
  { value: 'ativo', labels: ['Ativo', 'Ativa'] },
  { value: 'afastado', labels: ['Afastado', 'Afastada'] },
  { value: 'desligado', labels: ['Desligado', 'Desligada'] },
];

const toOptions = (list: string[]) => list.map((v) => ({ value: v, labels: [v] }));

/**
 * Importação de funcionários. O e-mail identifica o cadastro: e-mail novo cria
 * (situação Ativo), e-mail existente atualiza só as colunas preenchidas.
 * Perfis sem acesso a dados pessoais (TI) não veem nem enviam CPF, endereço e contato emergencial.
 */
export function createEmployeeImporter(existing: Employee[], includePrivate: boolean): Importer {
  const columns = includePrivate ? ALL_COLUMNS : ALL_COLUMNS.filter((c) => !PRIVATE_KEYS.has(c.key));

  return {
    entityPlural: 'funcionários',
    templateFileName: 'modelo_importacao_funcionarios.xlsx',
    columns,
    notes: [
      'As colunas são as mesmas do formulário de cadastro.',
      'O e-mail identifica o funcionário: e-mail que já existe atualiza o cadastro, e-mail novo cria.',
      'Na atualização, célula vazia mantém o valor atual (não apaga).',
      'Departamento, Unidade e Situação têm lista de seleção no modelo: escolha em vez de digitar.',
      'Datas no formato DD/MM/AAAA. Envie a própria planilha .xlsx (não precisa converter).',
    ],
    prepare(rows) {
      const byEmail = new Map(existing.map((e) => [e.email.trim().toLowerCase(), e]));
      const prepared: PreparedRow[] = [];
      const errors: ImportError[] = [];
      const seenEmails = new Set<string>();
      const seenCpfs = new Set<string>();

      for (const { line, values } of rows) {
        const fail = (message: string) => errors.push({ line, message });
        const email = (values.email || '').toLowerCase();

        if (!email) { fail('E-mail não preenchido.'); continue; }
        if (!EMAIL_RE.test(email)) { fail(`E-mail inválido: "${values.email}".`); continue; }
        if (seenEmails.has(email)) { fail(`E-mail ${email} aparece mais de uma vez no arquivo.`); continue; }
        seenEmails.add(email);

        const current = byEmail.get(email);
        const pick = (key: keyof Employee) => values[key as string] || (current ? String(current[key] ?? '') : '');
        const lineErrors: string[] = [];

        const dateField = (key: 'admission_date' | 'birth_date' | 'termination_date', label: string) => {
          const raw = values[key] || '';
          if (!raw) return current ? (current[key] as string | undefined) ?? null : null;
          const parsed = parseDate(raw);
          if (parsed === undefined) lineErrors.push(`${label} inválida: "${raw}" (use DD/MM/AAAA).`);
          return parsed ?? null;
        };

        const listField = (key: 'department' | 'unit', label: string, list: string[]) => {
          const raw = values[key] || '';
          if (!raw) {
            if (!current?.[key]) lineErrors.push(`${label} não preenchido.`);
            return current?.[key] || '';
          }
          const match = matchOption(raw, toOptions(list));
          if (!match) lineErrors.push(`${label} não reconhecido: "${raw}" (use ${list.join(', ')}).`);
          return match || '';
        };

        const full_name = pick('full_name');
        if (!full_name) lineErrors.push('Nome Completo não preenchido.');
        const department = listField('department', 'Departamento', DEPARTMENTS);
        const unit = listField('unit', 'Unidade', UNITS);
        const birth_date = dateField('birth_date', 'Data de Nascimento');
        const admission_date = dateField('admission_date', 'Data de Admissão');
        if (!admission_date && !values.admission_date) lineErrors.push('Data de Admissão não preenchida.');

        let status: EmployeeStatus = current?.status || 'ativo';
        if (values.status) {
          const match = matchOption(values.status, STATUS_OPTIONS);
          if (!match) lineErrors.push(`Situação não reconhecida: "${values.status}" (use Ativo, Afastado ou Desligado).`);
          else status = match;
        }
        let termination_date = dateField('termination_date', 'Data de Desligamento');
        if (status === 'desligado' && !termination_date && !values.termination_date) {
          lineErrors.push('Data de Desligamento é obrigatória para Desligado.');
        }
        if (status !== 'desligado') termination_date = null;

        let cpf = includePrivate ? pick('cpf') : '';
        if (includePrivate && values.cpf) {
          if (!isValidCpf(values.cpf)) lineErrors.push(`CPF inválido: "${values.cpf}".`);
          else {
            cpf = formatCpf(values.cpf);
            const digits = cpf.replace(/\D/g, '');
            const owner = existing.find((e) => e.cpf && e.cpf.replace(/\D/g, '') === digits && e.email.toLowerCase() !== email);
            if (owner) lineErrors.push(`CPF já cadastrado para ${owner.full_name}.`);
            else if (seenCpfs.has(digits)) lineErrors.push('CPF repetido no arquivo.');
            seenCpfs.add(digits);
          }
        }

        if (lineErrors.length) { lineErrors.forEach(fail); continue; }

        // Campos fora do formulário (matrícula, foto, observações) ficam como estão
        const employee = {
          ...(current || {}),
          id: current?.id,
          status,
          termination_date,
          full_name,
          email,
          department,
          unit,
          role_title: pick('role_title'),
          admission_date: admission_date as string,
          birth_date: birth_date || undefined,
          preferential_name: pick('preferential_name') || undefined,
          phone: pick('phone') || undefined,
          manager: pick('manager') || undefined,
          cpf: cpf || undefined,
          address: includePrivate ? pick('address') || undefined : undefined,
          emergency_contact_name: includePrivate ? pick('emergency_contact_name') || undefined : undefined,
          emergency_contact_relationship: includePrivate ? pick('emergency_contact_relationship') || undefined : undefined,
          emergency_contact_phone: includePrivate ? pick('emergency_contact_phone') || undefined : undefined,
        } as Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { id?: string };

        prepared.push({
          line,
          label: full_name,
          detail: `${email} · ${department}`,
          action: current ? 'atualizar' : 'novo',
          save: async () => {
            await EmployeeService.saveEmployee(employee, { includePrivate });
          },
        });
      }

      return { rows: prepared, errors };
    },
  };
}
