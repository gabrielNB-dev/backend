document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const statusIndicator = document.getElementById('status-indicator');

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}`;

    let ws;

    function connect() {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Conectado ao servidor WebSocket');
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            statusIndicator.title = 'Conectado';
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            addMessage(data.type, data.message);
        };

        ws.onclose = () => {
            console.log('Desconectado do servidor WebSocket. Tentando reconectar...');
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusIndicator.title = 'Desconectado. Tentando reconectar...';
            setTimeout(connect, 3000); // Tenta reconectar a cada 3 segundos
        };

        ws.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            ws.close();
        };
    }

    function addMessage(type, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        switch (type) {
            case 'user':
                messageElement.classList.add('user');
                messageElement.textContent = content;
                break;
            case 'status':
                messageElement.classList.add('agent', 'status');
                messageElement.textContent = content;
                break;
            case 'command':
                messageElement.classList.add('agent', 'command');
                messageElement.textContent = content;
                break;
            case 'output':
                messageElement.classList.add('agent', 'output');
                messageElement.textContent = content;
                break;
            case 'error':
                messageElement.classList.add('agent', 'error');
                messageElement.textContent = content;
                break;
            default:
                messageElement.classList.add('agent');
                messageElement.textContent = content;
        }

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const message = messageInput.value;
        if (message.trim() && ws.readyState === WebSocket.OPEN) {
            ws.send(message);
            messageInput.value = '';
        }
    });

    // Inicia a conexão
    connect();
});
