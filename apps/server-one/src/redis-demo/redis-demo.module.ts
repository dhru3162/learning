import { Module } from '@nestjs/common';
import { RedisDemoController } from './redis-demo.controller.js';
import { RedisDemoService } from './redis-demo.service.js';

@Module({
  controllers: [RedisDemoController],
  providers: [RedisDemoService],
})
export class RedisDemoModule {}
