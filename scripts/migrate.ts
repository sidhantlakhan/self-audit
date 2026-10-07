import { loadEnv } from '../src/server/env.ts';
import { connect, migrate } from '../src/server/db/client.ts';

const env = loadEnv();
const db = await connect(env.DATABASE_URL);
const ran = await migrate(db);
console.log(ran.length ? `Applied migrations: ${ran.join(', ')}` : 'Database is up to date.');
await db.close();
