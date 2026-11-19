import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { RedisDemoService } from './redis-demo.service.js';

@Controller('redis')
export class RedisDemoController {
  constructor(private readonly redisDemoService: RedisDemoService) {}

  @Get('users')
  getUsers() {
    return this.redisDemoService.getMockUsers();
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.redisDemoService.getMockUserById(id);
  }

  @Post('users')
  createUser(@Body() body: any) {
    return this.redisDemoService.createMockUser(body);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.redisDemoService.updateMockUser(id, body);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.redisDemoService.deleteMockUser(id);
  }

  @Post(':key')
  create(@Param('key') key: string, @Body() body: any) {
    return this.redisDemoService.create(key, body);
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.redisDemoService.findOne(key);
  }

  @Put(':key')
  update(@Param('key') key: string, @Body() body: any) {
    return this.redisDemoService.update(key, body);
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.redisDemoService.remove(key);
  }
}
