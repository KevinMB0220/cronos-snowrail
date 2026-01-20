'use client';

import { useChat } from '@/hooks/use-chat';
import { useNotifications } from '@/hooks/use-notifications';
import { useWebSocket } from '@/hooks/use-websocket';
import { useState, useEffect, useRef, useCallback } from 'react';
import { TransactionModal } from '@/components/transaction-modal';
import { ToastContainer } from '@/components/toast-notification';
import type { Notification } from '@cronos-x402/shared-types';

// Component to render copyable command blocks
function CopyableCommand({ command, onExecute }: { command: string; onExecute?: (cmd: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="my-2 flex items-center gap-2 p-2 rounded-lg bg-obsidian-900/80 border border-electric-500/30 group">
      <code className="flex-1 text-sm font-mono text-electric-300 px-2">{command}</code>
      <div className="flex items-center gap-1">
        {onExecute && (
          <button
            onClick={() => onExecute(command)}
            className="p-1.5 rounded-md bg-electric-500/20 hover:bg-electric-500/30 text-electric-300 hover:text-electric-200 transition-all duration-200"
            title="Run command"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all duration-200"
          title={copied ? 'Copied!' : 'Copy command'}
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// Component to render copyable field (like Commitment, Nullifier, Secret)
function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Determine color based on field type
  const isWarning = label === 'Secret' || label === 'Nullifier';
  const borderColor = isWarning ? 'border-orange-500/40' : 'border-purple-500/40';
  const bgColor = isWarning ? 'bg-orange-500/10' : 'bg-purple-500/10';
  const labelColor = isWarning ? 'text-orange-300' : 'text-purple-300';
  const valueColor = isWarning ? 'text-orange-200' : 'text-purple-200';

  return (
    <div className={`my-1 flex items-center gap-2 p-2 rounded-lg ${bgColor} border ${borderColor}`}>
      <span className={`text-xs font-semibold ${labelColor} min-w-[85px]`}>{label}:</span>
      <code className={`flex-1 text-xs font-mono ${valueColor} truncate`} title={value}>
        {value.slice(0, 20)}...{value.slice(-10)}
      </code>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all duration-200 flex-shrink-0"
        title={copied ? 'Copied!' : `Copy ${label}`}
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// Function to parse message content and extract commands and copyable fields
function parseMessageWithCommands(content: string, onExecute?: (cmd: string) => void) {
  // Combined regex to match commands AND copyable fields (Commitment, Nullifier, Secret, Contract, Intent, Batch)
  const combinedRegex = /(?:Command:\s*|Type\s+)?(\/(?:deposit|pay|withdraw|mix|wallet|status|history|help|cancel|bulk|balance)(?:\s+[^\n]+)?)|(?:(Commitment|Nullifier|Secret|Contract|Intent|Batch):\s*(0x[a-fA-F0-9]+|[a-f0-9-]{36}|batch-[a-z0-9-]+))/gi;

  const parts: (string | { type: 'command'; value: string } | { type: 'field'; label: string; value: string })[] = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(content)) !== null) {
    const fullMatchStart = match.index;

    // Add text before the match
    if (fullMatchStart > lastIndex) {
      parts.push(content.slice(lastIndex, fullMatchStart));
    }

    if (match[1]) {
      // It's a command
      parts.push({ type: 'command', value: match[1].trim() });
    } else if (match[2] && match[3]) {
      // It's a copyable field (Commitment, Nullifier, Secret, Contract, Intent)
      parts.push({ type: 'field', label: match[2], value: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  // If nothing found, return original content
  if (parts.length === 0) {
    return <span>{content}</span>;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        }
        if (part.type === 'command') {
          return <CopyableCommand key={index} command={part.value} onExecute={onExecute} />;
        }
        if (part.type === 'field') {
          return <CopyableField key={index} label={part.label} value={part.value} />;
        }
        return null;
      })}
    </>
  );
}

export default function ChatPage() {
  const { messages, sendMessage, isSending } = useChat();
  const { notifications, unreadCount, markAsRead, dismissNotification } = useNotifications();
  const { isConnected, isAuthenticated } = useWebSocket();
  const [input, setInput] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    transaction: any;
  }>({ isOpen: false, transaction: null });
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle notifications - show as toasts and check for transaction requests
  useEffect(() => {
    if (notifications.length === 0) return;

    // Get the latest notification
    const latestNotification = notifications[notifications.length - 1];

    // Add to toast notifications
    if (!latestNotification.read) {
      setToastNotifications((prev) => [...prev, latestNotification]);
    }

    // Check if it's a transaction request - deposit or withdrawal
    if (latestNotification.data?.depositInfo) {
      // Extract transaction details for deposit/mix
      const depositInfo = latestNotification.data.depositInfo;
      const isMixer = latestNotification.type.toString().includes('mixer') || latestNotification.data?.note;

      setTransactionModal({
        isOpen: true,
        transaction: {
          type: isMixer ? 'mix' : 'deposit',
          contractAddress: depositInfo.contract,
          amount: depositInfo.amount,
          params: depositInfo.params,
          intentId: latestNotification.data.intentId,
        },
      });
    } else if (latestNotification.data?.withdrawInfo) {
      // Extract transaction details for mixer withdrawal
      const withdrawInfo = latestNotification.data.withdrawInfo;

      setTransactionModal({
        isOpen: true,
        transaction: {
          type: 'withdraw',
          contractAddress: withdrawInfo.contract,
          amount: '0.1', // Mixer denomination
          params: withdrawInfo.params,
        },
      });
    }
  }, [notifications]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const message = input;
    setInput('');
    await sendMessage(message);
    inputRef.current?.focus();
  };

  const handleQuickCommand = async (command: string) => {
    if (isSending) return;
    await sendMessage(command);
  };

  const quickCommands = [
    { label: '📋 Help', command: '/help', color: 'electric' },
    { label: '👛 Wallet', command: '/wallet', color: 'accent' },
    { label: '📊 Status', command: '/status', color: 'electric' },
    { label: '📜 History', command: '/history', color: 'accent' },
    { label: '❌ Cancel', command: '/cancel', color: 'electric' },
    { label: '📦 Bulk', command: '/bulk', color: 'accent' },
  ];

  return (
    <div className="h-screen bg-obsidian-900 relative overflow-hidden flex flex-col">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_80%)]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-electric-500/10 rounded-full blur-[120px] animate-pulse-subtle" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-[120px] animate-pulse-subtle" />

      {/* Header */}
      <header className="relative z-20 border-b border-white/[0.05] bg-obsidian-800/60 backdrop-blur-xl flex-shrink-0">
        <div className="w-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-electric-500/10 border border-electric-500/20">
                <svg className="w-6 h-6 text-electric-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-white">Payment Chat</h1>
                <p className="text-xs text-slate-500">Cronos X402 Treasury Protocol</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'} animate-pulse-subtle`} />
                  <span className="text-xs font-medium text-slate-400">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {isAuthenticated && (
                  <>
                    <div className="w-px h-4 bg-white/[0.1]" />
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span className="text-xs text-green-400">Verified</span>
                    </div>
                  </>
                )}
              </div>

              {/* Notifications Bell */}
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-glow-accent">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 w-full px-4 md:px-6 py-3 min-h-0">
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 w-full h-full">
          {/* Chat Area - 85% on desktop */}
          <div className="w-full lg:w-[85%] animate-fade-in h-full min-h-0">
            <div className="rounded-2xl bg-obsidian-800/40 border border-white/[0.05] backdrop-blur-sm overflow-hidden flex flex-col h-full shadow-glass">
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-electric-500 to-accent-500 flex items-center justify-center">
                      <span className="text-lg">🤖</span>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">Treasury Agent</h2>
                      <p className="text-xs text-slate-500">AI-powered payment assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{messages.length} messages</span>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
                    <div className="w-20 h-20 rounded-2xl bg-electric-500/10 border border-electric-500/20 flex items-center justify-center mb-6">
                      <span className="text-4xl">👋</span>
                    </div>
                    <h3 className="text-xl font-display font-bold text-white mb-2">Welcome to Payment Chat</h3>
                    <p className="text-slate-400 max-w-md mb-6">
                      Use natural language or commands to manage your treasury. Type{' '}
                      <code className="px-2 py-0.5 rounded bg-electric-500/20 text-electric-300 text-sm">/help</code>{' '}
                      to see all available commands.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {quickCommands.map((cmd) => (
                        <button
                          key={cmd.command}
                          onClick={() => handleQuickCommand(cmd.command)}
                          disabled={isSending}
                          className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-slate-300 text-sm hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300 disabled:opacity-50"
                        >
                          {cmd.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => {
                  // Check if this message contains deposit/transaction info
                  // sender is 'system' for agent responses, not 'agent'
                  const isDepositMessage = msg.sender === 'system' && (
                    msg.content.includes('Deposit Transaction Ready') ||
                    msg.content.includes('📥 Deposit Transaction Ready')
                  );

                  // Check if this message is a mixer deposit
                  const isMixerMessage = msg.sender === 'system' && (
                    msg.content.includes('Privacy Mixer Deposit') ||
                    msg.content.includes('🎭 Privacy Mixer Deposit')
                  );

                  // Check if this message is a mixer withdrawal
                  const isMixerWithdrawMessage = msg.sender === 'system' && (
                    msg.content.includes('Privacy Mixer Withdrawal') ||
                    msg.content.includes('🎭 Privacy Mixer Withdrawal')
                  );

                  // Extract transaction info from message if it's a deposit message
                  const extractTransactionInfo = () => {
                    if (isMixerWithdrawMessage) {
                      // Parse mixer withdrawal info from the API response data
                      // The backend sends withdrawInfo in the response data
                      const amountMatch = msg.content.match(/Amount:\s*([\d.]+)\s*(\w+)/i);
                      const contractMatch = msg.content.match(/Contract:\s*(0x[a-fA-F0-9]+)/i);
                      const recipientMatch = msg.content.match(/Recipient:\s*(0x[a-fA-F0-9]+)/i);

                      // For withdraw, we need to parse the proof data from the message metadata
                      // The backend stores this in msg.metadata or we parse it from notification
                      if (amountMatch && contractMatch) {
                        return {
                          type: 'withdraw' as const,
                          amount: amountMatch[1],
                          currency: amountMatch[2] || 'CRO',
                          contractAddress: contractMatch[1],
                          recipient: recipientMatch?.[1] || '',
                        };
                      }
                      return null;
                    }

                    if (isMixerMessage) {
                      // Parse mixer deposit info
                      const amountMatch = msg.content.match(/Amount:\s*([\d.]+)\s*(\w+)/i);
                      const contractMatch = msg.content.match(/Contract:\s*(0x[a-fA-F0-9]+)/i);
                      const commitmentMatch = msg.content.match(/Commitment:\s*(0x[a-fA-F0-9]+)/i);

                      if (amountMatch && commitmentMatch) {
                        return {
                          type: 'mix' as const,
                          amount: amountMatch[1],
                          currency: amountMatch[2] || 'CRO',
                          contractAddress: contractMatch?.[1] || '0xfAef6b16831d961CBd52559742eC269835FF95FF',
                          commitment: commitmentMatch[1],
                        };
                      }
                      return null;
                    }

                    if (!isDepositMessage) return null;

                    // Parse intent ID from message
                    const intentIdMatch = msg.content.match(/Intent:\s*([a-f0-9-]+)/i);
                    const amountMatch = msg.content.match(/Amount:\s*([\d.]+)\s*(\w+)/i);
                    const contractMatch = msg.content.match(/Contract:\s*(0x[a-fA-F0-9]+)/i);
                    const recipientMatch = msg.content.match(/Recipient:\s*(0x[a-fA-F0-9]+)/i);

                    if (intentIdMatch && amountMatch) {
                      return {
                        type: 'deposit' as const,
                        intentId: intentIdMatch[1],
                        amount: amountMatch[1],
                        currency: amountMatch[2] || 'CRO',
                        contractAddress: contractMatch?.[1] || '0xae6E14caD8D4f43947401fce0E4717b8D17b4382',
                        recipient: recipientMatch?.[1] || '',
                      };
                    }
                    return null;
                  };

                  const txInfo = extractTransactionInfo();

                  return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                        msg.sender === 'user'
                          ? 'bg-electric-500/20 border border-electric-500/30'
                          : 'bg-accent-500/20 border border-accent-500/30'
                      }`}>
                        <span className="text-sm">{msg.sender === 'user' ? '👤' : '🤖'}</span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 max-w-full overflow-hidden ${
                          msg.sender === 'user'
                            ? 'bg-electric-600 text-white rounded-br-sm'
                            : 'bg-white/[0.05] border border-white/[0.08] text-slate-200 rounded-bl-sm'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words break-all text-sm leading-relaxed font-mono overflow-x-hidden">
                          {msg.sender === 'system'
                            ? parseMessageWithCommands(msg.content, handleQuickCommand)
                            : msg.content
                          }
                        </div>

                        {/* Sign Transaction Button for deposit messages */}
                        {isDepositMessage && txInfo && txInfo.type === 'deposit' && (
                          <button
                            onClick={() => {
                              // Convert intentId to bytes32 format
                              const intentIdHex = '0x' + txInfo.intentId!.replace(/-/g, '').padEnd(64, '0');

                              setTransactionModal({
                                isOpen: true,
                                transaction: {
                                  type: 'deposit',
                                  contractAddress: txInfo.contractAddress,
                                  amount: txInfo.amount,
                                  params: {
                                    intentId: intentIdHex,
                                    recipient: txInfo.recipient,
                                  },
                                  intentId: txInfo.intentId,
                                },
                              });
                            }}
                            className="mt-3 w-full px-4 py-2.5 bg-gradient-to-r from-electric-600 to-accent-600 text-white text-sm font-semibold rounded-xl hover:from-electric-500 hover:to-accent-500 transition-all duration-300 shadow-glow-sm hover:shadow-glow-md flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            Sign Transaction
                          </button>
                        )}

                        {/* Sign Transaction Button for mixer deposit messages */}
                        {isMixerMessage && txInfo && txInfo.type === 'mix' && (
                          <button
                            onClick={() => {
                              setTransactionModal({
                                isOpen: true,
                                transaction: {
                                  type: 'mix',
                                  contractAddress: txInfo.contractAddress,
                                  amount: txInfo.amount,
                                  params: {
                                    commitment: txInfo.commitment,
                                  },
                                },
                              });
                            }}
                            className="mt-3 w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all duration-300 shadow-glow-sm hover:shadow-glow-md flex items-center justify-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            🎭 Sign Mixer Deposit
                          </button>
                        )}

                        {/* Sign Transaction Button for mixer withdrawal messages */}
                        {isMixerWithdrawMessage && txInfo && txInfo.type === 'withdraw' && (() => {
                          // Find the withdraw notification to get proof params
                          const withdrawNotification = notifications.find(
                            n => n.type === 'mixer_withdraw_ready' && !n.read
                          );
                          const withdrawData = withdrawNotification?.data as any;
                          const withdrawInfo = withdrawData?.withdrawInfo;

                          if (!withdrawInfo?.params) return null;

                          return (
                            <button
                              onClick={() => {
                                setTransactionModal({
                                  isOpen: true,
                                  transaction: {
                                    type: 'withdraw',
                                    contractAddress: withdrawInfo.contract,
                                    amount: txInfo.amount,
                                    params: {
                                      proof: withdrawInfo.params.proof,
                                      root: withdrawInfo.params.root,
                                      nullifierHash: withdrawInfo.params.nullifierHash,
                                      recipient: withdrawInfo.params.recipient,
                                      relayer: withdrawInfo.params.relayer,
                                      fee: withdrawInfo.params.fee,
                                    },
                                  },
                                });
                                // Mark notification as read
                                if (withdrawNotification) {
                                  markAsRead(withdrawNotification.id);
                                }
                              }}
                              className="mt-3 w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-green-500 hover:to-teal-500 transition-all duration-300 shadow-glow-sm hover:shadow-glow-md flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                              📤 Sign Mixer Withdrawal
                            </button>
                          );
                        })()}

                        <div className={`text-[10px] mt-2 ${
                          msg.sender === 'user' ? 'text-electric-200' : 'text-slate-500'
                        }`}>
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })}

                {/* Typing Indicator */}
                {isSending && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="flex items-end gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent-500/20 border border-accent-500/30 flex items-center justify-center">
                        <span className="text-sm">🤖</span>
                      </div>
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-white/[0.05] border border-white/[0.08]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-electric-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-electric-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-electric-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-white/[0.05] p-4 bg-white/[0.02]">
                {/* Quick Commands */}
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                  {quickCommands.map((cmd) => (
                    <button
                      key={cmd.command}
                      onClick={() => handleQuickCommand(cmd.command)}
                      disabled={isSending}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                        cmd.color === 'electric'
                          ? 'bg-electric-500/10 text-electric-300 border border-electric-500/20 hover:bg-electric-500/20'
                          : 'bg-accent-500/10 text-accent-300 border border-accent-500/20 hover:bg-accent-500/20'
                      }`}
                    >
                      {cmd.label}
                    </button>
                  ))}
                </div>

                {/* Input Field */}
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder={isConnected ? "Type a command or message..." : "Connecting..."}
                      disabled={isSending || !isConnected}
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-slate-500 focus:outline-none focus:border-electric-500/50 focus:ring-1 focus:ring-electric-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {isSending && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-electric-500/30 border-t-electric-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !isConnected || !input.trim()}
                    className="px-5 py-3 rounded-xl bg-electric-600 text-white font-medium hover:bg-electric-500 disabled:bg-white/[0.05] disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 shadow-glow-sm hover:shadow-glow-md disabled:shadow-none"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - 15% on desktop */}
          <div className="hidden lg:flex lg:w-[15%] flex-col gap-3 h-full min-h-0">
            {/* Status Card */}
            <div className="rounded-xl bg-obsidian-800/40 border border-white/[0.05] backdrop-blur-sm p-3 shadow-glass flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1 rounded-md bg-green-500/10">
                  <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-white">Status</h3>
              </div>
              <div className="space-y-1">
                <StatusRow label="WS" status={isConnected} activeText="OK" inactiveText="Off" />
                <StatusRow label="Auth" status={isAuthenticated} activeText="OK" inactiveText="..." />
              </div>
            </div>

            {/* Quick Commands Card */}
            <div className="rounded-xl bg-obsidian-800/40 border border-white/[0.05] backdrop-blur-sm p-3 shadow-glass flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <div className="p-1 rounded-md bg-electric-500/10">
                  <svg className="w-3 h-3 text-electric-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-white">Commands</h3>
              </div>
              <div className="space-y-0.5 flex-1 min-h-0">
                <CommandRow cmd="/help" desc="Help" icon="📋" />
                <CommandRow cmd="/wallet" desc="Balance" icon="👛" />
                <CommandRow cmd="/pay" desc="Pay" icon="💸" />
                <CommandRow cmd="/deposit" desc="Deposit" icon="📥" />
                <CommandRow cmd="/mix" desc="Mix" icon="🎭" />
                <CommandRow cmd="/withdraw" desc="Withdraw" icon="📤" />
                <CommandRow cmd="/cancel" desc="Cancel" icon="❌" />
                <CommandRow cmd="/bulk" desc="Bulk" icon="📦" />
                <CommandRow cmd="/status" desc="Status" icon="📊" />
                <CommandRow cmd="/history" desc="History" icon="📜" />
              </div>
            </div>
          </div>

          {/* Notifications Panel - Floating */}
          {showNotifications && (
            <div className="fixed top-24 right-6 w-80 z-50 rounded-2xl bg-obsidian-800/95 border border-white/[0.1] backdrop-blur-md p-5 shadow-2xl animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Notifications</h3>
                </div>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-accent-500/20 text-accent-300 text-xs font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No notifications yet</p>
                ) : (
                  notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => !notif.read && markAsRead(notif.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-all duration-300 ${
                        notif.read
                          ? 'bg-white/[0.02]'
                          : 'bg-electric-500/10 border border-electric-500/20'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0">{notif.icon || '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{notif.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
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

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={transactionModal.isOpen}
        transaction={transactionModal.transaction}
        onClose={() => setTransactionModal({ isOpen: false, transaction: null })}
      />

      {/* Toast Notifications */}
      <ToastContainer
        notifications={toastNotifications}
        onDismiss={(id) => {
          setToastNotifications((prev) => prev.filter((n) => n.id !== id));
          markAsRead(id);
        }}
      />
    </div>
  );
}

function StatusRow({
  label,
  status,
  activeText,
  inactiveText
}: {
  label: string;
  status: boolean;
  activeText: string;
  inactiveText: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.03] last:border-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <div className="flex items-center gap-1">
        <div className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-green-400' : 'bg-yellow-400'}`} />
        <span className={`text-[10px] font-medium ${status ? 'text-green-400' : 'text-yellow-400'}`}>
          {status ? activeText : inactiveText}
        </span>
      </div>
    </div>
  );
}

function CommandRow({ cmd, desc, icon }: { cmd: string; desc: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-white/[0.03] transition-colors cursor-default">
      <span className="text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <code className="text-[10px] font-mono text-electric-300">{cmd}</code>
        <p className="text-[9px] text-slate-500 truncate">{desc}</p>
      </div>
    </div>
  );
}
