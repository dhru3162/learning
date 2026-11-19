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

  @Post('webhook')
  postWebhook(@Body() body: any, @Headers() headers: any): any {
    return this.appService.postWebhook(body, headers);
  }
}
