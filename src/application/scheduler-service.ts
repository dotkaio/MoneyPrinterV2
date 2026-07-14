import { Cron } from "croner";

import type { Schedule } from "../domain/model.js";
import type {
  CreateScheduleInput,
  JobRepository,
  ScheduleRepository,
} from "../infrastructure/database/repositories.js";
import { AppError } from "../shared/errors.js";

export interface NewScheduleRequest {
  name: string;
  jobType: string;
  payload: Readonly<Record<string, unknown>>;
  cronExpression: string;
  timezone: string;
  enabled?: boolean;
}

export class SchedulerService {
  public constructor(
    private readonly schedules: ScheduleRepository,
    private readonly jobs: JobRepository,
    private readonly maximumAttempts: number,
  ) {}

  public create(request: NewScheduleRequest, now = new Date()): Schedule {
    const nextRun = this.nextRun(request.cronExpression, request.timezone, now);
    const input: CreateScheduleInput = {
      ...request,
      nextRunAt: nextRun.toISOString(),
    };
    return this.schedules.create(input);
  }

  public tick(now = new Date()): number {
    let enqueued = 0;
    for (const schedule of this.schedules.listDue(now)) {
      let intendedRun = new Date(schedule.nextRunAt);
      let catchupCount = 0;

      while (intendedRun <= now && catchupCount < 100) {
        this.jobs.enqueue({
          type: schedule.jobType,
          payload: schedule.payload,
          idempotencyKey: `schedule:${schedule.id}:${intendedRun.toISOString()}`,
          runAt: intendedRun.toISOString(),
          maximumAttempts: this.maximumAttempts,
        });
        enqueued += 1;
        catchupCount += 1;
        intendedRun = this.nextRun(
          schedule.cronExpression,
          schedule.timezone,
          intendedRun,
        );
      }

      this.schedules.updateNextRun(schedule.id, intendedRun.toISOString(), now);
    }
    return enqueued;
  }

  private nextRun(expression: string, timezone: string, after: Date): Date {
    let next: Date | null;
    try {
      const cron = new Cron(expression, { timezone, paused: true });
      next = cron.nextRun(after);
      cron.stop();
    } catch (error) {
      throw new AppError(
        `Invalid schedule: ${expression} (${timezone})`,
        "SCHEDULE_INVALID",
        false,
        {
          cause: error,
        },
      );
    }
    if (next === null) {
      throw new AppError(
        `Schedule has no future run: ${expression}`,
        "SCHEDULE_EXHAUSTED",
      );
    }
    return next;
  }
}
