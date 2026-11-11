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
- **Módulo de Aniversariantes**: ParabénsFlow original preservado em `public/aniversariantes-app/` e Netlify Serverless Functions em `netlify/functions/`, com SSO transparente (autenticação automática no ERP reflete no app sem segundo login).

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

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (se tiver banco real)

# 3. Rodar em ambiente de desenvolvimento
npm run dev

# 4. Validar build e tipagem TypeScript
npm run build
```

---

## 5. Status das Etapas de Implementação

- [x] **Etapa 1: Análise e Repositório**: Estrutura Git criada (`main` protegida, `develop` ativa), dependências e documentação central. Aplicativo de aniversariantes analisado e preservado.
- [x] **Etapa 2: Base, Autenticação e Perfis (RBAC)**: Login de usuários com perfis (Admin, TI, RH, Financeiro, Consulta), RLS e layout responsivo com menu lateral retrátil e cabeçalho corporativo.
- [x] **Integração do Aplicativo de Aniversariantes (ParabénsFlow)**: Aplicativo original copiado para `public/aniversariantes-app/` e funções Netlify serverless em `netlify/functions/`. Implementado SSO transparente (login como admin no ERP autentica automaticamente no ParabénsFlow sem segundo login via sessionStorage e postMessage).
- [ ] **Etapa 3: Módulo de Funcionários**: A iniciar.
- [ ] **Etapa 4: Inventário de Ativos de TI, Entregas e Devoluções**: A iniciar.
- [ ] **Etapa 5: Termos, Desligamento e Manutenções**: A iniciar.
- [ ] **Etapa 6: Assinaturas, Licenças e Financeiro de Aplicativos**: A iniciar.
- [ ] **Etapa 7: Domínios e Renovações**: A iniciar.
- [ ] **Etapa 9: Dashboard Consolidado, Relatórios CSV e Homologação Netlify**: A iniciar.

---

## 6. Próxima Etapa Recomendada
Iniciar a **Etapa 3: Módulo de Funcionários**:
- Migração SQL da tabela `employees` (matrícula, nome completo, preferencial, contatos, departamento, cargo, unidade, gestor, datas de admissão/desligamento, situação, observações restritas).
- Ficha individual do colaborador (histórico, ativos custodiados e licenças vinculadas).
- Importador CSV com validação por linha e prevenção de duplicidades.
