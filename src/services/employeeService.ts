import { Employee } from '../types/employee';

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
    department: 'Tecnologia da Informação',
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
    department: 'Recursos Humanos',
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
    department: 'Financeiro / Administrativo',
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
    department: 'Operações',
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

export const EmployeeService = {
  // Obter todos os funcionários
  getEmployees(): Employee[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao ler funcionários do localStorage:', e);
    }
    // Inicializa se vazio
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EMPLOYEES));
    this.syncWithParabensFlow(INITIAL_EMPLOYEES);
    return INITIAL_EMPLOYEES;
  },

  // Salvar ou atualizar funcionário
  saveEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Employee {
    const list = this.getEmployees();
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

  // Sincronizar funcionários ativos diretamente no ParabénsFlow
  syncWithParabensFlow(employees: Employee[]) {
    try {
      // 1. Grava no geniantis_employees para acesso direto
      localStorage.setItem('geniantis_employees', JSON.stringify(employees));

      // 2. Se houver estado do ParabénsFlow, sincroniza contatos sem duplicar e preservando dados
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
