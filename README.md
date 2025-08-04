# Agente de Terminal com IA

Este projeto é um assistente de IA para seu terminal, inspirado em ferramentas como o [Cursor](https://cursor.sh/) e o [Jules](https://jules.ai/). Ele permite que você interaja com seu sistema operacional usando linguagem natural através de uma interface de chat baseada na web.

O agente utiliza a API do Google Gemini para interpretar suas solicitações e traduzi-las em comandos shell, que são executados no servidor. A comunicação entre o frontend e o backend é feita em tempo real usando WebSockets.

## Funcionalidades

- **Interface de Chat Web:** Uma interface limpa e reativa para conversar com o agente.
- **Processamento de Linguagem Natural:** Envie tarefas complexas em português (ex: "crie uma pasta para meu projeto, inicie um repositório git e instale o express").
- **Execução de Comandos:** O agente executa os comandos gerados diretamente no shell do servidor.
- **Comunicação em Tempo Real:** A saída dos comandos é transmitida para o frontend em tempo real.
- **Seguro:** A chave de API não fica no código, mas sim em um arquivo `.env` local.

## Tecnologias Utilizadas

- **Backend:** Node.js, Express, WebSocket (`ws`)
- **IA:** Google Gemini API (`@google/generative-ai`)
- **Frontend:** HTML5, CSS3, JavaScript (sem frameworks)
- **Segurança:** `dotenv` para gerenciamento de variáveis de ambiente.

## Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- Uma chave de API do [Google AI Studio](https://aistudio.google.com/)

## Instalação e Configuração

Siga os passos abaixo para configurar e executar o projeto em sua máquina local.

**1. Clone o Repositório**
```bash
git clone <URL_DO_REPOSITORIO>
cd agente-terminal-ia
```
(Se você não estiver usando git, apenas baixe e descompacte os arquivos em uma pasta).

**2. Instale as Dependências**
Execute o comando abaixo na raiz do projeto para instalar os pacotes necessários.
```bash
npm install
```

**3. Configure a Chave de API**
O projeto precisa da sua chave de API do Google para funcionar.

- Renomeie o arquivo `.env.example` para `.env`.
- Abra o arquivo `.env` e cole sua chave de API no lugar de `SUA_CHAVE_DE_API_AQUI`.

`.env`:
```
GOOGLE_API_KEY="aqui-vai-sua-chave-secreta-do-google-ai"
```

## Como Executar

Após a instalação, inicie o servidor com o seguinte comando:
```bash
npm start
```
Você verá uma mensagem no terminal confirmando que o servidor está rodando:
```
🚀 Servidor rodando em http://localhost:3000
```

## Como Usar

1. Abra seu navegador e acesse [http://localhost:3000](http://localhost:3000).
2. A interface de chat será carregada, e o indicador de status deve ficar verde, mostrando que está conectado.
3. Digite uma solicitação na caixa de texto e pressione Enter ou clique em "Enviar".
4. Observe o agente processar sua solicitação, mostrar os comandos que está executando e exibir a saída em tempo real.

**Exemplos de Comandos para Testar:**

- `liste todos os arquivos e pastas com detalhes`
- `crie um diretório chamado "meu-teste" e depois entre nele`
- `qual o meu diretório de trabalho atual?`
- `crie um projeto node simples e instale o express e o nodemon`
