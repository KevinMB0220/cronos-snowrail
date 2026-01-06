import { FastifyInstance } from "fastify";
import {
  createIntent,
  getIntents,
  getIntentById,
  executeIntent,
  prepareDeposit,
  confirmDeposit,
} from "../controllers/intent-controller";

export async function intentRoutes(fastify: FastifyInstance) {
  fastify.post("/intents", createIntent);
  fastify.get("/intents", getIntents);
  fastify.get("/intents/:id", getIntentById);
  fastify.post("/intents/:id/deposit", prepareDeposit);
  fastify.post("/intents/:id/confirm-deposit", confirmDeposit);
  fastify.post("/intents/:id/execute", executeIntent);
}
