import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Minimal driver-agnostic interface so identical SQL runs on PostgreSQL (pg) and embedded PGlite. */
export interface Db {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Run a multi-statement script (migrations). No parameters. */
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function wrap(run: (sql: string, params: unknown[]) => Promise<any[]>, tx: Db['tx'], close: () => Promise<void>, exec?: (sql: string) => Promise<void>): Db {
  return {
    exec: exec ?? (async (sql) => { await run(sql, []); }),
    query: (sql, params = []) => run(sql, params),
    one: async (sql, params = []) => (await run(sql, params))[0] ?? null,
    tx,
    close,
  };
}

export async function connect(url: string): Promise<Db> {
  if (url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const target = url.slice('pglite:'.length);
    let pg: InstanceType<typeof PGlite>;
    if (target === 'memory' || target === '') pg = new PGlite();
    else {
      mkdirSync(resolve(target), { recursive: true });
      pg = new PGlite(resolve(target));
    }
    await pg.waitReady;
    // PGlite is single-connection: serialise transactions so concurrent requests cannot interleave.
    let chain: Promise<unknown> = Promise.resolve();
    const serial = <T>(fn: () => Promise<T>): Promise<T> => {
      const next = chain.then(fn, fn);
      chain = next.catch(() => undefined);
      return next;
    };
    const direct = (client: { query: (s: string, p?: unknown[]) => Promise<{ rows: any[] }> }) => async (sql: string, params: unknown[]) => (await client.query(sql, params)).rows;
    const root: Db = wrap(
      (sql, params) => serial(() => direct(pg)(sql, params)),
      (fn) => serial(() => pg.transaction(async (t) => fn(wrap(direct(t as any), () => { throw new Error('Nested transactions are not supported'); }, async () => {}, async (sql) => { await (t as any).exec(sql); })))),
      async () => { await pg.close(); },
      (sql) => serial(async () => { await pg.exec(sql); }),
    );
    return root;
  }

  const pgmod = await import('pg');
  const pool = new pgmod.default.Pool({ connectionString: url, max: 10, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
  // Return int8/bigint as numbers (counts) — safe for this application's volumes.
  pgmod.default.types.setTypeParser(20, (v: string) => parseInt(v, 10));
  return wrap(
    async (sql, params) => (await pool.query(sql, params as any[])).rows,
    async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const inner = wrap(async (sql, params) => (await client.query(sql, params as any[])).rows, () => { throw new Error('Nested transactions are not supported'); }, async () => {});
        const out = await fn(inner);
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    async () => { await pool.end(); },
  );
}

/** Applies pending SQL migrations from /migrations in filename order. Each runs in its own transaction. */
export async function migrate(db: Db, dir = resolve('migrations')): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const ran: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await db.tx(async (t) => {
      // pg accepts multi-statement text only without params; PGlite needs exec-style splitting via query without params too.
      await t.exec(sql);
      await t.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    });
    ran.push(f);
  }
  return ran;
}
