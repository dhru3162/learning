/**
 * UserImportProcessor (Queue Consumer / Worker)
 *
 * HOW DOES IT WORK INTERNALLY?
 * ----------------------------
 * 1. BullMQ worker constantly listens to Redis for jobs on 'user-import-queue'
 * 2. When a job is available, Redis assigns it to this worker
 * 3. The job state moves: WAITING -> ACTIVE
 * 4. This process(job) method is executed
 * 5. As records are processed in batches of 100:
 *    - Valid users are inserted into PostgreSQL
 *    - Invalid users are recorded in ImportError table
 *    - Progress is saved to both DB (ImportJob) and BullMQ (job.updateProgress)
 * 6. If process() returns successfully -> BullMQ moves job to COMPLETED
 * 7. If process() throws an unhandled exception -> BullMQ moves job to FAILED,
 *    and uses exponential backoff to retry up to the configured `attempts`.
 *
 * MEMORY EFFICIENCY (50,000 RECORDS):
 * -----------------------------------
 * We use ExcelJS.stream.xlsx.WorkbookReader which reads rows as an async stream
 * instead of loading the entire multi-megabyte Excel file into RAM at once.
 */

import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import ExcelJS from 'exceljs';
import * as fs from 'node:fs';

import { PrismaService } from '../prisma/prisma.service.js';
import { USER_IMPORT_QUEUE, PROCESS_EXCEL_JOB, BATCH_SIZE } from './import.constants.js';
import {
  ImportJobData,
  RawExcelRow,
  ValidUserRecord,
  InvalidUserRecord,
} from './import.types.js';

// Concurrency: allows 2 import jobs to be processed concurrently
@Processor(USER_IMPORT_QUEUE, { concurrency: 2 })
export class UserImportProcessor extends WorkerHost {
  private readonly logger = new Logger(UserImportProcessor.name);

  // Email format regex
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Phone: must contain exactly 10 digits
  private readonly phoneRegex = /^\d{10}$/;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Main entry point for processing jobs on this queue.
   */
  async process(job: Job<ImportJobData>): Promise<any> {
    if (job.name !== PROCESS_EXCEL_JOB) {
      throw new Error(`Unhandled job name: ${job.name}`);
    }

    const { importId, filePath, fileName } = job.data;
    this.logger.log(`[Job ${job.id}] Starting import for ID: ${importId} (${fileName})`);

    // Verify file exists on disk
    if (!fs.existsSync(filePath)) {
      await this.markJobFailed(importId, `Excel file not found on server: ${filePath}`);
      throw new Error(`File not found: ${filePath}`);
    }

    // Mark job as PROCESSING in PostgreSQL
    await this.prisma.importJob.update({
      where: { id: importId },
      data: {
        status: 'PROCESSING',
        // If this is a retry attempt, reset counters to ensure idempotency
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
      },
    });

    // Delete any previous errors for this importId if retrying
    await this.prisma.importError.deleteMany({
      where: { importJobId: importId },
    });

    try {
      // Execute the streaming Excel processing
      const result = await this.processExcelStream(job, importId, filePath);

      // Mark ImportJob as COMPLETED in DB
      await this.prisma.importJob.update({
        where: { id: importId },
        data: {
          status: 'COMPLETED',
          totalRecords: result.totalRows,
          processedRecords: result.processed,
          successRecords: result.success,
          failedRecords: result.failed,
        },
      });

      this.logger.log(
        `[Job ${job.id}] Finished import ${importId}: Total=${result.totalRows}, Success=${result.success}, Failed=${result.failed}`,
      );

      return result;
    } catch (error: any) {
      this.logger.error(`[Job ${job.id}] Processing error: ${error.message}`, error.stack);
      await this.markJobFailed(importId, error.message);
      // Re-throw so BullMQ knows the job failed and can handle retries/backoff
      throw error;
    }
  }

  /**
   * Streams the Excel file using ExcelJS.stream.xlsx.WorkbookReader.
   * Processes rows in batches of 100.
   */
  private async processExcelStream(
    job: Job<ImportJobData>,
    importId: string,
    filePath: string,
  ): Promise<{ totalRows: number; processed: number; success: number; failed: number }> {
    // 1. Pass 1: Quick count of total records and header validation
    const { headerMap, totalDataRows } = await this.inspectExcelHeadersAndCount(filePath);

    if (totalDataRows === 0) {
      throw new Error('The uploaded Excel file contains no data rows.');
    }

    // Update totalRecords count in DB immediately so UI sees it
    await this.prisma.importJob.update({
      where: { id: importId },
      data: { totalRecords: totalDataRows },
    });

    // 2. Pass 2: Stream rows and process in batches of 100
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    });

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    const seenFileEmails = new Set<string>();
    let currentBatch: RawExcelRow[] = [];

    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        // Skip header row (row number 1)
        if (row.number === 1) {
          continue;
        }

        // Extract cell values based on mapped header columns
        const rawRow: RawExcelRow = {
          rowNumber: row.number,
          name: this.getCellValue(row.getCell(headerMap.name)),
          email: this.getCellValue(row.getCell(headerMap.email)),
          phone: this.getCellValue(row.getCell(headerMap.phone)),
          age: this.getCellValue(row.getCell(headerMap.age)),
        };

        // If row is completely empty, skip it
        if (!rawRow.name && !rawRow.email && !rawRow.phone && !rawRow.age) {
          continue;
        }

        currentBatch.push(rawRow);

        // When batch reaches BATCH_SIZE (100), flush and process
        if (currentBatch.length >= BATCH_SIZE) {
          const batchResult = await this.processBatch(
            importId,
            currentBatch,
            seenFileEmails,
          );
          processedCount += currentBatch.length;
          successCount += batchResult.batchSuccess;
          failedCount += batchResult.batchFailed;

          await this.updateProgress(
            job,
            importId,
            totalDataRows,
            processedCount,
            successCount,
            failedCount,
          );

          currentBatch = [];
        }
      }
    }

    // Flush any remaining records in the last batch
    if (currentBatch.length > 0) {
      const batchResult = await this.processBatch(
        importId,
        currentBatch,
        seenFileEmails,
      );
      processedCount += currentBatch.length;
      successCount += batchResult.batchSuccess;
      failedCount += batchResult.batchFailed;

      await this.updateProgress(
        job,
        importId,
        totalDataRows,
        processedCount,
        successCount,
        failedCount,
      );
    }

    return {
      totalRows: totalDataRows,
      processed: processedCount,
      success: successCount,
      failed: failedCount,
    };
  }

  /**
   * Validates header structure and counts total data rows.
   */
  private async inspectExcelHeadersAndCount(
    filePath: string,
  ): Promise<{
    headerMap: { name: number; email: number; phone: number; age: number };
    totalDataRows: number;
  }> {
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
    });

    let headerMap: { name: number; email: number; phone: number; age: number } | null = null;
    let totalDataRows = 0;

    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        if (row.number === 1) {
          // Identify columns from header row
          const map: Record<string, number> = {};
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const val = String(cell.value || '').trim().toLowerCase();
            map[val] = colNumber;
          });

          // Check required columns
          const nameCol = map['name'];
          const emailCol = map['email'];
          const phoneCol = map['phone'];
          const ageCol = map['age'];

          if (!nameCol || !emailCol || !phoneCol || !ageCol) {
            const missing = [];
            if (!nameCol) missing.push('Name');
            if (!emailCol) missing.push('Email');
            if (!phoneCol) missing.push('Phone');
            if (!ageCol) missing.push('Age');
            throw new Error(`Missing required columns in Excel: ${missing.join(', ')}`);
          }

          headerMap = {
            name: nameCol,
            email: emailCol,
            phone: phoneCol,
            age: ageCol,
          };
        } else {
          totalDataRows++;
        }
      }
      break; // Only inspect first worksheet
    }

    if (!headerMap) {
      throw new Error('Invalid Excel file: No header row found.');
    }

    return { headerMap, totalDataRows };
  }

  /**
   * Processes a single batch of 100 rows:
   * 1. In-memory validation
   * 2. In-file duplicate checking
   * 3. Database duplicate checking
   * 4. Atomic PostgreSQL transaction insertion
   */
  private async processBatch(
    importId: string,
    batch: RawExcelRow[],
    seenFileEmails: Set<string>,
  ): Promise<{ batchSuccess: number; batchFailed: number }> {
    const validCandidates: { raw: RawExcelRow; parsed: ValidUserRecord }[] = [];
    const invalidRecords: InvalidUserRecord[] = [];

    // Step 1: Validate individual fields & in-file duplicate check
    for (const raw of batch) {
      const validationError = this.validateRawRow(raw, seenFileEmails);

      if (validationError) {
        invalidRecords.push({
          rowNumber: raw.rowNumber,
          name: raw.name,
          email: raw.email,
          phone: raw.phone,
          age: raw.age,
          errorReason: validationError,
        });
      } else {
        const cleanEmail = raw.email!.trim().toLowerCase();
        seenFileEmails.add(cleanEmail);

        validCandidates.push({
          raw,
          parsed: {
            name: raw.name!.trim(),
            email: cleanEmail,
            phone: raw.phone!.trim(),
            age: parseInt(raw.age!.trim(), 10),
          },
        });
      }
    }

    // Step 2: Check database duplicates for valid candidates in ONE efficient query
    const emailsToCheck = validCandidates.map((c) => c.parsed.email);
    const existingUsers =
      emailsToCheck.length > 0
        ? await this.prisma.user.findMany({
            where: { email: { in: emailsToCheck } },
            select: { email: true },
          })
        : [];

    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const usersToInsert: ValidUserRecord[] = [];

    for (const candidate of validCandidates) {
      if (existingEmailSet.has(candidate.parsed.email)) {
        invalidRecords.push({
          rowNumber: candidate.raw.rowNumber,
          name: candidate.raw.name,
          email: candidate.raw.email,
          phone: candidate.raw.phone,
          age: candidate.raw.age,
          errorReason: 'Email already exists in database',
        });
      } else {
        usersToInsert.push(candidate.parsed);
      }
    }

    // Step 3: Atomic database transaction for this batch
    await this.prisma.$transaction(async (tx) => {
      // Insert valid users (skipDuplicates makes it idempotent)
      if (usersToInsert.length > 0) {
        await tx.user.createMany({
          data: usersToInsert,
          skipDuplicates: true,
        });
      }

      // Record invalid rows in ImportError
      if (invalidRecords.length > 0) {
        await tx.importError.createMany({
          data: invalidRecords.map((rec) => ({
            importJobId: importId,
            rowNumber: rec.rowNumber,
            name: rec.name || null,
            email: rec.email || null,
            phone: rec.phone || null,
            age: rec.age || null,
            errorReason: rec.errorReason,
          })),
        });
      }
    });

    return {
      batchSuccess: usersToInsert.length,
      batchFailed: invalidRecords.length,
    };
  }

  /**
   * Validates a raw Excel row against business rules.
   */
  private validateRawRow(
    raw: RawExcelRow,
    seenFileEmails: Set<string>,
  ): string | null {
    // 1. Name validation
    if (!raw.name || raw.name.trim().length === 0) {
      return 'Name is required';
    }

    // 2. Email validation
    if (!raw.email || raw.email.trim().length === 0) {
      return 'Email is required';
    }
    const cleanEmail = raw.email.trim().toLowerCase();
    if (!this.emailRegex.test(cleanEmail)) {
      return 'Invalid email format';
    }

    // Duplicate check within uploaded file
    if (seenFileEmails.has(cleanEmail)) {
      return 'Duplicate email in uploaded Excel file';
    }

    // 3. Phone validation
    if (!raw.phone || raw.phone.trim().length === 0) {
      return 'Phone is required';
    }
    // Extract digits only or check exact 10 digits
    const digitsOnly = raw.phone.trim().replace(/\D/g, '');
    if (!this.phoneRegex.test(digitsOnly)) {
      return 'Phone must contain exactly 10 digits';
    }

    // 4. Age validation
    if (!raw.age || raw.age.trim().length === 0) {
      return 'Age is required';
    }
    const ageNum = Number(raw.age.trim());
    if (isNaN(ageNum) || !Number.isInteger(ageNum) || ageNum <= 0 || ageNum > 150) {
      return 'Age must be a valid number between 1 and 150';
    }

    return null; // Valid row
  }

  /**
   * Synchronizes progress between PostgreSQL ImportJob and BullMQ.
   */
  private async updateProgress(
    job: Job<ImportJobData>,
    importId: string,
    total: number,
    processed: number,
    success: number,
    failed: number,
  ) {
    const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    // 1. Update BullMQ Job Progress in Redis
    await job.updateProgress(percentage);

    // 2. Update PostgreSQL ImportJob record
    await this.prisma.importJob.update({
      where: { id: importId },
      data: {
        processedRecords: processed,
        successRecords: success,
        failedRecords: failed,
      },
    });
  }

  /**
   * Helper to mark ImportJob as FAILED in database.
   */
  private async markJobFailed(importId: string, reason: string) {
    try {
      await this.prisma.importJob.update({
        where: { id: importId },
        data: {
          status: 'FAILED',
        },
      });
    } catch (e: any) {
      this.logger.error(`Failed to update job status to FAILED: ${e.message}`);
    }
  }

  /**
   * Safely extracts text value from an ExcelJS cell.
   */
  private getCellValue(cell: ExcelJS.Cell): string {
    if (!cell || cell.value === null || cell.value === undefined) {
      return '';
    }
    // Handle rich text or object cell values
    if (typeof cell.value === 'object') {
      if ('text' in cell.value) {
        return String((cell.value as any).text).trim();
      }
      if ('result' in cell.value) {
        return String((cell.value as any).result).trim();
      }
    }
    return String(cell.value).trim();
  }

  // ─── BullMQ Worker Lifecycle Events ────────────────────────────────────────

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ImportJobData>) {
    this.logger.log(`[Job ${job.id}] Completed successfully for importId: ${job.data?.importId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ImportJobData> | undefined, error: Error) {
    this.logger.error(
      `[Job ${job?.id}] Failed on attempt ${job?.attemptsMade}: ${error.message}`,
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`[Job ${jobId}] Stalled and will be re-processed by BullMQ`);
  }
}
