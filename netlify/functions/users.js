const { hashPassword, autenticarRequisicao, obterStore, conectarBlobs } = require('./utils/auth');

exports.handler = async (event, context) => {
  conectarBlobs(event);
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!['GET', 'POST', 'DELETE'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: `Método ${event.httpMethod} não permitido.` })
    };
  }

  try {
    // 1. Validar autenticação do administrador
    const adminSession = await autenticarRequisicao(event);
    if (!adminSession) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Acesso negado. Token inválido ou expirado.' })
      };
    }

    // GET: Listar administradores/leitores cadastrados
    if (event.httpMethod === 'GET') {
      if (adminSession.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Acesso negado.' })
        };
      }

      const store = obterStore('parabensflow-dados');
      const rawUsers = await store.get('usuarios');
      const usuarios = rawUsers ? JSON.parse(rawUsers) : [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(usuarios.map(u => ({ email: u.email, role: u.role || 'viewer' })))
      };
    }

    // DELETE: Remover um usuário cadastrado
    if (event.httpMethod === 'DELETE') {
      if (adminSession.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Apenas administradores podem remover usuários.' })
        };
      }

      const emailRemover = event.queryStringParameters?.email;
      if (!emailRemover) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'E-mail do usuário a remover é obrigatório.' })
        };
      }

      if (emailRemover.toLowerCase() === adminSession.email.toLowerCase()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Você não pode remover o seu próprio usuário.' })
        };
      }

      const store = obterStore('parabensflow-dados');
      const rawUsers = await store.get('usuarios');
      const usuarios = rawUsers ? JSON.parse(rawUsers) : [];

      const totalAdminsRestantes = usuarios.filter(u =>
        u.role === 'admin' && u.email.toLowerCase() !== emailRemover.toLowerCase()
      ).length;
      const alvo = usuarios.find(u => u.email.toLowerCase() === emailRemover.toLowerCase());

      if (!alvo) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuário não encontrado.' })
        };
      }

      if (alvo.role === 'admin' && totalAdminsRestantes === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Não é possível remover o único administrador restante.' })
        };
      }

      const usuariosRestantes = usuarios.filter(u => u.email.toLowerCase() !== emailRemover.toLowerCase());
      await store.set('usuarios', JSON.stringify(usuariosRestantes));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: `Usuário ${emailRemover} removido com sucesso!` })
      };
    }

    const body = JSON.parse(event.body || '{}');

    // Cadastro de um novo administrador/leitor (não é auto-edição)
    if (body.action === 'criar-usuario') {
      if (adminSession.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Apenas administradores podem cadastrar novos usuários.' })
        };
      }

      const { novoEmail, novaSenha, novoRole } = body;
      if (!novoEmail || !novaSenha) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'E-mail e senha do novo usuário são obrigatórios.' })
        };
      }
      if (novaSenha.length < 6) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres.' })
        };
      }

      const store = obterStore('parabensflow-dados');
      const rawUsers = await store.get('usuarios');
      const usuarios = rawUsers ? JSON.parse(rawUsers) : [];

      const jaExiste = usuarios.some(u => u.email.toLowerCase() === novoEmail.toLowerCase());
      if (jaExiste) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Já existe um usuário cadastrado com este e-mail.' })
        };
      }

      usuarios.push({
        email: novoEmail,
        passwordHash: hashPassword(novaSenha),
        role: ['viewer', 'editor'].includes(novoRole) ? novoRole : 'admin',
      });

      await store.set('usuarios', JSON.stringify(usuarios));

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ message: `Usuário ${novoEmail} cadastrado com sucesso!` })
      };
    }

    // Alteração do nível de acesso de outro usuário pelo administrador
    if (body.action === 'alterar-permissao') {
      if (adminSession.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Apenas administradores podem alterar permissões.' })
        };
      }

      const { emailAlvo, novoRole } = body;
      if (!emailAlvo || !['admin', 'editor', 'viewer'].includes(novoRole)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'E-mail do usuário e nível de acesso válido são obrigatórios.' })
        };
      }

      if (emailAlvo.toLowerCase() === adminSession.email.toLowerCase()) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Você não pode alterar o seu próprio nível de acesso.' })
        };
      }

      const store = obterStore('parabensflow-dados');
      const rawUsers = await store.get('usuarios');
      const usuarios = rawUsers ? JSON.parse(rawUsers) : [];

      const alvo = usuarios.find(u => u.email.toLowerCase() === emailAlvo.toLowerCase());
      if (!alvo) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuário não encontrado.' })
        };
      }

      alvo.role = novoRole;
      await store.set('usuarios', JSON.stringify(usuarios));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: `${alvo.email} agora é ${{ admin: 'Administrador', editor: 'Editor', viewer: 'Leitor' }[novoRole]}.`
        })
      };
    }

    // Redefinição da senha de outro usuário pelo administrador
    if (body.action === 'redefinir-senha') {
      if (adminSession.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Apenas administradores podem redefinir senhas.' })
        };
      }

      const { emailAlvo, novaSenha } = body;
      if (!emailAlvo || !novaSenha) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'E-mail do usuário e nova senha são obrigatórios.' })
        };
      }
      if (novaSenha.length < 6) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres.' })
        };
      }

      const store = obterStore('parabensflow-dados');
      const rawUsers = await store.get('usuarios');
      const usuarios = rawUsers ? JSON.parse(rawUsers) : [];

      const alvo = usuarios.find(u => u.email.toLowerCase() === emailAlvo.toLowerCase());
      if (!alvo) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Usuário não encontrado.' })
        };
      }

      alvo.passwordHash = hashPassword(novaSenha);
      await store.set('usuarios', JSON.stringify(usuarios));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: `Senha de ${alvo.email} redefinida com sucesso!` })
      };
    }

    const { currentPassword, newEmail, newPassword } = body;

    if (!currentPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'A senha atual é obrigatória por motivos de segurança.' })
      };
    }

    if (!newEmail && !newPassword) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Informe ao menos um dado para atualizar (e-mail ou senha).' })
      };
    }

    const store = obterStore('parabensflow-dados');
    
    // Obter lista atual de usuários
    const rawUsers = await store.get('usuarios');
    if (!rawUsers) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Não foi possível ler as informações de administradores.' })
      };
    }
    let usuarios = JSON.parse(rawUsers);

    // Encontrar o administrador da sessão
    const userIndex = usuarios.findIndex(u => u.email.toLowerCase() === adminSession.email.toLowerCase());
    if (userIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Usuário administrador não localizado.' })
      };
    }

    // Validar a senha atual digitada
    const currentPassHash = hashPassword(currentPassword);
    if (usuarios[userIndex].passwordHash !== currentPassHash) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'A senha atual informada está incorreta.' })
      };
    }

    // Alterar o E-mail se enviado
    if (newEmail) {
      const emailEmUso = usuarios.some((u, idx) => idx !== userIndex && u.email.toLowerCase() === newEmail.toLowerCase());
      if (emailEmUso) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Este e-mail já está associado a outro administrador.' })
        };
      }
      usuarios[userIndex].email = newEmail;
    }

    // Alterar a Senha se enviada
    if (newPassword) {
      usuarios[userIndex].passwordHash = hashPassword(newPassword);
    }

    // Gravar dados atualizados de volta no Netlify Blobs
    await store.set('usuarios', JSON.stringify(usuarios));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Dados cadastrais atualizados com sucesso!',
        email: usuarios[userIndex].email
      })
    };

  } catch (err) {
    console.error('Erro na função users:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
