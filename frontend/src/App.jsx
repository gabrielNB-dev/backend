import React, { useState } from "react";
import "./App.css";

// Componente para exibir a lista de mensagens
const MessageList = ({ messages }) => (
  <div className="flex-1 p-4 overflow-y-auto">
    {messages.map((msg, index) => (
      <div
        key={index}
        className={`my-2 p-3 rounded-lg max-w-lg ${
          msg.sender === "user"
            ? "bg-blue-600 text-white self-end ml-auto"
            : "bg-gray-200 text-gray-800 self-start mr-auto"
        }`}
      >
        {msg.text}
      </div>
    ))}
  </div>
);

// Componente para a entrada de mensagem do usuário
const MessageInput = ({ onSend }) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
      <div className="flex">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="flex-1 p-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700 transition"
        >
          Enviar
        </button>
      </div>
    </form>
  );
};

// Componente para a entrada de contexto (história)
const ContextInput = ({ onContextChange }) => {
  return (
    <div className="p-4 bg-gray-50 border-b">
      <textarea
        onChange={(e) => onContextChange(e.target.value)}
        placeholder="Cole a história aqui para análise..."
        className="w-full h-32 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState("");

  const handleSend = async (message) => {
    const userMessage = { sender: "user", text: message };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    try {
      const response = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, context }),
      });

      if (!response.ok) {
        throw new Error("A resposta da rede não foi ok");
      }

      const data = await response.json();
      const botMessage = { sender: "bot", text: data.reply };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error("Falha ao buscar:", error);
      const errorMessage = {
        sender: "bot",
        text: "Desculpe, não consegui me conectar ao servidor.",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 text-center">
        <h1 className="text-2xl font-bold">Chat com IA - Análise de Histórias</h1>
      </header>
      <div className="flex flex-col md:flex-row flex-1">
        <div className="w-full md:w-1/3 border-r">
          <ContextInput onContextChange={setContext} />
        </div>
        <div className="w-full md:w-2/3 flex flex-col">
          <MessageList messages={messages} />
          <MessageInput onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
