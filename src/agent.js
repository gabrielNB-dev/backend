import { GoogleGenerativeAI } from "@google/generative-ai";

// Carrega a chave de API da variável de ambiente
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// O contexto é gerenciado aqui para ser usado nos prompts.
const context = {
  currentDirectory: process.cwd(),
  commandHistory: [],
};

/**
 * Usa o LLM para analisar a mensagem do usuário e gerar comandos shell.
 * @param {string} userInput - A mensagem do usuário.
 * @returns {Promise<string[]>} Uma lista de comandos para executar.
 */
async function generateCommands(userInput) {
  const prompt = `
Você é um assistente de terminal especialista em gerar comandos shell a partir de linguagem natural.

Contexto Atual:
- Diretório de trabalho: ${context.currentDirectory}
- Histórico de comandos recentes: ${context.commandHistory.slice(-5).join("\n")}

Tarefa:
Analise a solicitação do usuário e gere uma lista de comandos shell para realizar a tarefa.
Responda APENAS com um array JSON de strings, onde cada string é um comando a ser executado em sequência.
Não adicione nenhuma explicação, apenas o array JSON.

Exemplos:
- Usuário: "liste os arquivos aqui"
  Resposta: ["ls -la"]
- Usuário: "crie uma pasta chamada 'testes' e entre nela"
  Resposta: ["mkdir -p 'testes'", "cd 'testes'"]
- Usuário: "instale o express"
  Resposta: ["npm install express"]
- Usuário: "crie um projeto react com vite chamado meu-app"
  Resposta: ["npm create vite@latest meu-app -- --template react"]

Solicitação do Usuário: "${userInput}"

Array de Comandos JSON:
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const commands = JSON.parse(jsonMatch[0]);
      context.commandHistory.push(...commands.filter(cmd => !cmd.startsWith('cd '))); // Não adiciona 'cd' ao histórico de comandos
      return commands;
    }
    console.error("A resposta do LLM não foi um JSON válido:", responseText);
    return [];
  } catch (error) {
    console.error("Erro ao gerar comandos com a IA:", error);
    return [];
  }
}

/**
 * Atualiza o diretório atual no contexto do agente para que o próximo prompt o utilize.
 * @param {string} newDir - O novo diretório de trabalho absoluto.
 */
function updateCurrentDirectory(newDir) {
    context.currentDirectory = newDir;
    console.log(`Contexto do agente atualizado para o diretório: ${newDir}`);
}

export { generateCommands, updateCurrentDirectory };
