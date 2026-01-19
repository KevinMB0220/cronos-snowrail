import type { FastifyInstance } from 'fastify';
import type {
  ChatMessage,
  SendMessageResponse,
  GetChatHistoryRequest,
  GetChatHistoryResponse,
  WSEventType,
} from '@cronos-x402/shared-types';
import { getPrismaService } from './prisma-service';
import { parseCommand, validateCommand } from './command-parser';
import { emitToUser } from './websocket-service';
import { executeCommand } from './command-executor';

let serverInstance: FastifyInstance | null = null;

/**
 * Initialize Chat service
 */
export function initializeChatService(server: FastifyInstance): void {
  serverInstance = server;
  server.log.info('[ChatService] Initialized');
}

/**
 * Send a chat message
 */
export async function sendMessage(
  userId: string,
  content: string
): Promise<SendMessageResponse> {
  const prisma = getPrismaService();

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { address: userId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        address: userId,
      },
    });
    serverInstance?.log.info({ userId }, '[ChatService] Created new user');
  }

  // Parse command
  const commandParams = parseCommand(content);
  const command = commandParams?.command;

  // Create user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      userId: user.id,
      content,
      command: command || undefined,
      metadata: commandParams ? { args: commandParams.args } : undefined,
    },
  });

  const userChatMessage: ChatMessage = {
    id: userMessage.id,
    userId: user.id,
    content: userMessage.content,
    command: userMessage.command || undefined,
    metadata: userMessage.metadata as Record<string, any> | undefined,
    createdAt: userMessage.createdAt.toISOString(),
    sender: 'user',
  };

  // Broadcast to user's other sessions
  emitToUser(userId, 'chat:message' as WSEventType, userChatMessage);

  // Generate system response if it's a command
  let systemResponse: ChatMessage | undefined;

  if (commandParams) {
    const validation = validateCommand(commandParams);

    if (!validation.valid) {
      // Invalid command - send error message
      systemResponse = await createSystemMessage(
        user.id,
        `❌ ${validation.error}\n\nType /help for available commands.`
      );
    } else {
      // Valid command - handle it
      systemResponse = await handleCommand(user.id, userId, commandParams);
    }

    if (systemResponse) {
      emitToUser(userId, 'chat:message' as WSEventType, systemResponse);
    }
  }

  return {
    message: userChatMessage,
    systemResponse,
  };
}

/**
 * Get chat history
 */
export async function getChatHistory(
  userId: string,
  request: GetChatHistoryRequest
): Promise<GetChatHistoryResponse> {
  const prisma = getPrismaService();
  const limit = Math.min(request.limit || 50, 100); // Max 100

  const user = await prisma.user.findUnique({
    where: { address: userId },
  });

  if (!user) {
    return { messages: [], hasMore: false };
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      userId: user.id,
      ...(request.before && { id: { lt: request.before } }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const returnMessages = hasMore ? messages.slice(0, limit) : messages;

  const chatMessages: ChatMessage[] = returnMessages.map((msg) => ({
    id: msg.id,
    userId: msg.userId,
    content: msg.content,
    command: msg.command || undefined,
    metadata: msg.metadata as Record<string, any> | undefined,
    createdAt: msg.createdAt.toISOString(),
    sender: msg.content.startsWith('System:') ? 'system' : 'user',
  }));

  return {
    messages: chatMessages.reverse(), // Return in chronological order
    hasMore,
  };
}

/**
 * Delete a chat message
 */
export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const prisma = getPrismaService();

  const user = await prisma.user.findUnique({
    where: { address: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  await prisma.chatMessage.deleteMany({
    where: {
      id: messageId,
      userId: user.id, // Ensure user owns the message
    },
  });
}

/**
 * Create a system message
 */
async function createSystemMessage(userId: string, content: string): Promise<ChatMessage> {
  const prisma = getPrismaService();

  const message = await prisma.chatMessage.create({
    data: {
      userId,
      content: `System: ${content}`,
      command: undefined,
      metadata: undefined,
    },
  });

  return {
    id: message.id,
    userId: message.userId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    sender: 'system',
  };
}

/**
 * Handle command execution
 */
async function handleCommand(
  dbUserId: string,
  address: string,
  params: any
): Promise<ChatMessage> {
  if (!serverInstance) {
    throw new Error('ChatService not initialized');
  }

  // Execute command using command-executor
  const result = await executeCommand(serverInstance, dbUserId, address, params.raw);

  // Create system message with the result
  const content = result.success ? result.message : `❌ Error: ${result.message}`;

  return createSystemMessage(dbUserId, content);
}
