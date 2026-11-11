const crypto = require('crypto');
const { autenticarRequisicao, obterStore, conectarBlobs } = require('./utils/auth');

exports.handler = async (event, context) => {
  conectarBlobs(event);
  // Configuração de headers CORS para desenvolvimento local
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Tratar requisição OPTIONS para CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. Validar autenticação do administrador
    const adminSession = await autenticarRequisicao(event);
    if (!adminSession) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Acesso negado. Token de sessão inválido ou expirado.' })
      };
    }

    // Acessar o store de dados do Netlify Blobs
    const store = obterStore('parabensflow-dados');
    
    // Obter lista atual de contatos
    const rawData = await store.get('contatos');
    let contatos = rawData ? JSON.parse(rawData) : [];

    const { httpMethod } = event;

    // Bloquear operações de modificação para usuários com permissão de apenas visualização (viewer).
    // Admin e Editor podem cadastrar, editar e remover contatos.
    if (httpMethod === 'POST' || httpMethod === 'DELETE') {
      if (adminSession.role !== 'admin' && adminSession.role !== 'editor') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Acesso negado. Seu perfil possui apenas permissão de visualização.' })
        };
      }
    }

    // GET: Listar todos os contatos
    if (httpMethod === 'GET') {
      // Ordenar por nome antes de retornar
      contatos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(contatos)
      };
    } 
    
    // POST: Criar, atualizar ou importar em lote
    if (httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      // Se for um Array, processar importação em lote
      if (Array.isArray(body)) {
        if (body.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Nenhum contato enviado para importação.' })
          };
        }

        // Criar contatos com ID único
        const novosContatos = body.map(c => ({
          id: c.id || crypto.randomUUID(),
          nome: c.nome,
          email: c.email,
          data_nascimento: c.data_nascimento,
          data_nascimento_original: c.data_nascimento_original,
          criado_em: c.criado_em || new Date().toISOString()
        }));

        contatos.push(...novosContatos);
        await store.set('contatos', JSON.stringify(contatos));

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: `${novosContatos.length} contatos importados com sucesso!`, data: novosContatos })
        };
      }

      // Se for um objeto único, realizar fluxo normal (criação ou edição)
      const { id, nome, email, data_nascimento, data_nascimento_original } = body;

      if (!nome || !email || !data_nascimento) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Nome, email e data de nascimento são obrigatórios.' })
        };
      }

      if (id) {
        // Atualizar contato existente
        let atualizado = false;
        contatos = contatos.map(c => {
          if (c.id === id) {
            atualizado = true;
            return {
              ...c,
              nome,
              email,
              data_nascimento,
              data_nascimento_original: data_nascimento_original ?? c.data_nascimento_original
            };
          }
          return c;
        });

        if (!atualizado) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Contato não encontrado.' })
          };
        }

        await store.set('contatos', JSON.stringify(contatos));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Contato atualizado com sucesso!' })
        };
      } else {
        // Criar novo contato
        const novoContato = {
          id: crypto.randomUUID(),
          nome,
          email,
          data_nascimento,
          criado_em: new Date().toISOString()
        };

        contatos.push(novoContato);
        await store.set('contatos', JSON.stringify(contatos));

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ message: 'Contato adicionado com sucesso!', data: novoContato })
        };
      }
    } 
    
    // DELETE: Excluir um ou vários contatos
    if (httpMethod === 'DELETE') {
      // Suporta exclusão em lote: body com { ids: [...] } ou individual: ?id= ou { id }
      let ids = [];
      const singleId = event.queryStringParameters?.id;
      if (singleId) {
        ids = [singleId];
      } else {
        const body = JSON.parse(event.body || '{}');
        if (body.ids && Array.isArray(body.ids)) {
          ids = body.ids;
        } else if (body.id) {
          ids = [body.id];
        }
      }

      if (ids.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID do contato é obrigatório.' })
        };
      }

      const idsSet = new Set(ids);
      const totalAntes = contatos.length;
      contatos = contatos.filter(c => !idsSet.has(c.id));
      const excluidos = totalAntes - contatos.length;

      if (excluidos === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Nenhum contato encontrado para exclusão.' })
        };
      }

      await store.set('contatos', JSON.stringify(contatos));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: `${excluidos} contato${excluidos === 1 ? '' : 's'} excluído${excluidos === 1 ? '' : 's'} com sucesso!` })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: `Método ${httpMethod} não suportado.` })
    };

  } catch (err) {
    console.error('Erro na função contacts:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
