import type { Db } from '../db/client.ts';

export type JobType = 'analysis' | 'report';

/** Enqueue a job. The partial unique index guarantees at most one live job per (type, assessment). */
export async function enqueueJob(db: Db, type: JobType, assessmentId: string, opts: { delaySeconds?: number; reset?: boolean } = {}): Promise<void> {
  await db.query(
    `INSERT INTO jobs (type, assessment_id, run_at) VALUES ($1,$2, now() + ($3 || ' seconds')::interval)
     ON CONFLICT (type, assessment_id) WHERE status IN ('queued','running') DO NOTHING`,
    [type, assessmentId, String(opts.delaySeconds ?? 0)]);
}

export interface Job { id: string; type: JobType; assessment_id: string; attempts: number; max_attempts: number }

export async function claimJob(db: Db): Promise<Job | null> {
  return db.one<Job>(
    `UPDATE jobs SET status='running', locked_at=now(), attempts=attempts+1
     WHERE id = (SELECT id FROM jobs WHERE status='queued' AND run_at <= now() ORDER BY run_at, created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING id, type, assessment_id, attempts, max_attempts`);
}

export async function succeedJob(db: Db, id: string): Promise<void> {
  await db.query(`UPDATE jobs SET status='succeeded', finished_at=now(), locked_at=NULL, last_error=NULL WHERE id=$1`, [id]);
}

/** Returns true when the job has permanently failed (retries exhausted). */
export async function failJob(db: Db, job: Job, error: string, backoffBaseSeconds = 15): Promise<boolean> {
  const final = job.attempts >= job.max_attempts;
  if (final) {
    await db.query(`UPDATE jobs SET status='failed', finished_at=now(), locked_at=NULL, last_error=$2 WHERE id=$1`, [job.id, error.slice(0, 400)]);
  } else {
    const delay = backoffBaseSeconds * 4 ** (job.attempts - 1);
    await db.query(`UPDATE jobs SET status='queued', locked_at=NULL, last_error=$2, run_at = now() + ($3 || ' seconds')::interval WHERE id=$1`, [job.id, error.slice(0, 400), String(delay)]);
  }
  return final;
}

/** A worker that died mid-job leaves it 'running'; put stale ones back in the queue. */
export async function recoverStaleJobs(db: Db, staleMinutes = 5): Promise<number> {
  const rows = await db.query(`UPDATE jobs SET status='queued', locked_at=NULL WHERE status='running' AND locked_at < now() - ($1 || ' minutes')::interval RETURNING id`, [String(staleMinutes)]);
  return rows.length;
}
