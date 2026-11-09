import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { fixture } from './fixtures';
import { generateSchema } from '../shared/schema';
import { isMissingCompanyName } from '../shared/company-name';
import { ApplicationRepository } from '../server/repository';
import { AppError } from '../server/config';

vi.mock('../server/services/models', () => ({
  validateModel: vi.fn(),
  listModels: vi.fn(),
}));
vi.mock('../server/services/agent', () => ({
  analyseJob: vi.fn(),
  draftDocuments: vi.fn(),
  reviseDocuments: vi.fn(),
}));
vi.mock('../server/services/job', () => ({ readJob: vi.fn() }));
import { readJob } from '../server/services/job';
import { analyseJob, draftDocuments } from '../server/services/agent';
import { createApp } from '../server/app';

const jobText =
  'Senior frontend role building accessible React applications with TypeScript, collaborating with designers and backend engineers.';
const input = { model: fixture.model, jobText };
let repository: ApplicationRepository;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  vi.resetAllMocks();
  repository = new ApplicationRepository(':memory:');
  app = createApp(repository);
  vi.mocked(readJob).mockResolvedValue(jobText);
  vi.mocked(analyseJob).mockResolvedValue(structuredClone(fixture.job));
  vi.mocked(draftDocuments).mockResolvedValue(fixture.documents);
});
afterEach(() => {
  repository.close();
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('URL or pasted job description', () => {
  it.each([{ jobText }, { url: fixture.url }, { url: fixture.url, jobText }])(
    'accepts either source or both: %j',
    async (source) => {
      const response = await request(app)
        .post('/api/applications')
        .send({ model: fixture.model, ...source });
      expect(response.status).toBe(201);
      expect(readJob).toHaveBeenCalledWith(
        'url' in source ? source.url : '',
        'jobText' in source ? jobText : '',
      );
      expect(response.body.url).toBe('url' in source ? source.url : '');
      expect(repository.get(response.body.id).url).toBe(response.body.url);
    },
  );

  it.each([
    {},
    { jobText: '   ' },
    { jobText: 'Too short.' },
    { url: 'file:///private', jobText },
    { url: 'invalid', jobText },
  ])('rejects invalid source input before any work: %j', async (source) => {
    expect(
      (
        await request(app)
          .post('/api/applications')
          .send({ model: fixture.model, ...source })
      ).status,
    ).toBe(400);
    expect(readJob).not.toHaveBeenCalled();
    expect(analyseJob).not.toHaveBeenCalled();
  });

  it('normalises whitespace in either source', () => {
    expect(
      generateSchema.parse({ ...input, url: '  ', jobText: `  ${jobText}  ` }),
    ).toMatchObject({ url: '', jobText });
  });
});

describe('missing company continuation', () => {
  it.each(['both', 'cv', 'coverLetter'] as const)(
    'asks before writing %s and resumes with the supplied company',
    async (documentSelection) => {
      vi.mocked(analyseJob).mockResolvedValue({
        ...fixture.job,
        company: 'Not specified',
      });
      const pending = await request(app)
        .post('/api/applications')
        .send({
          ...input,
          documentSelection,
          coverLetterPersonalisation: 'I am a runner.',
        });
      expect(pending.status).toBe(202);
      expect(pending.body).toEqual({
        status: 'company_name_required',
        token: expect.any(String),
        jobTitle: fixture.job.title,
      });
      expect(draftDocuments).not.toHaveBeenCalled();
      expect(repository.list()).toEqual([]);
      const completed = await request(app)
        .post('/api/applications/complete')
        .send({ token: pending.body.token, companyName: '  Running Studio  ' });
      expect(completed.status).toBe(201);
      expect(completed.body.job.company).toBe('Running Studio');
      expect(completed.body.url).toBe('');
      expect(draftDocuments).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ company: 'Running Studio' }),
        expect.any(Object),
        fixture.model,
        'I am a runner.',
        documentSelection,
      );
      expect(analyseJob).toHaveBeenCalledTimes(1);
      expect(readJob).toHaveBeenCalledTimes(1);
      expect(repository.get(completed.body.id).job.company).toBe(
        'Running Studio',
      );
      expect(
        (
          await request(app)
            .post('/api/applications/complete')
            .send({ token: pending.body.token, companyName: 'Duplicate' })
        ).status,
      ).toBe(410);
      expect(repository.list()).toHaveLength(1);
    },
  );

  it('rejects empty names and placeholders while retaining the analysis', async () => {
    vi.mocked(analyseJob).mockResolvedValue({
      ...fixture.job,
      company: 'Unknown',
    });
    const pending = await request(app).post('/api/applications').send(input);
    for (const companyName of ['   ', 'Not specified', 'x'.repeat(201)])
      expect(
        (
          await request(app)
            .post('/api/applications/complete')
            .send({ token: pending.body.token, companyName })
        ).status,
      ).toBe(400);
    expect(draftDocuments).not.toHaveBeenCalled();
    expect(
      (
        await request(app)
          .post('/api/applications/complete')
          .send({ token: pending.body.token, companyName: 'Real Company' })
      ).status,
    ).toBe(201);
    expect(analyseJob).toHaveBeenCalledTimes(1);
  });

  it('keeps the pending analysis when writing fails so the user can retry', async () => {
    vi.mocked(analyseJob).mockResolvedValue({
      ...fixture.job,
      company: 'Not specified',
    });
    const pending = await request(app).post('/api/applications').send(input);
    const complete = {
      token: pending.body.token,
      companyName: 'Running Studio',
    };
    vi.mocked(draftDocuments).mockRejectedValueOnce(
      new AppError(502, 'Please retry.'),
    );
    expect(
      (await request(app).post('/api/applications/complete').send(complete))
        .status,
    ).toBe(502);
    expect(repository.list()).toEqual([]);
    expect(
      (await request(app).post('/api/applications/complete').send(complete))
        .status,
    ).toBe(201);
    expect(analyseJob).toHaveBeenCalledTimes(1);
  });

  it('expires unused continuations without writing documents', async () => {
    vi.mocked(analyseJob).mockResolvedValue({
      ...fixture.job,
      company: 'Not specified',
    });
    const pending = await request(app).post('/api/applications').send(input);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60 * 1000);
    const response = await request(app)
      .post('/api/applications/complete')
      .send({ token: pending.body.token, companyName: 'Running Studio' });
    expect(response.status).toBe(410);
    expect(response.body.error).toContain('expired');
    expect(draftDocuments).not.toHaveBeenCalled();
  });

  it('prevents concurrent completions from creating duplicate applications', async () => {
    vi.mocked(analyseJob).mockResolvedValue({
      ...fixture.job,
      company: 'Not specified',
    });
    const pending = await request(app).post('/api/applications').send(input);
    const body = { token: pending.body.token, companyName: 'Running Studio' };
    const started = deferred<void>();
    const writing = deferred<typeof fixture.documents>();
    vi.mocked(draftDocuments).mockImplementationOnce(() => {
      started.resolve();
      return writing.promise;
    });
    const first = request(app)
      .post('/api/applications/complete')
      .send(body)
      .then((response) => response);
    await started.promise;
    expect(
      (await request(app).post('/api/applications/complete').send(body)).status,
    ).toBe(409);
    writing.resolve(fixture.documents);
    expect((await first).status).toBe(201);
    expect(repository.list()).toHaveLength(1);
  });

  it.each([
    '',
    '  ',
    'Not specified',
    'UNKNOWN',
    'N/A',
    'Confidential',
    'Company not provided.',
  ])('recognises missing company: %j', (company) => {
    expect(isMissingCompanyName(company)).toBe(true);
  });
  it('preserves real company names containing placeholder words', () => {
    expect(isMissingCompanyName('Unknown Worlds')).toBe(false);
    expect(isMissingCompanyName('Confidential Computing Ltd')).toBe(false);
  });
});
