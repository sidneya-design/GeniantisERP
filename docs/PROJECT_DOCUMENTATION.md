# GeniantisERP – Documentação Central e Guia de Continuidade

> **Atenção para Antigravity, Codex e Claude Code**: Este é o documento central oficial do projeto. Toda decisão técnica, status de migrações, funcionalidades concluídas e pendências devem ser consultados e atualizados aqui antes e após cada intervenção.

---

## 1. Escopo Aprovado
O **GeniantisERP** é um sistema web modular interno para gestão integrada de:
1. **Visão Geral (Dashboard)** – Métricas em tempo real, pendências e alertas.
2. **Funcionários** – Cadastro completo (departamentos, cargos, unidades, gestor, situação, ficha com ativos e licenças).
3. **Ativos de TI** – Inventário de equipamentos (notebooks, desktops, monitores, etc.), etiquetas com QR code, controle de garantia e localização.
4. **Entregas e Devoluções** – Movimentações individuais/em lote, histórico detalhado, controle rigoroso contra duplicidades de entrega.
5. **Termos e Desligamento** – Emissão de termos em PDF, checklist de desligamento com pendências de devolução e remoção de acessos.
6. **Manutenções** – Abertura e histórico de reparos operacionais de equipamentos.
7. **Assinaturas, Licenças e Financeiro de Aplicativos** – Gestão de contratos (Microsoft 365, Google Workspace, Canva, OpenAI, Gemini, etc.), atribuição nominal de licenças, fluxo financeiro de cobranças, vencimentos, rateios e pagamentos parciais/totais.
8. **Domínios e Renovações** – Gestão administrativa de domínios, DNS, vínculos de hosting e registro de renovações confirmadas.
9. **Aniversariantes (ParabénsFlow)** – Integração como módulo do aplicativo existente em Netlify Functions/Blobs, preservando interface, funcionalidades e sem perda de dados.
10. **Relatórios & Configurações** – Exportação CSV, auditoria e customização da identidade visual.

---

## 2. Arquitetura e Tecnologias
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Lucide Icons.
- **Backend & Database**: Supabase PostgreSQL com Row Level Security (RLS) habilitado em todas as tabelas.
- **Autenticação**: Supabase Auth com RBAC via tabela `profiles` com 5 perfis: `admin`, `ti`, `rh`, `financeiro`, `consulta`.
- **Hospedagem & CI/CD**: Netlify com build automático acoplado ao Git, suporte a rotas SPA (`netlify.toml`).
- **Armazenamento de Arquivos**: Supabase Storage em buckets privados (termos, notas fiscais, fotos de ativos e termos assinados).

---

## 3. Matriz de Perfis e Permissões (RBAC)

| Módulo / Recurso | Admin | TI | RH | Financeiro | Consulta |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Funcionários** | Total | Consulta/Atrib | Total | Consulta | Somente Leitura |
| **Ativos de TI** | Total | Total | Consulta | Consulta | Somente Leitura |
| **Entregas / Devoluções**| Total | Total | Visualizar | - | Somente Leitura |
| **Termos & Desligamento**| Total | Total | Checklist | - | Somente Leitura |
| **Manutenções** | Total | Total | - | - | Somente Leitura |
| **Assinaturas & Licenças**| Total | Operacional | Consulta | Financeiro/Pag | Somente Leitura |
| **Domínios & Renovações**| Total | Total | - | Consulta | Somente Leitura |
| **Aniversariantes** | Admin | Acesso | Acesso | Acesso | Acesso |
| **Configurações/Usuários**| Total | - | - | - | - |

---

## 4. Como Executar e Testar Localmente

### Pré-requisitos
- Node.js v18+ (ambiente atual: v24.16.0)
- npm v9+

### Passos
```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# 3. Rodar em ambiente de desenvolvimento
npm run dev

# 4. Validar build e tipagem TypeScript
npm run build
```

---

## 5. Modelagem e Migrações de Banco (Supabase)
As migrações SQL ficam em `supabase/migrations/` e devem ser aplicadas em ordem cronológica:
- `20260211000000_initial_schema.sql`: Perfis de usuário (`profiles`), triggers de criação automática de usuário auth, RLS de segurança e controle de roles.
- *(Migrações dos próximos módulos adicionadas sequencialmente).*

---

## 6. Status das Etapas de Implementação

- [x] **Etapa 1: Análise e Repositório**: Estrutura Git criada (`main` protegida, `develop` ativa), dependências estáveis instaladas e documentação compartilhada criada. Aplicativo de aniversariantes analisado e preservado.
- [x] **Etapa 2: Base, Autenticação e Perfis (RBAC)**: Migração inicial SQL (`profiles`, `units`, `departments`, `audit_logs`, triggers e RLS), cliente Supabase resiliente, autenticação e matriz de papéis (Admin, TI, RH, Financeiro, Consulta), layout com Sidebar recolhível e Header com avisos e teste de perfis.
- [ ] **Etapa 3: Módulo de Funcionários**: Modelagem de funcionários no PostgreSQL, ficha completa (ativos, licenças, pendências), importação CSV e regras de negócio.
- [ ] **Etapa 4: Inventário de Ativos de TI, Entregas e Devoluções**: Modelagem de ativos, transações atômicas de movimentação, etiquetas QR code e histórico.
- [ ] **Etapa 5: Termos, Desligamento e Manutenções**: Emissão de termos PDF, checklist de desligamento e ordens de serviço de manutenção.
- [ ] **Etapa 6: Assinaturas, Licenças e Financeiro de Aplicativos**: Contratos, atribuição nominal de licenças e controle financeiro exclusivo de assinaturas.
- [ ] **Etapa 7: Domínios e Renovações**: Controle administrativo de domínios, subdomínios, DNS e confirmação de renovação.
- [ ] **Etapa 8: Integração do Aplicativo de Aniversariantes**: Integração das Netlify Functions e Blobs do ParabénsFlow sem duplicidade cadastral.
- [ ] **Etapa 9: Dashboard Consolidado, Relatórios CSV e Homologação Netlify**: Finalização das métricas consolidadas, testes finais e instruções de deploy.

---

## 7. Próxima Etapa Recomendada
Iniciar a **Etapa 3: Módulo de Funcionários**:
- Criar a migração `supabase/migrations/20260211000001_employees_schema.sql` com:
  - Tabela `employees` (matrícula opcional, nome completo, preferencial, e-mail/telefone corporativos, departamento, cargo, unidade, gestor, datas de admissão/desligamento, situação: ativo, afastado, desligado, observações restritas).
  - Restrições e índices de unicidade de e-mail corporativo e matrícula.
  - Políticas de RLS: RH e Admin possuem permissão de escrita; TI pode consultar e vincular ativos/licenças; Financeiro e Consulta possuem acesso de leitura específico.
  - Tela de ficha detalhada do colaborador com abas de ativos custodiados, histórico e licenças.
  - Importador CSV com validação por linha e pré-visualização.
