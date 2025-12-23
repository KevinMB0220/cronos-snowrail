import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { showBanner } from './utils/banner';

dotenv.config();

// Disable default logger to keep banner clean, we can enable it for debug levels if needed
const server = Fastify({
  logger: false
});

server.register(cors, {
  origin: '*'
});

server.get('/health', async (request, reply) => {
  return { status: 'ok', uptime: process.uptime() };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001');
    await server.listen({ port, host: '0.0.0.0' });
    showBanner();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();

