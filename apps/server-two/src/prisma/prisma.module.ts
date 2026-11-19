/**
 * PrismaModule
 *
 * Provides PrismaService as a shared database client across all modules.
 * Marked as @Global() so any module can inject PrismaService without
 * needing to explicitly re-import PrismaModule every time.
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
