/**
 * UsersService
 *
 * Implements business logic for:
 * 1. Handling Excel file upload & job dispatch
 * 2. Real-time import status query
 * 3. Paginated import history
 * 4. Paginated failed records query
 * 5. Generation of failed records Excel report
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import 'multer';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportService } from '../import/import.service.js';
import {
  ImportHistoryQueryDto,
  PaginationQueryDto,
} from './dto/import-query.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: ImportService,
  ) {}

  /**
   * API 1: Upload Excel File
   * - Saves file locally
   * - Creates ImportJob record in PostgreSQL
   * - Dispatches job to BullMQ
   * - Returns importId immediately
   */
  async uploadExcel(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required. Please upload an .xlsx file.');
    }

    // Generate unique import ID: e.g. "IMP-1718000000"
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900);
    const importId = `IMP-${timestamp}${random}`;

    // Ensure uploads directory exists
    const uploadsDir = path.resolve(process.cwd(), 'uploads', 'imports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save uploaded file to disk
    const safeFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskFileName = `${importId}-${safeFileName}`;
    const filePath = path.join(uploadsDir, diskFileName);

    // If Multer used memoryStorage, write buffer to file; if diskStorage, move/use file.path
    if (file.buffer) {
      fs.writeFileSync(filePath, file.buffer);
    } else if (file.path && file.path !== filePath) {
      fs.copyFileSync(file.path, filePath);
    }

    // 1. Create ImportJob record in PostgreSQL
    const importJob = await this.prisma.importJob.create({
      data: {
        id: importId,
        fileName: file.originalname,
        filePath,
        status: 'PENDING',
        totalRecords: 0,
        processedRecords: 0,
        successRecords: 0,
        failedRecords: 0,
      },
    });

    // 2. Add job to BullMQ queue
    await this.importService.addImportJob({
      importId,
      filePath,
      fileName: file.originalname,
    });

    this.logger.log(`Import ${importId} created and enqueued successfully`);

    // 3. Return immediate response
    return {
      message: 'Import started successfully',
      importId: importJob.id,
      status: importJob.status,
    };
  }

  /**
   * API 2: Check Import Status
   */
  async getImportStatus(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Import job with ID ${id} not found`);
    }

    const progressPercentage =
      job.totalRecords > 0
        ? Math.min(100, Math.round((job.processedRecords / job.totalRecords) * 100))
        : job.status === 'COMPLETED'
          ? 100
          : 0;

    return {
      importId: job.id,
      fileName: job.fileName,
      totalRecords: job.totalRecords,
      processedRecords: job.processedRecords,
      successRecords: job.successRecords,
      failedRecords: job.failedRecords,
      currentStatus: job.status,
      progress: progressPercentage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  /**
   * API 3: Import History
   */
  async getImportHistory(query: ImportHistoryQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { fileName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.importJob.count({ where }),
      this.prisma.importJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedItems = items.map((job) => ({
      ...job,
      progress:
        job.totalRecords > 0
          ? Math.min(100, Math.round((job.processedRecords / job.totalRecords) * 100))
          : job.status === 'COMPLETED'
            ? 100
            : 0,
    }));

    return {
      data: formattedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * API 4: Get Failed Records
   */
  async getFailedRecords(id: string, query: PaginationQueryDto) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      select: { id: true, fileName: true, failedRecords: true },
    });

    if (!job) {
      throw new NotFoundException(`Import job with ID ${id} not found`);
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [total, errors] = await Promise.all([
      this.prisma.importError.count({
        where: { importJobId: id },
      }),
      this.prisma.importError.findMany({
        where: { importJobId: id },
        skip,
        take: limit,
        orderBy: { rowNumber: 'asc' },
      }),
    ]);

    return {
      importId: job.id,
      fileName: job.fileName,
      totalFailedRecords: total,
      data: errors,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * API 5: Download Failed Excel
   * Generates a styled .xlsx file containing all invalid records with their failure reasons.
   */
  async generateFailedExcel(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Import job with ID ${id} not found`);
    }

    const errors = await this.prisma.importError.findMany({
      where: { importJobId: id },
      orderBy: { rowNumber: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Failed Records');

    // Define Excel columns
    worksheet.columns = [
      { header: 'Row #', key: 'rowNumber', width: 10 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Failure Reason', key: 'errorReason', width: 45 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD32F2F' }, // Red header to indicate errors
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Add rows
    for (const error of errors) {
      worksheet.addRow({
        rowNumber: error.rowNumber,
        name: error.name || '',
        email: error.email || '',
        phone: error.phone || '',
        age: error.age || '',
        errorReason: error.errorReason,
      });
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    const downloadFileName = `failed_records_${id}.xlsx`;

    return { buffer, fileName: downloadFileName };
  }
}
