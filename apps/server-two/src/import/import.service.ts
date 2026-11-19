/**
 * ImportService (Queue Producer)
 *
 * RESPONSIBILITY:
 * ---------------
 * Adds jobs to the BullMQ 'user-import-queue'.
 * The upload HTTP controller calls this service to enqueue the job.
 * The HTTP request completes immediately after enqueueing, achieving
 * non-blocking asynchronous architecture.
 *
 * WHY BULLMQ & REDIS?
 * -------------------
 * - When `this.importQueue.add(...)` is called, BullMQ writes job data to Redis.
 * - Redis persists the job safely.
 * - Even if the NestJS worker or server restarts, the job is not lost in Redis.
 * - Worker processes it independently in the background.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { USER_IMPORT_QUEUE, PROCESS_EXCEL_JOB } from './import.constants.js';
import { ImportJobData } from './import.types.js';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @InjectQueue(USER_IMPORT_QUEUE)
    private readonly importQueue: Queue<ImportJobData>,
  ) {}

  /**
   * Adds an Excel import job to the BullMQ queue.
   *
   * @param data Job payload containing importId, filePath, and fileName
   */
  async addImportJob(data: ImportJobData) {
    // Unique jobId: 'import-IMP-1001'
    // BullMQ prevents duplicate jobs with the same ID from being queued simultaneously.
    const jobId = `import-${data.importId}`;

    const job = await this.importQueue.add(PROCESS_EXCEL_JOB, data, {
      jobId,
      attempts: 3, // Auto-retry up to 3 times for infrastructure crashes
      backoff: {
        type: 'exponential',
        delay: 3000, // 3s, then 6s, then 12s exponential backoff
      },
      removeOnComplete: 100, // Keep last 100 completed jobs in Redis for inspection
      removeOnFail: 500, // Keep last 500 failed jobs for debugging
    });

    this.logger.log(
      `Enqueued import job: ${job.id} for importId: ${data.importId}`,
    );

    return job;
  }

  /**
   * Challenge 5: Queue Pause & Resume functionality
   */
  async pauseQueue() {
    await this.importQueue.pause();
    this.logger.log('user-import-queue paused');
    return { status: 'paused', message: 'Queue paused successfully' };
  }

  async resumeQueue() {
    await this.importQueue.resume();
    this.logger.log('user-import-queue resumed');
    return { status: 'resumed', message: 'Queue resumed successfully' };
  }

  async isQueuePaused() {
    const isPaused = await this.importQueue.isPaused();
    return { isPaused };
  }
}
