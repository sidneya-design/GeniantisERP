# GeniantisERP: como continuar o desenvolvimento em outro computador

Atualizado em 12/11/2026. Este guia reúne o necessário para montar o ambiente num computador novo e continuar o trabalho com o Claude Code de onde paramos. **Não há senhas nem chaves aqui**: elas ficam no painel do Supabase e da Netlify.

## 1. Visão geral

- **O que é:** ERP interno da Fundação Geniantis, com Funcionários, Ativos de TI, Entregas & Devoluções, Manutenções, Assinaturas & Licenças, Domínios, Financeiro, Aniversariantes, Relatórios, Logs, Usuários e Configurações.
- **Tecnologia:** React + Vite + TypeScript + Tailwind no navegador; banco, login e arquivos no Supabase; funções e hospedagem na Netlify.
- **Produção:** https://admgeniantis.netlify.app
- **Código:** https://github.com/sidneya-design/GeniantisERP. O repositório é público, e a única branch é a **develop**. Cada push na develop gera um deploy automático na Netlify.
- **Supabase:** projeto `jjwlkibkltwgdswvemnr`. O localhost usa o **mesmo banco da produção**.
- **Perfis que fazem login:** Admin, ADM, TI e RH. As permissões ficam em `src/lib/permissions.ts` e nas regras de segurança (RLS) das migrations.

## 2. Preparar o computador novo

1. Instale o **Git**, o **Node.js 20** (versão LTS) e o **VS Code**.
2. Instale o **Claude Code**, como extensão do VS Code ou pela linha de comando, e entre com a mesma conta Claude.
3. Instale o GitHub CLI e rode `gh auth login` com a conta **sidneya-design**, que é a dona do repositório.
4. Baixe o projeto:
   ```
   git clone https://github.com/sidneya-design/GeniantisERP.git
   cd GeniantisERP
   ```
5. Configure o autor dos commits **só neste repositório**, igual ao computador atual (no computador atual, veja com `git config user.email` dentro da pasta do projeto):
   ```
   git config user.name "Sidney Amorim"
   git config user.email "<o mesmo e-mail do computador atual>"
   ```
6. Instale as dependências: `npm install`.

## 3. Arquivo .env (localhost)

Crie o arquivo `.env` na raiz do projeto, copiando o `.env.example`. Ele **nunca vai para o GitHub**, porque está no `.gitignore`. Preencha:

- `VITE_SUPABASE_URL=https://jjwlkibkltwgdswvemnr.supabase.co`
- `VITE_SUPABASE_ANON_KEY=`: a **Publishable key**, em Supabase › Project Settings › API Keys. É a chave pública, não a secreta.
- `VITE_ORGANIZATION_NAME=Geniantis`

Para rodar, use `npm run dev` e abra http://localhost:5173. Para conferir antes de publicar, use `npm run build`, que faz a verificação de tipos e o build.

No localhost, as funções da Netlify não rodam: e-mail de aniversário, criação de usuários, esqueci minha senha e o painel de aniversariantes. Elas só funcionam no site publicado.

## 4. Variáveis já cadastradas na Netlify (referência)

Ficam em Netlify › Site configuration › Environment variables. Os valores **não** estão aqui.

- **Frontend:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Funções:**
  - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta do Supabase.
  - `JWT_SECRET`.
  - `GMAIL_USER` e `GMAIL_APP_PASSWORD`: a senha é a senha de app do e-mail corporativo.
  - `EMAIL_FROM`.
  - `NETLIFY_SITE_ID`: é o Project ID do site.
  - `NETLIFY_BLOBS_TOKEN`.
- **Opcionais:**
  - `ADMIN_INITIAL_EMAIL` e `ADMIN_INITIAL_PASSWORD`: podem ser apagadas.
  - `PAINEL_LOGIN_PROPRIO`: deixe sem cadastrar, para o painel só abrir pelo ERP.

## 5. Banco de dados: migrations

- Os arquivos ficam em `supabase/migrations`. Eles são rodados **à mão**: Supabase › SQL Editor › New query, colar o arquivo inteiro, sem selecionar nada, e clicar em Run.
- Todas as migrations até a **20261124000052_notify_activities.sql** já foram rodadas em produção.
- Toda migration é escrita para poder ser rodada mais de uma vez sem estragar nada.
- Como o localhost usa o banco de produção, quando o código depende de uma coluna nova, rode a migration **antes** de testar.

## 6. Levar a memória do Claude Code

O Claude guarda anotações do projeto (decisões, pendências, preferências) fora do repositório. Para levar:

1. Copie a pasta **GeniantisERP-memoria-claude** da Mesa do computador atual.
2. No computador novo, abra o projeto uma vez no Claude Code. Isso cria a pasta do projeto em `~/.claude/projects/`, com o nome conforme o caminho do clone.
3. Cole os arquivos `.md` dentro da subpasta `memory` dessa nova pasta.

Se preferir não copiar, cole no Claude a mensagem da seção 9.

## 7. Regras combinadas

- **Commit e push só com autorização.** O Claude sempre pergunta antes.
- **Juntar ajustes por push.** A cota de deploys da Netlify está apertada, e cada push gera um deploy.
- **Testar primeiro no localhost.** Depois do deploy, recarregue o site com Cmd+Shift+R (ou Ctrl+Shift+R).
- **Dados pessoais** (CPF, endereço, contato de emergência) ficam na tabela `employee_private`, e só Admin, ADM e RH leem.
- **Termos de entrega:** o modelo é editável pelo Admin em Configurações › Modelos de termo.
- **Importação por planilha** em Funcionários e Ativos: o e-mail (funcionário) e o patrimônio (ativo) identificam quem já existe, e nesses casos a linha atualiza o cadastro.

## 8. Pendências e ideias

- **E-mail de aniversário duplicado:** desativar a rotina agendada `send-birthdays` no site antigo **aniversariantesgeniais** da Netlify. O ERP já envia sozinho, todo dia às 07:00.
- **Logo do termo:** trocar pelo logo "Geniantis Fundação" quando houver o arquivo (SVG ou PNG).
- **Senhas:** a recomendação é usar um gerenciador (Bitwarden) e criar no ERP um campo "Onde está a senha" em Domínios e Assinaturas.
- **Permissões configuráveis:** uma tela para o Admin liberar Ver/Editar por perfil e módulo. Foi adiada.
- **Outras ideias:**
  - campos de IP e tipo para impressoras;
  - estoque por quantidade para acessórios;
  - e-mail de boas-vindas para novos usuários;
  - salvar o nome da organização em Configurações;
  - notificações reais no sino.

## 9. Mensagem para colar no Claude Code no computador novo

> Estou continuando o desenvolvimento do GeniantisERP num computador novo (React + Vite + Supabase + Netlify; produção em admgeniantis.netlify.app; repositório sidneya-design/GeniantisERP, branch develop). Regras: nunca faça commit ou push sem me perguntar; junte ajustes antes de publicar porque a cota de deploys da Netlify está apertada; migrations do Supabase eu rodo à mão no SQL Editor e todas até a 20261124000052 já estão aplicadas; o localhost usa o banco de produção. Antes de começar, leia docs/COMO-CONTINUAR.md e o código (src/lib/permissions.ts, src/pages, supabase/migrations) para entender o estado atual.
