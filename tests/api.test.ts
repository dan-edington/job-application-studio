import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { fixture } from './fixtures';
import { ApplicationRepository } from '../server/repository';

vi.mock('../server/services/models', () => ({
  validateModel: vi.fn(),
  listModels: vi.fn(async () => ({ models: ['gpt-5-mini'], warning: null })),
}));
vi.mock('../server/services/agent', () => ({
  analyseJob: vi.fn(),
  draftDocuments: vi.fn(),
  reviseDocuments: vi.fn(),
}));
import {
  analyseJob,
  draftDocuments,
  reviseDocuments,
} from '../server/services/agent';
import { createApp } from '../server/app';
const repository = new ApplicationRepository(':memory:');
const app = createApp(repository);
beforeEach(() => {
  vi.mocked(analyseJob).mockResolvedValue(fixture.job);
  vi.mocked(draftDocuments).mockResolvedValue(fixture.documents);
  vi.mocked(reviseDocuments).mockResolvedValue({
    ...fixture.documents,
    cv: {
      ...fixture.documents.cv,
      experience: [
        {
          ...fixture.documents.cv.experience[0],
          bullets: [
            'Used React and TypeScript to build a solar design tool so installers could plan rooftop panel layouts.',
          ],
        },
      ],
    },
  });
});
afterAll(() => repository.close());

describe('application API', () => {
  it('validates input and rejects cross-origin mutation', async () => {
    expect(
      (
        await request(app)
          .post('/api/applications')
          .send({ url: 'file:///private' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/applications')
          .set('Origin', 'https://untrusted.example')
          .send({})
      ).status,
    ).toBe(403);
  });
  it('generates, saves, revises and exports both PDFs', async () => {
    const created = await request(app).post('/api/applications').send({
      url: fixture.url,
      jobText:
        'Senior frontend role building accessible React applications with TypeScript, collaborating with designers and backend engineers.',
      model: 'gpt-5-mini',
      cvTemplate: 'editorial',
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(created.body.templates.cv.id).toBe('editorial');
    expect(
      (await request(app).get(`/api/applications/${id}`)).body.version,
    ).toBe(1);
    const revised = await request(app)
      .post(`/api/applications/${id}/revise`)
      .send({
        instructions: 'Lead the first bullet with the relevant technologies.',
        model: 'gpt-5-mini',
        version: 1,
      });
    expect(revised.status).toBe(200);
    expect(revised.body.version).toBe(2);
    expect(revised.body.documents.cv.experience[0].bullets[0]).toBe(
      'Used React and TypeScript to build a solar design tool so installers could plan rooftop panel layouts.',
    );
    expect(revised.body.revisions).toHaveLength(1);
    for (const kind of ['cv', 'coverLetter']) {
      const response = await request(app).get(
        `/api/applications/${id}/pdf/${kind}?download=1`,
      );
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.subarray(0, 5).toString()).toBe('%PDF-');
    }
    const stale = await request(app)
      .post(`/api/applications/${id}/revise`)
      .send({
        instructions: 'Another revision.',
        model: 'gpt-5-mini',
        version: 1,
      });
    expect(stale.status).toBe(409);
  });
  it('keeps the last draft when an AI revision fails', async () => {
    repository.create(fixture);
    vi.mocked(reviseDocuments).mockRejectedValueOnce(
      new Error('Provider failed'),
    );
    const result = await request(app)
      .post(`/api/applications/${fixture.id}/revise`)
      .send({
        instructions: 'Make the letter shorter.',
        model: 'gpt-5-mini',
        version: 1,
      });
    expect(result.status).toBe(500);
    expect(repository.get(fixture.id)).toEqual(fixture);
  });
  it('returns JSON for missing applications and API routes', async () => {
    expect((await request(app).get('/api/applications/missing')).status).toBe(
      404,
    );
    expect((await request(app).get('/api/missing')).body.error).toBe(
      'API endpoint not found.',
    );
  });
});
