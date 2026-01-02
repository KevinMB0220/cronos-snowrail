/**
 * MCP Server Plugin for Cronos x402 Agentic Treasury
 *
 * Implements Model Context Protocol (MCP) server using JSON-RPC 2.0
 * Exposes treasury functionality as tools for AI assistants
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { allTools } from './tools';
import { executeTool } from './handlers';

// JSON-RPC 2.0 types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// MCP Protocol version
const MCP_PROTOCOL_VERSION = '2024-11-05';

// Server info
const SERVER_INFO = {
  name: 'cronos-x402-treasury',
  version: '1.0.0',
  description: 'MCP Server for Cronos x402 Agentic Treasury - AI-driven payment settlements on Cronos blockchain',
};

/**
 * Handle MCP initialize request
 */
function handleInitialize(id: string | number | null): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: {},
      },
    },
  };
}

/**
 * Handle MCP tools/list request
 */
function handleToolsList(id: string | number | null): JsonRpcResponse {
  const tools = allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  return {
    jsonrpc: '2.0',
    id,
    result: {
      tools,
    },
  };
}

/**
 * Handle MCP tools/call request
 */
async function handleToolsCall(
  id: string | number | null,
  params: { name: string; arguments?: Record<string, unknown> },
  logger: FastifyInstance['log']
): Promise<JsonRpcResponse> {
  const { name, arguments: args = {} } = params;

  logger.info({ toolName: name, args }, '[MCP] tools/call request');

  const result = await executeTool(name, args, logger);

  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Handle MCP notifications/initialized
 */
function handleNotificationsInitialized(): void {
  // Notification - no response needed
}

/**
 * Create JSON-RPC error response
 */
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * Process a single JSON-RPC request
 */
async function processRequest(
  request: JsonRpcRequest,
  logger: FastifyInstance['log']
): Promise<JsonRpcResponse | null> {
  const { id, method, params } = request;

  logger.debug({ method, id }, '[MCP] Processing request');

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id);

      case 'notifications/initialized':
        handleNotificationsInitialized();
        return null; // Notification - no response

      case 'tools/list':
        return handleToolsList(id);

      case 'tools/call':
        if (!params?.name) {
          return createErrorResponse(id, -32602, 'Invalid params: missing tool name');
        }
        return await handleToolsCall(
          id,
          params as { name: string; arguments?: Record<string, unknown> },
          logger
        );

      default:
        logger.warn({ method }, '[MCP] Unknown method');
        return createErrorResponse(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage, method }, '[MCP] Error processing request');
    return createErrorResponse(id, -32603, 'Internal error', errorMessage);
  }
}

/**
 * Register MCP routes as a Fastify plugin
 */
export async function mcpPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('[MCP] Registering MCP plugin');

  // MCP endpoint - JSON-RPC 2.0 over HTTP
  fastify.post(
    '/mcp',
    async (
      request: FastifyRequest<{ Body: JsonRpcRequest | JsonRpcRequest[] }>,
      reply: FastifyReply
    ) => {
      const body = request.body;

      // Handle batch requests
      if (Array.isArray(body)) {
        const responses: JsonRpcResponse[] = [];
        for (const req of body) {
          const response = await processRequest(req, fastify.log);
          if (response) {
            responses.push(response);
          }
        }
        return reply.send(responses);
      }

      // Handle single request
      const response = await processRequest(body, fastify.log);
      if (response) {
        return reply.send(response);
      }

      // Notification - return 204 No Content
      return reply.code(204).send();
    }
  );

  // Debug endpoint - list available tools (human-readable)
  fastify.get('/mcp/tools', async (_request, reply) => {
    const tools = allTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return reply.send({
      server: SERVER_INFO,
      protocolVersion: MCP_PROTOCOL_VERSION,
      tools,
    });
  });

  // Health check for MCP endpoint
  fastify.get('/mcp/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      server: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocol: MCP_PROTOCOL_VERSION,
    });
  });

  fastify.log.info('[MCP] MCP plugin registered successfully');
  fastify.log.info(`[MCP] Available tools: ${allTools.map((t) => t.name).join(', ')}`);
}

export default mcpPlugin;
