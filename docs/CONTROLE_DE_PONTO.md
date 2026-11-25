# Controle de Ponto: guia e checklist

Atualizado em 19/11/2026.

## Resumo

O Controle de Ponto está no ar no GeniantisERP desde 19/11/2026: o funcionário bate o ponto, o RH gerencia e cada departamento pode ter responsáveis que acompanham e aprovam a equipe.

- **Meu Ponto** (`/meu-ponto`): o funcionário bate as marcações do dia (entrada, saída almoço, volta, saída), vê o espelho do mês e o banco de horas, e pede ajuste, férias, folga, atestado ou falta justificada.
- **Controle de Ponto** (`/ponto`): abas Resumo, Pendências, Espelho, Jornadas, Feriados e Responsáveis.
- É um **controle interno**, não o ponto oficial (REP-P da Portaria 671).

## Quem acessa o quê

Admin e RH configuram tudo; o responsável de departamento vê e aprova só a sua equipe; o funcionário vê só o próprio ponto.

| Quem | Vê | Aprova pedidos | Jornadas, feriados, marcações, banco |
| --- | --- | --- | --- |
| Admin | Todos | Sim, inclusive os próprios | Sim |
| RH (nível Gerenciar) | Todos | Sim, menos os próprios | Sim |
| Nível Aprovar (ajuste por pessoa) | Todos | Sim, menos os próprios | Não |
| ADM (nível Ver) | Todos | Não | Não |
| Responsável de departamento | Só a equipe do(s) seu(s) departamento(s) | Se "Aprova" estiver marcado, menos os próprios | Não |
| Funcionário | Só o próprio ponto | Não | Não |

- Níveis do módulo: em **Usuários → Módulos → Controle de Ponto** (Ver / Aprovar / Gerenciar).
- Responsáveis: em **Controle de Ponto → Responsáveis**, um cartão por departamento. Uma pessoa pode cuidar de vários departamentos e um departamento pode ter vários responsáveis.
- Configuração atual: **Inez** em Pedagogia e GHESTA; uma segunda pessoa só em GHESTA.
- Pedido do próprio responsável vai para o RH.
- Meu Ponto aparece para qualquer login ligado a um cadastro de funcionário (**Usuários → Editar → Cadastro de funcionário**).

## Regras de cálculo

O saldo do dia é trabalhado menos previsto, acumulado no banco de horas desde o início do controle, contando só dias já encerrados (até ontem).

- **Jornada padrão:** segunda a sexta, 09:00 às 18:00 com 1h de intervalo (8h por dia, 40h semanais), tolerância de 10 min. O RH muda o padrão em **Jornadas → Jornada padrão** (entrada, saída e intervalo preenchem seg–sex) e, se precisar, dá uma jornada própria a um funcionário desmarcando "Seguir a jornada padrão".
- **Tolerância:** diferença de até 10 min no dia não conta (ajustável de 0 a 60).
- **Hora do registro:** sempre a do servidor, fuso de Brasília; dois cliques em menos de 1 minuto são bloqueados.
- **Ordem das marcações:** 1ª entrada, 2ª saída almoço, 3ª volta, 4ª saída; número ímpar no dia = **incompleto**.
- **Sem marcação em dia previsto** = falta (desconta o dia inteiro).
- **Não descontam:** feriado, férias, atestado, folga abonada, falta justificada.
- **Folga do banco:** desconta o dia do saldo.
- **Início do controle:** data geral em Jornadas (hoje 19/11/2026), ou a admissão se for depois, ou uma data própria do funcionário. Saldo de antes entra como lançamento manual no banco.
- **Limitação:** turno que passa da meia-noite é dividido em dois dias.

## Checklist de testes

Faça cada teste com o login indicado e marque quando o resultado bater com o esperado. Se algo falhar, mande um print e diga com qual login estava.

### Como Admin ou RH

- [ ] Controle de Ponto aparece no menu com as 6 abas (Resumo, Pendências, Espelho, Jornadas, Feriados, Responsáveis).
- [ ] Resumo lista todos os funcionários, agrupados por departamento; o filtro de departamento muda os cartões e o CSV.
- [ ] Jornadas: mudar a jornada de um funcionário (ex.: sábado 4:00), salvar, trocar de funcionário e voltar: o valor continua lá.
- [ ] Feriados: incluir um feriado municipal; ele aparece no espelho como Feriado e o dia fica sem horas previstas.
- [ ] Responsáveis: Inez em Pedagogia e GHESTA, a segunda pessoa só em GHESTA.
- [ ] Espelho → Marcações: incluir uma marcação manual com motivo; ela aparece no dia e em Logs de Atividade.
- [ ] Espelho → Férias / folga: lançar férias de um funcionário; os dias aparecem como Ausência, sem desconto.
- [ ] Espelho → Lançar no banco: crédito de 2:30; o banco de horas sobe 2h30.

### Como funcionário (perfil Funcionário)

- [ ] Ao entrar, cai direto em Meu Ponto; o menu não mostra outros módulos.
- [ ] Registrar entrada: a hora aparece em Hoje e no espelho.
- [ ] Clicar de novo em menos de 1 minuto: aparece o aviso de marcação repetida.
- [ ] Pedir ajuste de marcação de um dia passado; fica Pendente em Minhas solicitações.
- [ ] Pedir férias e depois cancelar o pedido.
- [ ] Tentar abrir `/ponto` digitando no endereço: aparece Acesso Restrito.

### Como Inez (responsável por Pedagogia e GHESTA)

- [ ] Controle de Ponto aparece só com Resumo, Pendências e Espelho.
- [ ] Resumo e Espelho mostram só funcionários de Pedagogia e GHESTA.
- [ ] Aprovar o ajuste pedido pelo funcionário da Pedagogia; a marcação entra no espelho dele.
- [ ] Pedir uma folga para si mesma (Meu Ponto): o pedido NÃO aparece para ela aprovar, só para o RH.
- [ ] Não consegue incluir marcações, mudar jornadas nem feriados.

### Como a segunda responsável (só GHESTA)

- [ ] Vê só funcionários da GHESTA, não os da Pedagogia.
- [ ] Com "Aprova" desmarcado em Responsáveis: vê os pedidos da equipe sem os botões de aprovar.

### Segurança

- [ ] Usuário comum não consegue trocar o próprio cadastro de funcionário nem o e-mail (só o Admin, em Usuários).
- [ ] Criar usuário com perfil Funcionário sem escolher o cadastro: o sistema recusa.

## Antes de liberar para a equipe

Depois dos testes, configure o básico e só então crie os logins dos funcionários.

- [ ] **Data de início do controle** (Jornadas): sugestão 01/12/2026, para o primeiro fechamento ser um mês cheio.
- [ ] **Feriados** (Feriados): incluir Carnaval, Corpus Christi e os estaduais/municipais. Os nacionais de 2026 e 2027 já estão cadastrados.
- [ ] **Jornadas diferentes** (Jornadas): estagiários, meio período, quem trabalha aos sábados.
- [ ] **Saldo anterior** (Espelho → Lançar no banco): se existia banco de horas antes, lançar o saldo de cada um.
- [ ] **E-mail do Almir da Silva**: está `aline.s@geniantis.org` na ficha; corrigir antes de criar o login dele.
- [ ] **Acordo de banco de horas** assinado por funcionário (exigência da CLT para compensar horas): confirmar com o RH.

### Liberar

1. Em **Usuários → Novo usuário**, buscar o funcionário pelo nome (nome e e-mail vêm do cadastro).
2. Perfil **Funcionário**, criar e enviar a senha por um canal seguro.
3. Quem já tem login: **Editar** e conferir o **Cadastro de funcionário**.
4. Orientação para a equipe: abrir o site, ir em Meu Ponto, bater as 4 marcações do dia e pedir ajuste quando esquecer.

### Rotina

- **Diária:** responsáveis e RH olham Pendências; RH confere os dias incompletos no Resumo.
- **Fechamento do mês:** exportar o CSV do Resumo (por departamento, se quiser) e o espelho de cada funcionário.

## Referência técnica

As 5 migrations já rodaram no Supabase e o código está no ramo `develop` de `sidneya-design/GeniantisERP`, que o Netlify publica.

| Migration | O que faz |
| --- | --- |
| `20261119000035_role_funcionario.sql` | Cria o perfil Funcionário |
| `20261119000036_timekeeping.sql` | Tabelas, cálculo, aprovação e feriados nacionais |
| `20261119000037_lock_profile_employee_link.sql` | Só o Admin muda cadastro ligado e e-mail do usuário |
| `20261119000038_timesheet_approve_level.sql` | Níveis Ver / Aprovar / Gerenciar |
| `20261119000039_timesheet_department_managers.sql` | Responsáveis por departamento |

- **Telas:** `src/pages/MyTimesheet.tsx` (Meu Ponto) e `src/pages/Timesheet.tsx` (Controle de Ponto).
- **Serviço:** `src/services/timesheetService.ts`.
- **Commits:** `b8ed112` (módulo de ponto) e `9ee6454` (responsáveis e níveis).
- **Deploy:** a pasta GeniantisERP da Mesa está ligada ao GitHub; enviar ao `develop` publica no Netlify.
- **Documentação do projeto:** `docs/PROJECT_DOCUMENTATION.md`.
