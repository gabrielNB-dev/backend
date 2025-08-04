#!/usr/bin/env node

import { exec, spawn } from "child_process";
import { promisify } from "util";
import readline from "readline";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuração do Google AI
const genAI = new GoogleGenerativeAI("AIzaSyC7Gdw7n1_TvFcLC9EV3m88-588u2I1L-g");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Promisify exec para usar async/await
const execAsync = promisify(exec);

// Interface de linha de comando
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Histórico de conversa e contexto
let conversationHistory = [];
let context = {
  currentDirectory: process.cwd(),
  lastCommands: [],
  userPreferences: {},
  systemInfo: null,
};

// Função para executar comandos shell de forma segura
async function executarComando(comando) {
  try {
    console.log(`\n🔄 Executando: ${comando}`);

    const { stdout, stderr } = await execAsync(comando, {
      timeout: 30000,
      cwd: context.currentDirectory,
    });

    if (stdout) {
      console.log(`✅ Saída:\n${stdout}`);
      return {
        success: true,
        output: stdout,
        error: null,
      };
    }

    if (stderr) {
      console.log(`⚠️  Avisos:\n${stderr}`);
      return {
        success: true,
        output: stderr,
        error: null,
      };
    }

    return {
      success: true,
      output: "Comando executado com sucesso (sem saída)",
      error: null,
    };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { success: false, output: null, error: error.message };
  }
}

// Função para executar comandos interativos
async function executarComandoInterativo(comando, respostasAutomaticas = []) {
  return new Promise((resolve) => {
    console.log(`\n🔄 Executando comando interativo: ${comando}`);

    const processo = spawn("bash", ["-c", comando], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: context.currentDirectory,
    });

    let output = "";
    let errorOutput = "";
    let respostaIndex = 0;

    processo.stdout.on("data", (data) => {
      const texto = data.toString();
      output += texto;
      console.log(`📤 Saída: ${texto}`);

      if (
        texto.includes("?") ||
        texto.includes("(y/N)") ||
        texto.includes("(Y/n)") ||
        texto.includes("Proceed?") ||
        texto.includes("Continue?")
      ) {
        if (respostasAutomaticas[respostaIndex]) {
          console.log(
            `🤖 Respondendo automaticamente: ${respostasAutomaticas[respostaIndex]}`
          );
          processo.stdin.write(respostasAutomaticas[respostaIndex] + "\n");
          respostaIndex++;
        } else {
          rl.question(
            `❓ Comando pede confirmação. Responder (y/n): `,
            (resposta) => {
              processo.stdin.write(resposta + "\n");
            }
          );
        }
      }
    });

    processo.stderr.on("data", (data) => {
      const texto = data.toString();
      errorOutput += texto;
      console.log(`⚠️  Erro: ${texto}`);
    });

    processo.on("close", (code) => {
      console.log(`✅ Comando interativo finalizado com código: ${code}`);
      resolve({
        success: code === 0,
        output: output,
        error: errorOutput,
        exitCode: code,
      });
    });

    setTimeout(() => {
      processo.kill();
      resolve({
        success: false,
        output: output,
        error: "Timeout - comando interativo demorou muito",
        exitCode: -1,
      });
    }, 60000);
  });
}

// Função para analisar se um comando precisa de interação
function precisaInteracao(comando) {
  const comandosInterativos = [
    "sudo",
    "npm install",
    "yarn install",
    "apt install",
    "apt-get install",
    "dnf install",
    "yum install",
    "pacman -S",
    "brew install",
    "cargo install",
    "pip install",
    "gem install",
    "composer install",
    "docker run",
    "docker build",
    "git clone",
    "git push",
    "git pull",
    "ssh",
    "scp",
    "rsync",
    "cp -i",
    "mv -i",
    "rm -i",
  ];

  return comandosInterativos.some((cmd) => comando.includes(cmd));
}

// Função para gerar respostas automáticas
async function gerarRespostasAutomaticas(comando, contexto) {
  try {
    const prompt = `
Você é um assistente que decide como responder a prompts interativos de comandos shell.

COMANDO: "${comando}"
CONTEXTO: "${contexto}"

ANÁLISE:
1. Se for um comando de instalação (npm, apt, etc.) → geralmente "y" ou "yes"
2. Se for sudo → pode precisar de senha ou "y" para confirmação
3. Se for git push/pull → pode precisar de credenciais
4. Se for docker → geralmente "y" para confirmações
5. Se for perigoso (rm, format) → pedir confirmação do usuário

RESPONDA APENAS:
- "AUTO: y" se deve responder automaticamente "sim"
- "AUTO: n" se deve responder automaticamente "não"
- "ASK_USER" se deve pedir confirmação do usuário
- "NEEDS_PASSWORD" se precisa de senha

Exemplo: npm install package → AUTO: y
Exemplo: sudo rm -rf / → ASK_USER
Exemplo: git push → ASK_USER (pode precisar de credenciais)
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    if (response.includes("AUTO: y")) {
      return ["y"];
    } else if (response.includes("AUTO: n")) {
      return ["n"];
    } else if (response.includes("NEEDS_PASSWORD")) {
      return ["ASK_PASSWORD"];
    } else {
      return ["ASK_USER"];
    }
  } catch (error) {
    return ["ASK_USER"];
  }
}

// Função para entender a intenção e criar plano (estilo Cursor)
async function entenderIntencao(mensagem) {
  try {
    const prompt = `
Você é um assistente de terminal inteligente como o Cursor - conversacional, proativo e contextual.

CONTEXTO ATUAL:
- Diretório: ${context.currentDirectory}
- Últimos comandos: ${context.lastCommands.slice(-3).join(", ")}
- Histórico: ${conversationHistory.length} mensagens

MENSAGEM DO USUÁRIO: "${mensagem}"

COMPORTAMENTO COMO CURSOR:
1. Seja conversacional e natural
2. Seja PROATIVO - execute ações diretas quando possível
3. Só faça perguntas quando realmente necessário
4. Entenda contexto e histórico
5. Seja proativo - sugira e execute coisas úteis
6. Se for uma tarefa complexa, quebre em passos e execute
7. Considere o que o usuário realmente quer

ANÁLISE:
- O que o usuário quer fazer?
- Posso executar diretamente ou preciso de mais info?
- Há contexto relevante que posso usar?
- Devo fazer perguntas ou agir?

REGRAS IMPORTANTES:
- Se o usuário pede para "fazer tudo" ou "criar projeto", execute diretamente
- Se pede para "criar pasta X", crie a pasta
- Se pede para "instalar Y", instale
- Se pede para "configurar Z", configure
- Só pergunte se realmente não conseguir executar

RESPONDA EM JSON:
{
  "intencao": "o que o usuário quer",
  "tipo": "comando_direto|acao_direta|tarefa_complexa|precisa_esclarecimento",
  "comandos": ["lista de comandos para executar"],
  "perguntas": ["só perguntas ESSENCIAIS"],
  "sugestoes": ["sugestões úteis"],
  "resposta_inicial": "resposta conversacional natural"
}

EXEMPLOS:
- "ls" → comando direto
- "criar pasta teste" → ação direta (mkdir teste)
- "fazer backup" → ação direta (comandos de backup)
- "instalar node" → ação direta (comandos de instalação)
- "criar projeto react" → ação direta (create-react-app ou vite)
- "configurar git" → ação direta (git init, config)
- "organizar arquivos" → precisa esclarecimento (quais arquivos?)

Responda APENAS o JSON.
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      return {
        intencao: "comando direto",
        tipo: "comando_direto",
        comandos: [mensagem],
        perguntas: [],
        sugestoes: [],
        resposta_inicial: "Vou executar esse comando para você.",
      };
    }
  } catch (error) {
    return {
      intencao: "comando direto",
      tipo: "comando_direto",
      comandos: [mensagem],
      perguntas: [],
      sugestoes: [],
      resposta_inicial: "Vou executar esse comando para você.",
    };
  }
}

// Função para executar ações diretas baseadas em palavras-chave
function detectarAcoesDiretas(mensagem) {
  const acoes = [];
  const mensagemLower = mensagem.toLowerCase();

  // Criar pasta
  if (
    mensagemLower.includes("criar pasta") ||
    mensagemLower.includes("mkdir")
  ) {
    const match = mensagem.match(
      /(?:criar pasta|criar diretório|mkdir)\s+(\w+)/i
    );
    if (match) {
      acoes.push(`mkdir -p "${match[1]}"`);
    }
  }

  // Criar projeto React com Vite
  if (mensagemLower.includes("react") && mensagemLower.includes("vite")) {
    acoes.push("npm create vite@latest rfin -- --template react");
    acoes.push("cd rfin && npm install");
    acoes.push("cd rfin && npm install react-router-dom axios");
  }

  // Criar projeto React sem TypeScript
  if (
    mensagemLower.includes("react") &&
    (mensagemLower.includes("criar") || mensagemLower.includes("projeto"))
  ) {
    if (mensagemLower.includes("vite")) {
      acoes.push("npm create vite@latest rfin -- --template react");
      acoes.push("cd rfin && npm install");
    } else {
      acoes.push("npx create-react-app rfin");
    }
  }

  // Criar projeto Node/Backend
  if (
    mensagemLower.includes("node") &&
    (mensagemLower.includes("criar") || mensagemLower.includes("projeto"))
  ) {
    acoes.push("mkdir rfin-backend");
    acoes.push("cd rfin-backend && npm init -y");
    acoes.push("npm install express cors dotenv");
  }

  // Sistema financeiro completo
  if (
    mensagemLower.includes("financeiro") ||
    mensagemLower.includes("controle financeiro")
  ) {
    // Frontend React
    acoes.push("npm create vite@latest rfin -- --template react");
    acoes.push("cd rfin && npm install");
    acoes.push(
      "cd rfin && npm install react-router-dom axios chart.js react-chartjs-2"
    );

    // Backend Node
    acoes.push("mkdir rfin-backend");
    acoes.push("cd rfin-backend && npm init -y");
    acoes.push("cd rfin-backend && npm install express cors dotenv");

    // Criar estrutura de arquivos
    acoes.push("cd rfin && mkdir -p src/components src/pages src/services");
    acoes.push("cd rfin-backend && mkdir -p routes controllers models");
  }

  // Criar estrutura de sistema financeiro
  if (
    mensagemLower.includes("dividas") ||
    mensagemLower.includes("salarios") ||
    mensagemLower.includes("contas")
  ) {
    // Criar estrutura de dados JSON
    acoes.push("mkdir -p data");
    acoes.push(
      'echo \'{"dividas": [], "salarios": [], "contas": []}\' > data/financeiro.json'
    );

    // Criar componentes React básicos
    acoes.push("cd rfin && mkdir -p src/components/Financeiro");
    acoes.push(
      "cd rfin && mkdir -p src/pages/Dashboard src/pages/Dividas src/pages/Salarios"
    );
  }

  // Instalar dependências específicas
  if (
    mensagemLower.includes("instalar") ||
    mensagemLower.includes("npm install")
  ) {
    const match = mensagem.match(/(?:instalar|install)\s+(\w+)/i);
    if (match) {
      acoes.push(`npm install ${match[1]}`);
    }
  }

  // Configurar Git
  if (mensagemLower.includes("git") && mensagemLower.includes("configurar")) {
    acoes.push("git init");
    acoes.push("git add .");
    acoes.push('git commit -m "Initial commit"');
  }

  // Fazer backup
  if (
    mensagemLower.includes("backup") ||
    mensagemLower.includes("fazer backup")
  ) {
    acoes.push("tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz .");
  }

  // Limpar arquivos temporários
  if (mensagemLower.includes("limpar") || mensagemLower.includes("clean")) {
    acoes.push('find . -name "*.tmp" -delete');
    acoes.push('find . -name "*.log" -delete');
  }

  // Verificar sistema
  if (
    mensagemLower.includes("sistema") ||
    mensagemLower.includes("verificar")
  ) {
    acoes.push("df -h");
    acoes.push("free -h");
    acoes.push("ps aux | head -10");
  }

  // "Fazer tudo" - executar comandos básicos
  if (mensagemLower.includes("fazer tudo") || mensagemLower.includes("tudo")) {
    acoes.push("ls -la");
    acoes.push("pwd");
    acoes.push("whoami");
  }

  // Criar projeto completo React + Node + Sistema Financeiro
  if (
    mensagemLower.includes("sistema") &&
    mensagemLower.includes("financeiro") &&
    (mensagemLower.includes("react") || mensagemLower.includes("node"))
  ) {
    // Frontend React
    acoes.push("npm create vite@latest rfin -- --template react");
    acoes.push("cd rfin && npm install");
    acoes.push(
      "cd rfin && npm install react-router-dom axios chart.js react-chartjs-2 @mui/material @emotion/react @emotion/styled"
    );

    // Backend Node
    acoes.push("mkdir rfin-backend");
    acoes.push("cd rfin-backend && npm init -y");
    acoes.push("cd rfin-backend && npm install express cors dotenv");

    // Estrutura de dados
    acoes.push("mkdir -p data");
    acoes.push(
      'echo \'{"dividas": [], "salarios": [], "contas": [], "receitas": [], "despesas": []}\' > data/financeiro.json'
    );

    // Estrutura de pastas
    acoes.push(
      "cd rfin && mkdir -p src/components/Financeiro src/pages/Dashboard src/pages/Dividas src/pages/Salarios src/pages/Contas src/services"
    );
    acoes.push("cd rfin-backend && mkdir -p routes controllers models data");

    // Arquivos básicos
    acoes.push(
      "cd rfin && touch src/components/Financeiro/Dashboard.jsx src/components/Financeiro/Dividas.jsx src/components/Financeiro/Salarios.jsx"
    );
    acoes.push(
      "cd rfin-backend && touch server.js routes/financeiro.js controllers/financeiroController.js"
    );
  }

  return acoes;
}

// Função para fazer perguntas e esclarecer
async function esclarecerDuvidas(perguntas) {
  const respostas = {};

  for (const pergunta of perguntas) {
    const resposta = await new Promise((resolve) => {
      rl.question(`🤔 ${pergunta}: `, resolve);
    });
    respostas[pergunta] = resposta;
  }

  return respostas;
}

// Função para analisar resultados (estilo Cursor)
async function analisarResultados(mensagem, comandos, resultados) {
  try {
    const resultadosTexto = resultados
      .map(
        (r, i) =>
          `Comando ${i + 1}: ${comandos[i]}\nResultado: ${r.output || r.error}`
      )
      .join("\n\n");

    const prompt = `
Você é um assistente conversacional como o Cursor analisando resultados de comandos.

MENSAGEM ORIGINAL: "${mensagem}"
COMANDOS EXECUTADOS: ${comandos.join(", ")}
RESULTADOS: ${resultadosTexto}

COMPORTAMENTO:
1. Seja natural e conversacional
2. Explique o que aconteceu de forma clara
3. Destaque informações importantes
4. Se houver problemas, sugira soluções
5. Se for bem-sucedido, confirme e sugira próximos passos
6. Use linguagem amigável e útil
7. Considere o contexto da conversa

Responda de forma natural, como se estivesse conversando com o usuário.
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    return `Ops, tive um problema ao analisar os resultados: ${error.message}`;
  }
}

// Função principal do chat (estilo Cursor)
async function chat() {
  console.log("🤖 Olá! Sou seu assistente de terminal inteligente.");
  console.log(
    "Posso ajudar com comandos, tarefas complexas e executar ações diretas."
  );
  console.log('Digite "sair" para encerrar\n');

  // Atualizar contexto inicial
  try {
    const pwdResult = await executarComando("pwd");
    if (pwdResult.success) {
      context.currentDirectory = pwdResult.output.trim();
    }
  } catch (error) {
    // Ignorar erro inicial
  }

  while (true) {
    const mensagem = await new Promise((resolve) => {
      rl.question("👤 Você: ", resolve);
    });

    if (
      mensagem.toLowerCase() === "sair" ||
      mensagem.toLowerCase() === "exit"
    ) {
      console.log("👋 Até logo! Foi um prazer ajudar!");
      rl.close();
      break;
    }

    // Adicionar ao histórico
    conversationHistory.push({ role: "user", content: mensagem });

    // Primeiro, verificar se há ações diretas
    const acoesDiretas = detectarAcoesDiretas(mensagem);

    if (acoesDiretas.length > 0) {
      console.log("\n🤖 Entendi! Vou executar essas ações diretamente:");
      acoesDiretas.forEach((acao, index) => {
        console.log(`   ${index + 1}. ${acao}`);
      });

      await executarComandos(acoesDiretas, mensagem);
    } else {
      // Entender intenção (estilo Cursor)
      console.log("\n🤖 Analisando sua solicitação...");
      const analise = await entenderIntencao(mensagem);

      // Responder inicialmente
      console.log(`\n🤖 ${analise.resposta_inicial}`);

      // Se precisa esclarecimento, fazer perguntas
      if (
        analise.tipo === "precisa_esclarecimento" &&
        analise.perguntas.length > 0
      ) {
        console.log(
          "\n🤔 Preciso de algumas informações para te ajudar melhor:"
        );
        const esclarecimentos = await esclarecerDuvidas(analise.perguntas);

        // Reanalisar com as informações adicionais
        const mensagemCompleta = `${mensagem} - ${Object.entries(
          esclarecimentos
        )
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")}`;
        const novaAnalise = await entenderIntencao(mensagemCompleta);

        if (novaAnalise.comandos.length > 0) {
          console.log(
            `\n🤖 Perfeito! Agora vou executar os comandos necessários.`
          );
          await executarComandos(novaAnalise.comandos, mensagemCompleta);
        }
      } else if (analise.comandos.length > 0) {
        // Executar comandos
        await executarComandos(analise.comandos, mensagem);
      }

      // Mostrar sugestões se houver
      if (analise.sugestoes.length > 0) {
        console.log("\n💡 Sugestões úteis:");
        analise.sugestoes.forEach((sugestao, index) => {
          console.log(`   ${index + 1}. ${sugestao}`);
        });
      }
    }

    console.log("\n" + "─".repeat(50) + "\n");
  }
}

// Função para executar comandos
async function executarComandos(comandos, mensagemOriginal) {
  const resultados = [];

  for (const comando of comandos) {
    console.log(`\n📋 Executando: ${comando}`);

    // Verificar se é perigoso
    const comandosPerigosos = ["rm -rf", "sudo", "chmod 777", "dd if=", "mkfs"];
    const isPerigoso = comandosPerigosos.some((cmd) => comando.includes(cmd));

    if (isPerigoso) {
      const confirmacao = await new Promise((resolve) => {
        rl.question(
          `⚠️  Este comando pode ser perigoso. Continuar? (s/n): `,
          resolve
        );
      });

      if (
        confirmacao.toLowerCase() !== "s" &&
        confirmacao.toLowerCase() !== "sim"
      ) {
        console.log("❌ Comando cancelado.");
        continue;
      }
    }

    // Verificar se é interativo
    if (precisaInteracao(comando)) {
      console.log(`🔄 Comando interativo detectado`);
      const respostasAutomaticas = await gerarRespostasAutomaticas(
        comando,
        mensagemOriginal
      );

      if (respostasAutomaticas[0] === "ASK_USER") {
        const confirmacao = await new Promise((resolve) => {
          rl.question(
            `❓ Este comando pode pedir confirmação. Continuar? (s/n): `,
            resolve
          );
        });

        if (
          confirmacao.toLowerCase() !== "s" &&
          confirmacao.toLowerCase() !== "sim"
        ) {
          console.log("❌ Comando cancelado.");
          continue;
        }
      }

      const resultado = await executarComandoInterativo(
        comando,
        respostasAutomaticas
      );
      resultados.push(resultado);
    } else {
      const resultado = await executarComando(comando);
      resultados.push(resultado);
    }

    // Atualizar contexto
    context.lastCommands.push(comando);
    if (context.lastCommands.length > 10) {
      context.lastCommands.shift();
    }
  }

  // Analisar resultados
  if (resultados.length > 0) {
    console.log("\n🤖 Analisando resultados...");
    const analise = await analisarResultados(
      mensagemOriginal,
      comandos,
      resultados
    );
    console.log(`\n🤖 ${analise}`);
    conversationHistory.push({ role: "assistant", content: analise });
  }
}

// Função para mostrar ajuda
function mostrarAjuda() {
  console.log(`
🤖 COMO USAR O ASSISTENTE (ESTILO CURSOR):

Sou um assistente conversacional que entende contexto e faz perguntas quando necessário!

EXEMPLOS DE USO:

1. Comandos diretos:
   👤 Você: "ls -la"
   👤 Você: "pwd"
   👤 Você: "whoami"

2. Tarefas complexas:
   👤 Você: "quero organizar meus arquivos"
   🤖 Eu: "Claro! Que tipo de arquivos você quer organizar? Por data, tipo, tamanho?"

3. Perguntas e dúvidas:
   👤 Você: "como instalar node.js?"
   🤖 Eu: "Vou te ajudar! Qual sistema você está usando? Linux, macOS, Windows?"

4. Tarefas com contexto:
   👤 Você: "fazer backup"
   🤖 Eu: "Que arquivos você quer fazer backup? Todos ou específicos?"

5. Sugestões proativas:
   👤 Você: "estou com problemas de disco"
   🤖 Eu: "Vou verificar o uso de disco e sugerir limpeza se necessário!"

6. Comandos especiais:
   - "sair" ou "exit": Encerra o programa
   - "ajuda": Mostra esta ajuda
   - "historico": Mostra histórico de comandos

🔄 COMPORTAMENTO:
- Faço perguntas quando preciso de mais informações
- Entendo contexto e histórico
- Sugiro coisas úteis proativamente
- Explico o que estou fazendo
- Trato você como um amigo, não como um terminal!

⚠️  ATENÇÃO:
- Comandos perigosos pedirão confirmação
- Posso fazer perguntas para esclarecer melhor
- Sempre explico o que estou fazendo
`);
}

// Função para mostrar histórico
function mostrarHistorico() {
  console.log("\n📜 HISTÓRICO DA CONVERSA:");
  conversationHistory.forEach((item, index) => {
    const role = item.role === "user" ? "👤 Você" : "🤖 Eu";
    console.log(
      `${index + 1}. ${role}: ${item.content.substring(0, 100)}${
        item.content.length > 100 ? "..." : ""
      }`
    );
  });
}

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  mostrarAjuda();
  process.exit(0);
}

// Iniciar o chat
console.log("🚀 Iniciando assistente de terminal inteligente...\n");
chat().catch(console.error);
