import { hostname } from "node:os";

import { SchedulerService } from "../application/scheduler-service.js";
import type { Runtime } from "../runtime.js";
import { createId } from "../shared/ids.js";
import { createDefaultJobHandlers } from "./default-handlers.js";
import { JobWorker, type JobHandler } from "./job-worker.js";

export interface WorkerServiceOptions {
  workerId?: string;
  handlers?: ReadonlyMap<string, JobHandler>;
}

export class WorkerService {
  private readonly workerId: string;
  private readonly worker: JobWorker;
  private readonly scheduler: SchedulerService;
  private running: Promise<void> | null = null;
  private stopRequested = false;
  private wakePoll: (() => void) | null = null;

  public constructor(
    private readonly runtime: Runtime,
    options: WorkerServiceOptions = {},
  ) {
    this.workerId =
      options.workerId ?? `${hostname()}:${process.pid}:${createId()}`;
    this.worker = new JobWorker(
      runtime,
      this.workerId,
      options.handlers ?? createDefaultJobHandlers(),
    );
    this.scheduler = new SchedulerService(
      runtime.schedules,
      runtime.jobs,
      runtime.loadedConfig.config.worker.maximumAttempts,
    );
  }

  public start(): Promise<void> {
    if (this.running !== null) {
      return this.running;
    }
    this.stopRequested = false;
    this.runtime.logger.info({ workerId: this.workerId }, "Worker started");
    this.running = this.run();
    return this.running;
  }

  public async stop(signal = "application"): Promise<void> {
    if (this.running === null) {
      return;
    }
    if (!this.stopRequested) {
      this.stopRequested = true;
      this.runtime.logger.info(
        { workerId: this.workerId, signal },
        "Worker stopping",
      );
      this.wakePoll?.();
    }
    try {
      await this.running;
    } finally {
      this.running = null;
      this.wakePoll = null;
    }
  }

  private async run(): Promise<void> {
    while (!this.stopRequested) {
      const scheduled = this.scheduler.tick();
      const handled = await this.worker.runOnce();
      if (!handled && scheduled === 0) {
        await this.waitForNextPoll();
      }
    }
  }

  private waitForNextPoll(): Promise<void> {
    if (this.stopRequested) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        if (this.wakePoll === finish) {
          this.wakePoll = null;
        }
        resolve();
      };
      const timer = setTimeout(
        finish,
        this.runtime.loadedConfig.config.worker.pollIntervalMs,
      );
      this.wakePoll = finish;
    });
  }
}
