import { Employee } from '../types/employee';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { resizeToSquare } from '../lib/image';

const STORAGE_KEY = 'geniantis_employees';
const PARABENSFLOW_KEY = 'parabensflow_local_preview_state';

// Dados iniciais de colaboradores da Geniantis
const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    registration_number: 'GEN-001',
    full_name: 'Sidney Alberto Amorim',
    preferential_name: 'Sidney',
    email: 'sidney.a@geniantis.com',
    phone: '(11) 98765-4321',
    department: 'TI',
    role_title: 'Coordenador de TI & Infraestrutura',
    unit: 'Matriz - São Paulo',
    manager: 'Diretoria Executiva',
    admission_date: '2021-03-15',
    birth_date: '1989-08-29',
    status: 'ativo',
    created_at: '2021-03-15T10:00:00Z',
    updated_at: '2026-02-11T10:00:00Z',
  },
  {
    id: 'emp-2',
    registration_number: 'GEN-002',
    full_name: 'Juliana Blum Ferreira',
    preferential_name: 'Juliana',
    email: 'juliana.f@geniantis.com',
    phone: '(11) 97654-3210',
    department: 'RH',
    role_title: 'Analista de RH Sênior',
    unit: 'Matriz - São Paulo',
    manager: 'Gerência de Recursos Humanos',
    admission_date: '2022-07-01',
    birth_date: '1991-03-02',
    status: 'ativo',
    created_at: '2022-07-01T10:00:00Z',
    updated_at: '2026-02-11T10:00:00Z',
  },
  {
    id: 'emp-3',
    registration_number: 'GEN-003',
    full_name: 'Carlos Eduardo Santos',
    preferential_name: 'Eduardo',
    email: 'carlos.s@geniantis.com',
    phone: '(11) 96543-2109',
    department: 'Financeiro',
    role_title: 'Especialista Financeiro',
    unit: 'Matriz - São Paulo',
    manager: 'Controladoria',
    admission_date: '2023-01-10',
    birth_date: '1992-02-04',
    status: 'ativo',
    created_at: '2023-01-10T10:00:00Z',
    updated_at: '2026-02-11T10:00:00Z',
  },
  {
    id: 'emp-4',
    registration_number: 'GEN-004',
    full_name: 'Mariana Lima de Souza',
    preferential_name: 'Mariana',
    email: 'mariana.l@geniantis.com',
    phone: '(11) 95432-1098',
    department: 'Pedagogia',
    role_title: 'Supervisora de Operações',
    unit: 'Filial 1',
    manager: 'Diretoria de Operações',
    admission_date: '2020-11-20',
    birth_date: '1995-08-01',
    status: 'afastado',
    created_at: '2020-11-20T10:00:00Z',
    updated_at: '2026-02-11T10:00:00Z',
  },
];

// Colunas da tabela employees. Os dados pessoais (CPF, endereço, contato de
// emergência, observações restritas) ficam em employee_private.
const PUBLIC_COLUMNS =
  'id, registration_number, full_name, preferential_name, email, phone, department_id, department_name, role_title, ' +
  'unit_id, unit_name, manager, admission_date, termination_date, birth_date, status, photo_url, created_at, updated_at';

type PrivateData = {
  employee_id: string;
  cpf: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  restricted_notes: string | null;
};

const PRIVATE_FIELDS = [
  'cpf', 'address', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone', 'restricted_notes',
] as const;

// Dados pessoais (tabela employee_private): o RLS só devolve linhas para
// Admin, ADM e RH; para os outros perfis o mapa fica vazio.
async function loadPrivateData(): Promise<Map<string, PrivateData>> {
  const { data, error } = await supabase.from('employee_private').select('*');
  if (error) return new Map();
  return new Map(((data || []) as PrivateData[]).map((p) => [p.employee_id, p]));
}

function splitPrivate(payload: Record<string, any>) {
  const publicPart: Record<string, any> = { ...payload };
  const privatePart: Record<string, any> = {};
  for (const f of PRIVATE_FIELDS) {
    privatePart[f] = publicPart[f] ?? null;
    delete publicPart[f];
  }
  return { publicPart, privatePart };
}

export const EmployeeService = {
  mapRow(row: any): Employee {
    return {
      id: row.id,
      registration_number: row.registration_number || undefined,
      full_name: row.full_name,
      preferential_name: row.preferential_name || undefined,
      email: row.email,
      cpf: row.cpf || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      emergency_contact_name: row.emergency_contact_name || undefined,
      emergency_contact_relationship: row.emergency_contact_relationship || undefined,
      emergency_contact_phone: row.emergency_contact_phone || undefined,
      department: row.department_name || '',
      role_title: row.role_title || '',
      unit: row.unit_name || '',
      manager: row.manager || undefined,
      admission_date: row.admission_date,
      termination_date: row.termination_date || null,
      birth_date: row.birth_date || undefined,
      status: row.status,
      photo_url: row.photo_url || undefined,
      restricted_notes: row.restricted_notes || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },

  toRow(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
    return {
      ...(employee.id ? { id: employee.id } : {}),
      registration_number: employee.registration_number || null,
      full_name: employee.full_name,
      preferential_name: employee.preferential_name || null,
      email: employee.email,
      cpf: employee.cpf || null,
      phone: employee.phone || null,
      address: employee.address || null,
      emergency_contact_name: employee.emergency_contact_name || null,
      emergency_contact_relationship: employee.emergency_contact_relationship || null,
      emergency_contact_phone: employee.emergency_contact_phone || null,
      department_name: employee.department,
      role_title: employee.role_title,
      unit_name: employee.unit,
      manager: employee.manager || null,
      admission_date: employee.admission_date,
      termination_date: employee.termination_date || null,
      birth_date: employee.birth_date || null,
      status: employee.status,
      photo_url: employee.photo_url || null,
      restricted_notes: employee.restricted_notes || null,
    };
  },

  // Obter todos os funcionários
  async getEmployees(): Promise<Employee[]> {
    if (isSupabaseConfigured) {
      const [{ data, error }, privateData] = await Promise.all([
        supabase.from('employees').select(PUBLIC_COLUMNS).order('full_name', { ascending: true }),
        loadPrivateData(),
      ]);

      if (error) throw error;
      return (data || []).map((row: any) => {
        const { employee_id: _ignored, ...priv } = (privateData.get(row.id) || {}) as any;
        return this.mapRow({ ...row, ...priv });
      });
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as Employee[];
      }
    } catch (e) {
      console.warn('Erro ao ler funcionários do localStorage:', e);
    }
    // Inicializa se vazio
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EMPLOYEES));
    this.syncWithParabensFlow(INITIAL_EMPLOYEES);
    return [...INITIAL_EMPLOYEES];
  },

  // Salvar ou atualizar funcionário
  /** Envia a foto do funcionário (avatars/funcionarios/<id>/...) e grava em photo_url */
  async uploadPhoto(employeeId: string, file: File): Promise<string> {
    const blob = await resizeToSquare(file);
    const path = `funcionarios/${employeeId}/${Date.now()}.webp`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
    if (error) {
      if (/bucket/i.test(error.message)) {
        throw new Error('O armazenamento de fotos ainda não existe. Rode a migration 20261112000004_user_avatars.sql.');
      }
      throw new Error(`Falha ao enviar a foto: ${error.message}`);
    }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error: upErr } = await supabase.from('employees').update({ photo_url: url }).eq('id', employeeId);
    if (upErr) throw new Error(upErr.message);
    return url;
  },

  async saveEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Employee> {
    if (isSupabaseConfigured) {
      const { publicPart, privatePart } = splitPrivate(this.toRow(employee));
      const query = employee.id
        ? supabase.from('employees').update(publicPart).eq('id', employee.id)
        : supabase.from('employees').insert(publicPart);
      const { data, error } = await query.select(PUBLIC_COLUMNS).single();
      if (error) throw error;

      // Dados pessoais na tabela própria (só Admin, ADM e RH conseguem gravar)
      const saved = data as any;
      const { error: privErr } = await supabase
        .from('employee_private')
        .upsert({ employee_id: saved.id, ...privatePart }, { onConflict: 'employee_id' });
      if (privErr) {
        if (privErr.code === '23505') throw new Error('Já existe outro funcionário com esse CPF.');
        throw new Error(`Funcionário salvo, mas os dados pessoais não: ${privErr.message}`);
      }
      return this.mapRow({ ...saved, ...privatePart });
    }

    const list = await this.getEmployees();
    const now = new Date().toISOString();

    if (employee.id) {
      const idx = list.findIndex(e => e.id === employee.id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          ...employee,
          updated_at: now,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        this.syncWithParabensFlow(list);
        return list[idx];
      }
    }

    const newEmp: Employee = {
      ...employee,
      id: employee.id || `emp-${Date.now()}`,
      created_at: now,
      updated_at: now,
    };
    list.push(newEmp);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    this.syncWithParabensFlow(list);
    return newEmp;
  },

  // Alterar situação (Ativar / Afastar / Desativar-Desligar)
  async updateStatus(id: string, newStatus: Employee['status']): Promise<Employee | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('employees')
        .update({
          status: newStatus,
          termination_date: newStatus === 'desligado' ? new Date().toISOString().slice(0, 10) : null,
        })
        .eq('id', id)
        .select(PUBLIC_COLUMNS)
        .maybeSingle();

      if (error) throw error;
      return data ? this.mapRow(data) : null;
    }

    const list = await this.getEmployees();
    const idx = list.findIndex(e => e.id === id);
    if (idx < 0) return null;

    const now = new Date().toISOString();
    list[idx] = {
      ...list[idx],
      status: newStatus,
      termination_date: newStatus === 'desligado' ? now.split('T')[0] : null,
      updated_at: now,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    this.syncWithParabensFlow(list);
    return list[idx];
  },

  // Sincronizar funcionários ativos diretamente no ParabénsFlow
  syncWithParabensFlow(employees: Employee[]) {
    try {
      // 1. Grava no geniantis_employees para acesso direto
      localStorage.setItem('geniantis_employees', JSON.stringify(employees));

      // 2. Se houver estado do ParabénsFlow, sincroniza contatos sem duplicar e removendo desligados
      const pfRaw = localStorage.getItem(PARABENSFLOW_KEY);
      let pfState = pfRaw ? JSON.parse(pfRaw) : null;

      if (!pfState) {
        pfState = {
          usuarios: [
            { email: 'admin@geniantis.com', password: 'demo', role: 'admin' },
            { email: 'ti@geniantis.com', password: 'demo', role: 'admin' },
          ],
          contatos: [],
          nextContactId: 100,
        };
      }

      // Remove da lista de aniversariantes qualquer funcionário que foi desligado/desativado
      const terminatedEmails = new Set(
        employees
          .filter(e => e.status === 'desligado')
          .map(e => e.email.toLowerCase())
      );

      pfState.contatos = (pfState.contatos || []).filter(
        (c: any) => !c.email || !terminatedEmails.has(c.email.toLowerCase())
      );

      const activeEmployees = employees.filter(e => e.status !== 'desligado');

      activeEmployees.forEach(emp => {
        if (!emp.birth_date) return;
        const existingIdx = pfState.contatos.findIndex(
          (c: any) => c.email && c.email.toLowerCase() === emp.email.toLowerCase()
        );

        if (existingIdx >= 0) {
          pfState.contatos[existingIdx].nome = emp.full_name;
          pfState.contatos[existingIdx].data_nascimento = emp.birth_date;
          pfState.contatos[existingIdx].departamento = emp.department;
        } else {
          pfState.contatos.push({
            id: String(pfState.nextContactId++),
            nome: emp.full_name,
            email: emp.email,
            data_nascimento: emp.birth_date,
            departamento: emp.department,
          });
        }
      });

      localStorage.setItem(PARABENSFLOW_KEY, JSON.stringify(pfState));
    } catch (err) {
      console.warn('Erro ao sincronizar com ParabénsFlow:', err);
    }
  },
};

