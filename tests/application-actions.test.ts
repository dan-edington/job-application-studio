import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { fixture } from './fixtures';
import { ApplicationRepository } from '../server/repository';

vi.mock('../server/services/models', () => ({
  validateModel: vi.fn(),
  listModels: vi.fn(),
}));
vi.mock('../server/services/agent', () => ({
  analyseJob: vi.fn(),
  draftDocuments: vi.fn(),
  reviseDocuments: vi.fn(),
}));
import {
  draftDocuments,
  reviseDocuments,
  analyseJob,
} from '../server/services/agent';
import { createApp } from '../server/app';

let repository: ApplicationRepository;
let app: ReturnType<typeof createApp>;
const original = {
  ...fixture,
  version: 2,
  revisions: [
    {
      instructions: 'Previous requested changes.',
      date: fixture.updatedAt,
      version: 2,
    },
  ],
};
const regenerated = {
  ...fixture.documents,
  cv: {
    ...fixture.documents.cv,
    experience: [
      {
        ...fixture.documents.cv.experience[0],
        bullets: ['Freshly generated experience bullet.'],
      },
    ],
  },
  coverLetter: {
    ...fixture.documents.coverLetter,
    paragraphs: ['Fresh letter introduction.', 'Fresh closing paragraph.'],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  repository = new ApplicationRepository(':memory:');
  app = createApp(repository);
  repository.create(original);
  vi.mocked(draftDocuments).mockResolvedValue(regenerated);
  vi.mocked(reviseDocuments).mockResolvedValue(regenerated);
});
afterEach(() => repository.close());

describe('delete application', () => {
  it('removes the application from storage, history and PDF access', async () => {
    expect(
      (
        await request(app)
          .delete(`/api/applications/${fixture.id}`)
          .send({ version: 2 })
      ).status,
    ).toBe(204);
    expect((await request(app).get('/api/applications')).body).toEqual([]);
    expect(
      (await request(app).get(`/api/applications/${fixture.id}`)).status,
    ).toBe(404);
    expect(
      (await request(app).get(`/api/applications/${fixture.id}/pdf/cv`)).status,
    ).toBe(404);
  });
  it('rejects stale or invalid deletion requests without removing the draft', async () => {
    expect(
      (
        await request(app)
          .delete(`/api/applications/${fixture.id}`)
          .send({ version: 1 })
      ).status,
    ).toBe(409);
    expect(
      (await request(app).delete(`/api/applications/${fixture.id}`).send({}))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(`/api/applications/${fixture.id}`)
          .set('Origin', 'https://untrusted.example')
          .send({ version: 2 })
      ).status,
    ).toBe(403);
    expect(repository.get(fixture.id)).toEqual(original);
    expect(
      (
        await request(app)
          .delete('/api/applications/missing')
          .send({ version: 1 })
      ).status,
    ).toBe(404);
  });
});

describe('regenerate application', () => {
  it('replaces both documents in place and uses the saved job and templates', async () => {
    const response = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({ model: 'gpt-5-nano', version: 2 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: original.id,
      url: original.url,
      createdAt: original.createdAt,
      templates: original.templates,
      job: original.job,
      model: 'gpt-5-nano',
      version: 3,
      revisions: [],
      documents: regenerated,
    });
    expect(draftDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        personal: expect.objectContaining({
          headlineOptions: expect.any(Array),
        }),
      }),
      original.job,
      original.templates,
      'gpt-5-nano',
      '',
      'both',
    );
    expect(analyseJob).not.toHaveBeenCalled();
    expect(reviseDocuments).not.toHaveBeenCalled();
    expect(repository.list()).toHaveLength(1);
    const revised = await request(app)
      .post(`/api/applications/${fixture.id}/revise`)
      .send({
        instructions: 'Tighten the cover letter.',
        model: 'gpt-5-nano',
        version: 3,
      });
    expect(revised.body.revisions[0].version).toBe(4);
  });
  it('keeps both documents and their history if generation fails', async () => {
    vi.mocked(draftDocuments).mockRejectedValueOnce(
      new Error('Provider unavailable'),
    );
    const response = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({ model: 'gpt-5-nano', version: 2 });
    expect(response.status).toBe(500);
    expect(repository.get(fixture.id)).toEqual(original);
  });
  it('rejects stale requests before making an AI call', async () => {
    expect(
      (
        await request(app)
          .post(`/api/applications/${fixture.id}/regenerate`)
          .send({ model: 'gpt-5-nano', version: 1 })
      ).status,
    ).toBe(409);
    expect(draftDocuments).not.toHaveBeenCalled();
  });
  it('does not overwrite a concurrent change', async () => {
    const newer = { ...original, version: 3, model: 'another-model' };
    vi.mocked(draftDocuments).mockImplementationOnce(async () => {
      repository.update(newer, 2);
      return regenerated;
    });
    const response = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({ model: 'gpt-5-nano', version: 2 });
    expect(response.status).toBe(409);
    expect(repository.get(fixture.id)).toEqual(newer);
  });
  it('does not recreate an application deleted while generation was running', async () => {
    vi.mocked(draftDocuments).mockImplementationOnce(async () => {
      repository.delete(fixture.id, 2);
      return regenerated;
    });
    const response = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({ model: 'gpt-5-nano', version: 2 });
    expect(response.status).toBe(409);
    expect(repository.list()).toEqual([]);
  });
});
