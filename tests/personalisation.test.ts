import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { fixture } from './fixtures';
import { ApplicationRepository } from '../server/repository';
vi.mock('../server/services/models', () => ({ validateModel: vi.fn(), listModels: vi.fn() }));
vi.mock('../server/services/agent', () => ({ analyseJob: vi.fn(), draftDocuments: vi.fn(), reviseDocuments: vi.fn() }));
import { analyseJob, draftDocuments, reviseDocuments } from '../server/services/agent';
import { createApp } from '../server/app';

const notes = 'I am a runner and would enjoy working on a product I would use.';
let repository: ApplicationRepository;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  vi.clearAllMocks(); repository = new ApplicationRepository(':memory:'); app = createApp(repository);
  vi.mocked(analyseJob).mockResolvedValue(fixture.job);
  vi.mocked(draftDocuments).mockResolvedValue(fixture.documents);
  vi.mocked(reviseDocuments).mockResolvedValue(fixture.documents);
});
afterEach(() => repository.close());

describe('cover-letter personalisation', () => {
  it('passes initial notes to generation and saves them with the application', async () => {
    const response = await request(app).post('/api/applications').send({ url: fixture.url, model: fixture.model, jobText: 'A frontend role building React and TypeScript applications for runners, collaborating with designers to create accessible interfaces.', coverLetterPersonalisation: `  ${notes}  ` });
    expect(response.status).toBe(201);
    expect(draftDocuments).toHaveBeenCalledWith(expect.any(Object), fixture.job, expect.any(Object), fixture.model, notes);
    expect((await request(app).get(`/api/applications/${response.body.id}`)).body.coverLetterPersonalisation).toBe(notes);
  });
  it.each(['regenerate', 'revise'])('retains saved notes when %s omits the field and allows explicitly clearing them', async action => {
    repository.create({ ...fixture, coverLetterPersonalisation: notes });
    const response = await request(app).post(`/api/applications/${fixture.id}/${action}`).send({ model: fixture.model, version: 1, instructions: 'Shorten the letter.' });
    expect(response.status).toBe(200);
    expect(response.body.coverLetterPersonalisation).toBe(notes);
    if (action === 'regenerate') expect(draftDocuments).toHaveBeenLastCalledWith(expect.any(Object), fixture.job, fixture.templates, fixture.model, notes);
    else expect(reviseDocuments).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({ coverLetterPersonalisation: notes }), 'Shorten the letter.', fixture.model);
    const cleared = await request(app).post(`/api/applications/${fixture.id}/${action}`).send({ model: fixture.model, version: 2, coverLetterPersonalisation: '' });
    expect(cleared.status).toBe(200);
    expect(repository.get(fixture.id).coverLetterPersonalisation).toBe('');
    if (action === 'regenerate') expect(draftDocuments).toHaveBeenLastCalledWith(expect.any(Object), fixture.job, fixture.templates, fixture.model, '');
    else expect(reviseDocuments).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({ coverLetterPersonalisation: '' }), '', fixture.model);
  });
  it('adds personalisation to an older draft without a separate revision instruction', async () => {
    repository.create(fixture);
    const response = await request(app).post(`/api/applications/${fixture.id}/revise`).send({ model: fixture.model, version: 1, coverLetterPersonalisation: notes });
    expect(response.status).toBe(200);
    expect(response.body.coverLetterPersonalisation).toBe(notes);
    expect(response.body.revisions[0].instructions).toBe('Updated cover-letter personalisation.');
  });
  it('keeps the saved notes and documents when generation fails', async () => {
    repository.create({ ...fixture, coverLetterPersonalisation: notes });
    vi.mocked(reviseDocuments).mockRejectedValueOnce(new Error('Provider unavailable'));
    const response = await request(app).post(`/api/applications/${fixture.id}/revise`).send({ model: fixture.model, version: 1, coverLetterPersonalisation: 'Updated notes.' });
    expect(response.status).toBe(500);
    expect(repository.get(fixture.id)).toEqual({ ...fixture, coverLetterPersonalisation: notes });
  });
  it('rejects oversized notes and empty requests before calling the agent', async () => {
    repository.create(fixture);
    for (const action of ['revise', 'regenerate']) {
      expect((await request(app).post(`/api/applications/${fixture.id}/${action}`).send({ model: fixture.model, version: 1, coverLetterPersonalisation: 'x'.repeat(3001) })).status).toBe(400);
    }
    expect((await request(app).post(`/api/applications/${fixture.id}/revise`).send({ model: fixture.model, version: 1 })).status).toBe(400);
    expect(reviseDocuments).not.toHaveBeenCalled(); expect(draftDocuments).not.toHaveBeenCalled();
  });
});
