/**
 * DTOs for User Import APIs
 */

import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ImportStatus } from '@prisma/client';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ImportHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportStatus, {
    message: 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED',
  })
  status?: ImportStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
