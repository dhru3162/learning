/**
 * ImportModule
 *
 * Registers the BullMQ queue 'user-import-queue' and provides
 * both the Producer (ImportService) and Consumer (UserImportProcessor).
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { USER_IMPORT_QUEUE } from './import.constants.js';
import { ImportService } from './import.service.js';
import { UserImportProcessor } from './import.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: USER_IMPORT_QUEUE,
      // Default settings for jobs in this queue
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
      },
    }),
  ],
  providers: [ImportService, UserImportProcessor],
  exports: [ImportService, BullModule],
})
export class ImportModule {}
