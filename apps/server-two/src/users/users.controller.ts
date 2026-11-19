/**
 * UsersController
 *
 * Exposes the 5 REST APIs for the Bulk Excel User Import System:
 * 1. POST /users/import                 -> Upload Excel file
 * 2. GET  /users/import/history         -> Import history (pagination + filter)
 * 3. GET  /users/import/:id/status      -> Check real-time import status
 * 4. GET  /users/import/:id/failed-records -> View invalid rows with reasons
 * 5. GET  /users/import/:id/download-failed -> Download failed rows as .xlsx
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import 'multer';
import { UsersService } from './users.service.js';
import {
  ImportHistoryQueryDto,
  PaginationQueryDto,
} from './dto/import-query.dto.js';

@ApiTags('Users Import')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * API 1: Upload Excel File
   * Accepts multipart/form-data with field name 'file'
   * Validates:
   * - Only .xlsx files
   * - Max size 10MB
   */
  @Post('import')
  @ApiOperation({
    summary: 'Upload Excel File',
    description:
      'Uploads an .xlsx file containing user records, creates an import job, enqueues it into BullMQ, and immediately returns the import ID.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The .xlsx Excel file to import (max 10MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Import started successfully',
    schema: {
      example: {
        message: 'Import started successfully',
        importId: 'IMP-1001',
        status: 'PENDING',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or file missing' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
      },
      fileFilter: (_req, file, callback) => {
        // Enforce .xlsx extension and mime types
        const isXlsxExt = file.originalname.toLowerCase().endsWith('.xlsx');
        if (!isXlsxExt) {
          return callback(
            new BadRequestException('Only .xlsx Excel files are supported'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please provide an .xlsx file in the "file" field');
    }
    return this.usersService.uploadExcel(file);
  }

  /**
   * API 3: Import History
   * NOTE: Placed before :id routes so 'history' is not matched as an :id parameter!
   */
  @Get('import/history')
  @ApiOperation({
    summary: 'Get Import History',
    description: 'Retrieves previous import jobs with pagination and optional status filter.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of import jobs' })
  async getImportHistory(@Query() query: ImportHistoryQueryDto) {
    return this.usersService.getImportHistory(query);
  }

  /**
   * API 2: Check Import Status & Real-time Progress
   */
  @Get('import/:id/status')
  @ApiOperation({
    summary: 'Check Import Status',
    description: 'Returns real-time progress metrics for a given import ID.',
  })
  @ApiParam({ name: 'id', description: 'Import ID (e.g. IMP-1001)' })
  @ApiResponse({
    status: 200,
    description: 'Current status and progress percentage',
    schema: {
      example: {
        importId: 'IMP-1001',
        fileName: 'users.xlsx',
        totalRecords: 5000,
        processedRecords: 2500,
        successRecords: 2400,
        failedRecords: 100,
        currentStatus: 'PROCESSING',
        progress: 50,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Import job not found' })
  async getImportStatus(@Param('id') id: string) {
    return this.usersService.getImportStatus(id);
  }

  /**
   * API 4: Get Failed Records
   */
  @Get('import/:id/failed-records')
  @ApiOperation({
    summary: 'Get Failed Records',
    description: 'Returns all invalid records and their specific validation failure reasons.',
  })
  @ApiParam({ name: 'id', description: 'Import ID (e.g. IMP-1001)' })
  @ApiResponse({ status: 200, description: 'Paginated list of failed records' })
  @ApiResponse({ status: 404, description: 'Import job not found' })
  async getFailedRecords(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.usersService.getFailedRecords(id, query);
  }

  /**
   * API 5: Download Failed Excel
   * Streams an Excel file containing failed records and error reasons
   */
  @Get('import/:id/download-failed')
  @ApiOperation({
    summary: 'Download Failed Records Excel',
    description: 'Generates and downloads a styled .xlsx file containing all invalid records.',
  })
  @ApiParam({ name: 'id', description: 'Import ID (e.g. IMP-1001)' })
  @ApiResponse({
    status: 200,
    description: 'Excel file (.xlsx) stream download',
  })
  @ApiResponse({ status: 404, description: 'Import job not found' })
  async downloadFailedRecords(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.usersService.generateFailedExcel(id);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }
}
