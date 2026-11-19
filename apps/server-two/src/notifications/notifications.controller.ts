import { Controller, Post, Body, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('welcome')
  async sendWelcomeEmail(@Body('email') email: string) {
    return this.notificationsService.sendWelcomeEmail(email);
  }

  @Get('clear')
  async clearPendingJobs() {
    return this.notificationsService.clearPendingJobs();
  }
}
