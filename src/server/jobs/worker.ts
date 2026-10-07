import type { Ctx } from '../lib/context.ts';
import { claimJob, failJob, recoverStaleJobs, succeedJob, type Job } from './queue.ts';
import { markAnalysisFailed, runAnalysis } from '../services/analysis.ts';
import { generateReport, markReportFailed } from '../services/reports.ts';

const TIMEOUT_MS: Record<Job['type'], number> = { analysis: 150_000, report: 90_000 };

const sanitise = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/(sk|key|token)[-_a-z0-9]{12,}/gi, '[redacted]').slice(0, 300);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(`Job timed out after ${ms}ms`)), ms); })]).finally(() => clearTimeout(t));
}

export class Worker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(private ctx: Ctx, private opts: { intervalMs?: number; backoffBaseSeconds?: number } = {}) {}

  start(): void {
    if (this.timer) return;
    const every = this.opts.intervalMs ?? 2000;
    this.timer = setInterval(() => { void this.drain().catch((e) => this.ctx.log.error({ err: sanitise(e) }, 'worker tick failed')); }, every);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }

  /** Process every job that is currently runnable. Returns the number processed. */
  async drain(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let n = 0;
    try {
      await recoverStaleJobs(this.ctx.db);
      for (let job = await claimJob(this.ctx.db); job; job = await claimJob(this.ctx.db)) {
        n++;
        await this.run(job);
      }
    } finally {
      this.running = false;
    }
    return n;
  }

  private async run(job: Job): Promise<void> {
    const { ctx } = this;
    try {
      if (job.type === 'analysis') await withTimeout(runAnalysis(ctx, job.assessment_id), TIMEOUT_MS.analysis);
      else await withTimeout(generateReport(ctx, job.assessment_id), TIMEOUT_MS.report);
      await succeedJob(ctx.db, job.id);
    } catch (e) {
      const msg = sanitise(e);
      ctx.log.warn({ job: job.type, attempt: job.attempts, err: msg }, 'job failed');
      const final = await failJob(ctx.db, job, msg, this.opts.backoffBaseSeconds ?? 15);
      if (final) {
        if (job.type === 'analysis') await markAnalysisFailed(ctx, job.assessment_id, msg);
        else await markReportFailed(ctx, job.assessment_id, msg);
      } else if (job.type === 'analysis') {
        await ctx.db.query(`UPDATE ai_analysis SET status='pending', error=$2 WHERE assessment_id=$1`, [job.assessment_id, msg]);
        await ctx.db.query(`UPDATE assessments SET analysis_status='pending' WHERE id=$1`, [job.assessment_id]);
      }
    }
  }
}
