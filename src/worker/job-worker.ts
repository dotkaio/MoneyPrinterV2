import type { Job } from "../domain/model.js";
import type { Runtime } from "../runtime.js";
import { AppError, errorMessage } from "../shared/errors.js";

export type JobHandler = (job: Job, runtime: Runtime) => Promise<void>;

export class JobWorker {
  public constructor(
    private readonly runtime: Runtime,
    private readonly workerId: string,
    private readonly handlers: ReadonlyMap<string, JobHandler>,
  ) {}

  public async runOnce(now = new Date()): Promise<boolean> {
    const job = this.runtime.jobs.claim(
      this.workerId,
      this.runtime.loadedConfig.config.worker.leaseDurationMs,
      now,
    );
    if (job === null) {
      return false;
    }

    const handler = this.handlers.get(job.type);
    if (handler === undefined) {
      this.runtime.jobs.fail(
        job.id,
        this.workerId,
        `No handler is registered for job type ${job.type}`,
        false,
        now,
      );
      return true;
    }

    try {
      await handler(job, this.runtime);
      this.runtime.jobs.complete(job.id, this.workerId);
      this.runtime.logger.info(
        { jobId: job.id, jobType: job.type },
        "Job succeeded",
      );
    } catch (error) {
      const retryable = error instanceof AppError ? error.retryable : true;
      const failed = this.runtime.jobs.fail(
        job.id,
        this.workerId,
        errorMessage(error),
        retryable,
      );
      this.runtime.logger.error(
        {
          jobId: job.id,
          jobType: job.type,
          retryable,
          state: failed.state,
          error,
        },
        "Job failed",
      );
    }

    return true;
  }
}
