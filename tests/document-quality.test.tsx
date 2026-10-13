import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import request from 'supertest';
import { fixture } from './fixtures';
import { documentQualityIssues, documentQualityMessage } from '../shared/document-quality';
import { DocumentPreview } from '../src/components/DocumentPreview';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('ai', async importOriginal => ({ ...await importOriginal<typeof import('ai')>(), generateText: generate }));
vi.mock('../server/services/models', () => ({ validateModel: vi.fn(), listModels: vi.fn() }));
import { draftDocuments, reviseDocuments } from '../server/services/agent';
import { loadCareer } from '../server/services/career';
import { ApplicationRepository } from '../server/repository';
import { createApp } from '../server/app';

const reportedParagraphs = [
  'paragraphsAppendix1EvidenceName1and2WeighingThisParagraphs please replace after creation. Also ensure this paragraph communicates concrete project work at Fuze and ON that demonstrates growth-oriented thinking and end-to-end delivery.',
  'paragraphsAppendix2GrowthFocus I have shipped growth-oriented features and contributed to scalable design systems, performance improvements and robust testing practices across multiple roles, including CMS-driven experiences with Next.js and TypeScript.',
  'paragraphsAppendix3Closing I would welcome the opportunity to discuss how my background could help Runna accelerate growth, instrument experiments and improve developer experience across web and app platforms.',
];
function unfinishedDocuments(paragraphs = reportedParagraphs) {
  return { ...structuredClone(fixture.documents), coverLetter: { ...fixture.documents.coverLetter, paragraphs } };
}
let repository: ApplicationRepository;
beforeEach(() => { generate.mockReset(); repository = new ApplicationRepository(':memory:'); });
afterEach(() => repository.close());

describe('finished-document validation', () => {
  it.each([...reportedParagraphs, 'Please replace after creation.', 'Ensure this paragraph describes relevant work.', '[Insert relevant project here]', '{{companyName}}', 'Paragraph 1: I build web applications.', 'TODO: add a closing paragraph.', '   '])('rejects drafting artefact: %s', paragraph => {
    expect(documentQualityIssues(unfinishedDocuments([paragraph, fixture.documents.coverLetter.paragraphs[1]]))).toContain('coverLetter.paragraphs[0]');
  });
  it('checks CV text as well as cover letters', () => {
    const documents = structuredClone(fixture.documents);
    documents.cv.experience[0].bullets[0] = '[Add a relevant achievement]';
    expect(documentQualityIssues(documents)).toEqual(['cv.experience[0].bullets[0]']);
  });
  it('allows ordinary prose and review notes outside the finished documents', () => {
    const documents = structuredClone(fixture.documents);
    documents.coverLetter.paragraphs = ['I built a CMS editor to let writers replace text and reorder paragraphs.', 'I created templates and an appendix for the documentation to help developers use the tools.'];
    documents.cautions = ['Please replace this paragraph if further evidence becomes available.'];
    expect(documentQualityIssues(documents)).toEqual([]);
  });
  it('hides a malformed saved letter and disables export without hiding the valid CV', () => {
    const application = { ...fixture, documents: unfinishedDocuments() };
    const $ = load(renderToStaticMarkup(<DocumentPreview application={application} kind="coverLetter" busy={false}/>));
    expect($('[role="alert"]').text()).toBe(documentQualityMessage);
    expect($('button').prop('disabled')).toBe(true);
    expect($('.letter-content, a').length).toBe(0);
    expect($.text()).not.toContain('paragraphsAppendix');
    const cv = load(renderToStaticMarkup(<DocumentPreview application={application} kind="cv" busy={false}/>));
    expect(cv('button').prop('disabled')).toBe(false);
    expect(cv('.paper').text()).toContain('Fuze Software');
  });
});

describe('generation quality gate', () => {
  it('includes personal context in draft and repair prompts without changing the career master', async () => {
    generate.mockResolvedValueOnce({ output: unfinishedDocuments() }).mockResolvedValueOnce({ output: fixture.documents });
    const career = await loadCareer(); const original = structuredClone(career);
    await draftDocuments(career, fixture.job, fixture.templates, fixture.model, 'I am a runner.');
    expect(JSON.parse(generate.mock.calls[0][0].prompt).coverLetterPersonalisation).toBe('I am a runner.');
    expect(JSON.parse(generate.mock.calls[1][0].prompt).originalRequest.coverLetterPersonalisation).toBe('I am a runner.');
    expect(career).toEqual(original);
  });
  it('preserves the CV on a personalisation-only revision and sends cleared notes explicitly', async () => {
    const generated = structuredClone(fixture.documents);
    generated.cv.experience[0].bullets = ['An unnecessary CV rewrite.'];
    generate.mockResolvedValueOnce({ output: generated });
    const result = await reviseDocuments(await loadCareer(), { ...fixture, coverLetterPersonalisation: '' }, '', fixture.model);
    expect(result.cv).toEqual(fixture.documents.cv);
    expect(JSON.parse(generate.mock.calls[0][0].prompt)).toMatchObject({ coverLetterPersonalisation: '', personalisationOnly: true });
  });
  it('returns a clean first draft without a repair call', async () => {
    generate.mockResolvedValueOnce({ output: fixture.documents });
    const result = await draftDocuments(await loadCareer(), fixture.job, fixture.templates, fixture.model);
    expect(result.coverLetter.paragraphs).toEqual(fixture.documents.coverLetter.paragraphs);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each(['draft', 'revision'])('repairs a malformed %s with the original facts and validates the replacement', async flow => {
    generate.mockResolvedValueOnce({ output: unfinishedDocuments() }).mockResolvedValueOnce({ output: fixture.documents });
    const career = await loadCareer();
    const result = flow === 'draft'
      ? await draftDocuments(career, fixture.job, fixture.templates, fixture.model)
      : await reviseDocuments(career, fixture, 'Shorten the letter.', fixture.model);
    expect(result.coverLetter.paragraphs).toEqual(fixture.documents.coverLetter.paragraphs);
    expect(generate).toHaveBeenCalledTimes(2);
    const repair = JSON.parse(generate.mock.calls[1][0].prompt);
    expect(repair.originalRequest.career).toEqual(career);
    expect(repair.originalRequest.job).toEqual(fixture.job);
    expect(repair.qualityFeedback.fields).toEqual(['coverLetter.paragraphs[0]', 'coverLetter.paragraphs[1]', 'coverLetter.paragraphs[2]']);
    if (flow === 'revision') expect(repair.originalRequest.requestedChanges).toBe('Shorten the letter.');
  });
  it.each(['create', 'regenerate', 'revise'])('rejects repeated bad output during %s without saving it', async flow => {
    const app = createApp(repository);
    if (flow === 'create') generate.mockResolvedValueOnce({ output: { isJobPosting: true, job: fixture.job } });
    else repository.create(fixture);
    generate.mockResolvedValue({ output: unfinishedDocuments() });
    const response = flow === 'create'
      ? await request(app).post('/api/applications').send({ url: fixture.url, jobText: 'A frontend engineer role building React and TypeScript web applications, collaborating with designers to create accessible interfaces.', model: fixture.model })
      : await request(app).post(`/api/applications/${fixture.id}/${flow}`).send({ version: 1, model: fixture.model, instructions: 'Shorten the letter.' });
    expect(response.status).toBe(502);
    expect(response.body.error).toContain('unfinished drafting text');
    expect(response.body.error).not.toContain('paragraphsAppendix');
    expect(generate).toHaveBeenCalledTimes(flow === 'create' ? 3 : 2);
    if (flow === 'create') expect(repository.list()).toEqual([]);
    else expect(repository.get(fixture.id)).toEqual(fixture);
  });
  it('keeps a saved draft if the repair request fails', async () => {
    repository.create(fixture);
    generate.mockResolvedValueOnce({ output: unfinishedDocuments() }).mockRejectedValueOnce(new Error('Provider unavailable'));
    const response = await request(createApp(repository)).post(`/api/applications/${fixture.id}/regenerate`).send({ version: 1, model: fixture.model });
    expect(response.status).toBe(502);
    expect(repository.get(fixture.id)).toEqual(fixture);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it('blocks direct PDF downloads for malformed saved letters while allowing valid CVs', async () => {
    repository.create({ ...fixture, documents: unfinishedDocuments() });
    const app = createApp(repository);
    const letter = await request(app).get(`/api/applications/${fixture.id}/pdf/coverLetter?download=1`);
    expect(letter.status).toBe(422);
    expect(letter.body.error).toBe(documentQualityMessage);
    expect((await request(app).get(`/api/applications/${fixture.id}/pdf/cv`)).status).toBe(200);
  });
});
