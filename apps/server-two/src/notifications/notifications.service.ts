import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications')
    private notificationQueue: Queue,
  ) {}

  async sendWelcomeEmail(email: string) {
    const job = await this.notificationQueue.add(
      'send-welcome-email',
      {
        email,
        message: 'Welcome to our application!',
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return {
      message: 'Welcome email job added successfully',
      jobId: job.id,
    };
  }

  async clearPendingJobs() {
    await this.notificationQueue.drain();

    return {
      message: 'Pending jobs cleared successfully',
    };
  }
}
