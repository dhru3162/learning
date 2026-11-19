import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';

import { Job } from 'bullmq';

@Processor('notifications', {
  concurrency: 5,
})
export class NotificationsProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    console.log('Processing Job:', job.id);
    console.log('Job Name:', job.name);
    console.log('Job Data:', job.data);

    switch (job.name) {
      case 'send-welcome-email':
        return this.sendWelcomeEmail(job);

      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async sendWelcomeEmail(job: Job) {
    const { email, message } = job.data;

    console.log(`Sending email to: ${email}`);

    // Simulate email sending
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`Email sent successfully to: ${email}`);

    return {
      email,
      message,
      status: 'sent',
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    console.log(`Job ${job.id} failed: ${error.message}`);
  }
}
