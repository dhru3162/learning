import { Test, TestingModule } from '@nestjs/testing';
import { RedisDemoController } from './redis-demo.controller.js';

describe('RedisDemoController', () => {
  let controller: RedisDemoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RedisDemoController],
    }).compile();

    controller = module.get<RedisDemoController>(RedisDemoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
