// Usage: ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='long passphrase' npm run admin:create
import { loadEnv } from '../src/server/env.ts';
import { connect, migrate } from '../src/server/db/client.ts';
import { createContext } from '../src/server/bootstrap.ts';
import { createAdmin } from '../src/server/services/admin.ts';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 12 characters) in the environment.');
  process.exit(1);
}
const env = loadEnv();
const db = await connect(env.DATABASE_URL);
await migrate(db);
await createAdmin(createContext(env, db), email, password, process.env.ADMIN_NAME);
console.log(`Admin account ready: ${email}`);
await db.close();
