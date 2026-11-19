import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello from server-two!"', () => {
      expect(appController.getHello()).toBe('Hello from server-two!');
    });
  });

  describe('health', () => {
    it('should return health status with timestamp', () => {
      const health = appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.server).toBe('server-two');
      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).toISOString()).toBe(health.timestamp);
    });
  });
});
