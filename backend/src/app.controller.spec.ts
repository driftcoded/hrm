import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';

/** Minimal `Response` double — the controller only calls `status()`. */
function responseDouble(): Response & { status: jest.Mock } {
  const response = { status: jest.fn() };

  return response as unknown as Response & { status: jest.Mock };
}

async function buildController(
  query: jest.Mock,
): Promise<{ controller: AppController }> {
  const app: TestingModule = await Test.createTestingModule({
    controllers: [AppController],
    providers: [
      AppService,
      { provide: getDataSourceToken(), useValue: { query } },
    ],
  }).compile();

  return { controller: app.get<AppController>(AppController) };
}

describe('AppController', () => {
  describe('health', () => {
    it('reports ok and answers 200 when the DB is reachable', async () => {
      const { controller } = await buildController(
        jest.fn().mockResolvedValue([{ 1: 1 }]),
      );
      const response = responseDouble();

      const result = await controller.getHealth(response);

      expect(result.status).toBe('ok');
      expect(result.database).toBe('up');
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    /**
     * The status code is what a load balancer acts on — it never reads the body.
     * A 200 here would keep an instance in rotation that cannot serve a query.
     */
    it('answers 503 when the DB query fails', async () => {
      const { controller } = await buildController(
        jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      );
      const response = responseDouble();

      const result = await controller.getHealth(response);

      expect(result.status).toBe('error');
      expect(result.database).toBe('down');
      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });
});
