import * as request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp, E2eContext, successBody } from './support/e2e-app';

describe('AppController (e2e)', () => {
  let context: E2eContext;
  let server: App;

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await context.app.close();
  });

  it('GET /api/v1/health → 200, envelope chuẩn, DB up (endpoint @Public)', async () => {
    const response = await request(server).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'ok', database: 'up' },
    });
    expect(
      typeof successBody<{ status: string; database: string }>(response)
        .timestamp,
    ).toBe('string');
  });

  it('endpoint scaffold POST /api/v1/health/validate-test đã được xoá → 404', async () => {
    await request(server)
      .post('/api/v1/health/validate-test')
      .send({ name: 'x' })
      .expect(404);
  });
});
