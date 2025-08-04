import 'dotenv/config'; // Carrega as variáveis de .env
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

import { generateCommands, updateCurrentDirectory } from './agent.js';
import { executeCommand } from './shell.js';

// --- Configuração do Servidor ---
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir os arquivos estáticos do frontend
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// --- Lógica do WebSocket ---
wss.on('connection', (ws) => {
  console.log('✅ Cliente conectado via WebSocket');
  ws.send(JSON.stringify({ type: 'status', message: 'Conectado ao agente. Pronto para começar!' }));

  let currentDirectory = process.cwd();

  ws.on('message', async (message) => {
    const userInput = message.toString();
    console.log(`👤 Mensagem recebida: ${userInput}`);
    ws.send(JSON.stringify({ type: 'user', message: userInput }));

    // 1. Gerar comandos usando a IA
    ws.send(JSON.stringify({ type: 'status', message: 'Analisando e gerando comandos...' }));
    const commands = await generateCommands(userInput);

    if (!commands || commands.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: 'Não foi possível gerar comandos para esta solicitação.' }));
      return;
    }

    // 2. Executar comandos
    for (const command of commands) {
      ws.send(JSON.stringify({ type: 'command', message: `> ${command}` }));

      // Lógica especial para 'cd' para manter o estado do diretório no servidor
      if (command.trim().startsWith('cd ')) {
          // Extrai o caminho de forma mais robusta, pegando tudo após "cd "
          const newDir = command.trim().substring(2).trim();
          if (!newDir) {
              // Se for apenas 'cd', vai para o diretório home
              currentDirectory = process.env.HOME || process.env.USERPROFILE;
          } else {
              // Resolve o novo caminho a partir do diretório atual
              currentDirectory = path.resolve(currentDirectory, newDir);
          }

          try {
              // Valida se o diretório existe ao tentar acessá-lo
              process.chdir(currentDirectory);
              updateCurrentDirectory(currentDirectory); // Atualiza o contexto do agente
              ws.send(JSON.stringify({ type: 'output', message: `Diretório de trabalho: ${currentDirectory}` }));
          } catch (err) {
              // Se falhar, reverte a mudança e informa o erro
              ws.send(JSON.stringify({ type: 'error', message: `Erro ao mudar para o diretório '${newDir}': ${err.message}` }));
              currentDirectory = process.cwd(); // Garante que o estado volte ao normal
          }
          continue; // Pula para o próximo comando
      }

      const result = await executeCommand(command, currentDirectory);

      if (result.output) {
        ws.send(JSON.stringify({ type: 'output', message: result.output }));
      }
      if (result.error) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
      }
      if (!result.success) {
        // Para a execução se um comando falhar
        ws.send(JSON.stringify({ type: 'status', message: 'A execução foi interrompida devido a um erro.' }));
        break;
      }
    }
     ws.send(JSON.stringify({ type: 'status', message: 'Execução concluída. Aguardando próximo comando.' }));
  });

  ws.on('close', () => {
    console.log('❌ Cliente desconectado');
  });
});

// --- Iniciar o Servidor ---
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
