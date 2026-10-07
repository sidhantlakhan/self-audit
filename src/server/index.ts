import { loadEnv } from './env.ts';
import { connect, migrate } from './db/client.ts';
import { buildApp } from './app.ts';
import { createContext } from './bootstrap.ts';
import { Worker } from './jobs/worker.ts';
import { syncConfigVersions } from './services/config-sync.ts';
import { closePdfBrowser } from './report/pdf.ts';

const env = loadEnv();
const db = await connect(env.DATABASE_URL);
await migrate(db);
await syncConfigVersions(db);
const ctx = createContext(env, db);
const app = await buildApp(ctx);

const worker = new Worker(ctx);
if (env.WORKER_ENABLED) worker.start();

await app.listen({ port: env.PORT, host: '0.0.0.0' });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await worker.stop();
  await app.close();
  await closePdfBrowser();
  await db.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
