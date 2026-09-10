import { getDataSourceToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: getDataSourceToken(), useValue: { query: jest.fn().mockResolvedValue([]) } }],
    }).compile();
  });

  describe('getHealth', () => {
    it('should report the service as healthy', async () => {
      const appController = app.get<AppController>(AppController);
      await expect(appController.getHealth()).resolves.toEqual({ status: 'ok', service: 'ticket-service' });
    });
  });
});
