import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { attachSockets } from './sockets/index.js';

const app = createApp();
const httpServer = createServer(app);
const io = attachSockets(httpServer);

httpServer.listen(config.PORT, () => {
  console.log(`🍗 API Crousty & Kebab prête sur le port ${config.PORT} (${config.NODE_ENV})`);
});

async function shutdown(signal: string) {
  console.log(`${signal} reçu, arrêt propre…`);
  io.close();
  httpServer.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
