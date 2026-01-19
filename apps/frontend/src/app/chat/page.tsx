'use client';

import { useChat } from '@/hooks/use-chat';
import { useNotifications } from '@/hooks/use-notifications';
import { useWebSocket } from '@/hooks/use-websocket';
import { useState, useEffect, useRef } from 'react';

export default function ChatPage() {
  const { messages, sendMessage, isSending } = useChat();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const { isConnected, isAuthenticated } = useWebSocket();
  const [input, setInput] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    await sendMessage(input);
    setInput('');
  };

  const quickCommands = [
    { label: 'Help', command: '/help' },
    { label: 'Wallet', command: '/wallet' },
    { label: 'Status', command: '/status' },
    { label: 'History', command: '/history' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💬 Chat de Pagos</h1>
            <p className="text-sm text-gray-500">Cronos Snow Rail</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            {/* Notifications Bell */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-full"
            >
              <span className="text-2xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[600px]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-20">
                    <p className="text-lg mb-2">👋 ¡Bienvenido!</p>
                    <p className="text-sm">Escribe /help para ver los comandos disponibles</p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-lg px-4 py-2 ${
                        msg.sender === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2 mb-2">
                  {quickCommands.map((cmd) => (
                    <button
                      key={cmd.command}
                      onClick={() => sendMessage(cmd.command)}
                      disabled={isSending}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full disabled:opacity-50"
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Escribe un comando (ej: /help, /pay, /wallet)"
                    disabled={isSending || !isConnected}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isSending || !isConnected || !input.trim()}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSending ? '...' : '📤'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Connection Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold mb-3">Estado</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">WebSocket</span>
                  <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                    {isConnected ? '✅ Conectado' : '❌ Desconectado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Autenticado</span>
                  <span className={isAuthenticated ? 'text-green-600' : 'text-yellow-600'}>
                    {isAuthenticated ? '✅ Sí' : '⏳ Pendiente'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Mensajes</span>
                  <span className="text-blue-600">{messages.length}</span>
                </div>
              </div>
            </div>

            {/* Commands Help */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold mb-3">Comandos Disponibles</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/pay</code>
                  <p className="text-gray-600 mt-1">Enviar pago</p>
                </div>
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/deposit</code>
                  <p className="text-gray-600 mt-1">Depositar fondos</p>
                </div>
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/withdraw</code>
                  <p className="text-gray-600 mt-1">Retirar fondos</p>
                </div>
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/wallet</code>
                  <p className="text-gray-600 mt-1">Ver wallet</p>
                </div>
                <div>
                  <code className="bg-gray-100 px-2 py-1 rounded">/help</code>
                  <p className="text-gray-600 mt-1">Ver ayuda completa</p>
                </div>
              </div>
            </div>

            {/* Notifications */}
            {showNotifications && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">
                  Notificaciones ({unreadCount})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No hay notificaciones
                    </p>
                  ) : (
                    notifications.slice(0, 10).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => !notif.read && markAsRead(notif.id)}
                        className={`p-3 rounded cursor-pointer ${
                          notif.read ? 'bg-gray-50' : 'bg-blue-50 border border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{notif.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {notif.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Example Commands */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Ejemplos de Comandos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <button
              onClick={() => sendMessage('/pay 0x742d35Cc6634C0532925a3b844Bc9e7595f39dF4 100 CRO')}
              className="text-left bg-white hover:bg-blue-100 p-2 rounded border border-blue-300"
            >
              <code className="text-blue-700">/pay 0x742d...3dF4 100 CRO</code>
            </button>
            <button
              onClick={() => sendMessage('/deposit intent-123 100')}
              className="text-left bg-white hover:bg-blue-100 p-2 rounded border border-blue-300"
            >
              <code className="text-blue-700">/deposit intent-123 100</code>
            </button>
            <button
              onClick={() => sendMessage('/mix 0.1')}
              className="text-left bg-white hover:bg-blue-100 p-2 rounded border border-blue-300"
            >
              <code className="text-blue-700">/mix 0.1</code>
            </button>
            <button
              onClick={() => sendMessage('/status')}
              className="text-left bg-white hover:bg-blue-100 p-2 rounded border border-blue-300"
            >
              <code className="text-blue-700">/status</code>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
