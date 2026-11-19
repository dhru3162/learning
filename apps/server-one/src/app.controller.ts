import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; server: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Post('api/register-webhook')
  registerWebhook(@Body() body: any): Promise<{ message: string }> {
    return this.appService.registerWebhook(body);
  }

  @Post('api/purchase')
  purchase(@Body() body: any): Promise<{ message: string }> {
    return this.appService.purchase(body);
  }
}
