/**
 * UsersModule
 *
 * Connects UsersController, UsersService, PrismaModule and ImportModule.
 */

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { ImportModule } from '../import/import.module.js';

@Module({
  imports: [ImportModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
