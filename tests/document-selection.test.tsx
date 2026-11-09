import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement, type ReactNode } from 'react';
import request from 'supertest';
import { fixture } from './fixtures';
import type {
  Application,
  ApplicationDocuments,
  DocumentSelection,
} from '../shared/schema';
import {
  selectedDocumentKinds,
  savedDocumentSelection,
} from '../shared/document-selection';
import { ApplicationPdf } from '../shared/pdf';
import { DocumentPreview } from '../src/components/DocumentPreview';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: generate,
}));
vi.mock('../server/services/models', () => ({
  validateModel: vi.fn(),
  listModels: vi.fn(),
}));
import { createApp } from '../server/app';
import { ApplicationRepository } from '../server/repository';
import { careerApplicant, loadCareer } from '../server/services/career';
import { draftDocuments, reviseDocuments } from '../server/services/agent';

let repository: ApplicationRepository;
beforeEach(() => {
  repository = new ApplicationRepository(':memory:');
  generate.mockReset();
});
afterEach(() => repository.close());

function selectedDocuments(selection: DocumentSelection): ApplicationDocuments {
  const { cv, coverLetter, ...shared } = structuredClone(fixture.documents);
  return {
    ...shared,
    ...(selection !== 'coverLetter' ? { cv } : {}),
    ...(selection !== 'cv' ? { coverLetter } : {}),
  };
}

function textNodes(node: ReactNode): string[] {
  if (typeof node === 'string' || typeof node === 'number')
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textNodes);
  return isValidElement<{ children?: ReactNode }>(node)
    ? textNodes(node.props.children)
    : [];
}

async function expectScope(
  callIndex: number,
  selection: DocumentSelection,
  repair = false,
) {
  const options = generate.mock.calls[callIndex][0];
  const format = await options.output.responseFormat;
  const keys = [
    ...selectedDocumentKinds(selection),
    'evidence',
    'cautions',
  ].sort();
  expect(Object.keys(format.schema.properties).sort()).toEqual(keys);
  expect([...format.schema.required].sort()).toEqual(keys);
  const payload = JSON.parse(options.prompt);
  const original = repair ? payload.originalRequest : payload;
  expect(original.requestedDocuments).toEqual(selectedDocumentKinds(selection));
  expect(Object.keys(original.templates).sort()).toEqual(
    selectedDocumentKinds(selection).sort(),
  );
  if (selection === 'cv')
    expect(original).not.toHaveProperty('coverLetterPersonalisation');
}

describe('selective document generation', () => {
  it.each(['both', 'cv', 'coverLetter'] as const)(
    'creates, saves, previews and downloads %s',
    async (selection) => {
      generate.mockResolvedValueOnce({
        output: { isJobPosting: true, job: fixture.job },
      });
      generate.mockResolvedValueOnce({ output: selectedDocuments(selection) });
      const app = createApp(repository);
      const response = await request(app)
        .post('/api/applications')
        .send({
          url: fixture.url,
          model: fixture.model,
          documentSelection: selection,
          jobText:
            'A frontend role building React and TypeScript applications, collaborating with designers to create accessible interfaces.',
          // Irrelevant template choices must not block a single-document request.
          cvTemplate: selection === 'coverLetter' ? 'missing' : 'standard',
          letterTemplate: selection === 'cv' ? 'missing' : 'standard',
          coverLetterPersonalisation: 'I am a runner.',
        });
      expect(response.status).toBe(201);
      const application: Application = response.body;
      expect(savedDocumentSelection(application.documents)).toBe(selection);
      expect(repository.get(application.id)).toEqual(application);
      await expectScope(1, selection);
      expect(generate).toHaveBeenCalledTimes(2);
      for (const kind of ['cv', 'coverLetter'] as const) {
        const pdf = await request(app).get(
          `/api/applications/${application.id}/pdf/${kind}?download=1`,
        );
        if (!selectedDocumentKinds(selection).includes(kind)) {
          expect(application.documents).not.toHaveProperty(kind);
          expect(pdf.status).toBe(404);
          continue;
        }
        expect(pdf.status).toBe(200);
        expect(pdf.headers['content-type']).toContain('application/pdf');
        expect(pdf.headers['content-disposition']).not.toContain('undefined');
        const html = renderToStaticMarkup(
          <DocumentPreview
            application={application}
            kind={kind}
            busy={false}
          />,
        );
        expect(html).toContain(
          kind === 'cv'
            ? 'Fuze Software'
            : fixture.documents.coverLetter.paragraphs[0],
        );
        const header = application.applicant!;
        expect(html).toContain(header.name);
        expect(html).toContain(header.contact[0]);
        const pdfText = textNodes(ApplicationPdf({ application, kind })).join(
          '',
        );
        expect(pdfText).toContain(header.name);
        expect(pdfText).toContain(header.contact[0]);
      }
    },
  );

  it.each(['cv', 'coverLetter'] as const)(
    'revises and regenerates only the saved %s by default',
    async (selection) => {
      repository.create({
        ...fixture,
        documents: selectedDocuments(selection),
      });
      generate.mockResolvedValue({ output: selectedDocuments(selection) });
      const app = createApp(repository);
      for (const [index, action] of ['revise', 'regenerate'].entries()) {
        const response = await request(app)
          .post(`/api/applications/${fixture.id}/${action}`)
          .send({
            model: fixture.model,
            version: index + 1,
            instructions: 'Make it more concise.',
          });
        expect(response.status).toBe(200);
        expect(savedDocumentSelection(response.body.documents)).toBe(selection);
        await expectScope(index, selection);
      }
    },
  );

  it.each(['cv', 'coverLetter'] as const)(
    'keeps a repair scoped to %s',
    async (selection) => {
      const broken = selectedDocuments(selection);
      if (broken.cv)
        broken.cv.experience[0].bullets[0] = '[Insert achievement here]';
      if (broken.coverLetter)
        broken.coverLetter.paragraphs[0] = '[Insert paragraph here]';
      generate
        .mockResolvedValueOnce({ output: broken })
        .mockResolvedValueOnce({ output: selectedDocuments(selection) });
      const documents = await draftDocuments(
        await loadCareer(),
        fixture.job,
        fixture.templates,
        fixture.model,
        '',
        selection,
      );
      expect(savedDocumentSelection(documents)).toBe(selection);
      await expectScope(0, selection);
      await expectScope(1, selection, true);
    },
  );

  it('changes selection on regeneration only after success', async () => {
    repository.create(fixture);
    const app = createApp(repository);
    generate.mockResolvedValueOnce({ output: selectedDocuments('cv') });
    const response = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({
        model: fixture.model,
        version: 1,
        documentSelection: 'cv',
      });
    expect(response.status).toBe(200);
    expect(response.body.documents).not.toHaveProperty('coverLetter');
    const saved = repository.get(fixture.id);
    generate.mockRejectedValueOnce(new Error('Provider unavailable'));
    const failed = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({
        model: fixture.model,
        version: 2,
        documentSelection: 'coverLetter',
      });
    expect(failed.status).toBe(502);
    expect(repository.get(fixture.id)).toEqual(saved);
    generate.mockResolvedValueOnce({ output: selectedDocuments('both') });
    const expanded = await request(app)
      .post(`/api/applications/${fixture.id}/regenerate`)
      .send({
        model: fixture.model,
        version: 2,
        documentSelection: 'both',
      });
    expect(expanded.status).toBe(200);
    expect(savedDocumentSelection(expanded.body.documents)).toBe('both');
  });

  it('writes only the letter for personalisation changes and preserves an existing CV', async () => {
    generate.mockResolvedValue({ output: selectedDocuments('coverLetter') });
    const result = await reviseDocuments(
      await loadCareer(),
      fixture,
      '',
      fixture.model,
    );
    expect(result.cv).toEqual(fixture.documents.cv);
    await expectScope(0, 'coverLetter');
    expect(
      JSON.parse(generate.mock.calls[0][0].prompt).currentDocuments,
    ).not.toHaveProperty('cv');
  });

  it('allows personalisation-only changes for a standalone letter without creating a CV', async () => {
    generate.mockResolvedValue({ output: selectedDocuments('coverLetter') });
    const application = {
      ...fixture,
      documents: selectedDocuments('coverLetter'),
    };
    const result = await reviseDocuments(
      await loadCareer(),
      application,
      '',
      fixture.model,
    );
    expect(result).not.toHaveProperty('cv');
    await expectScope(0, 'coverLetter');
  });

  it('rejects personalisation-only revisions on CV-only applications before calling AI', async () => {
    repository.create({ ...fixture, documents: selectedDocuments('cv') });
    const response = await request(createApp(repository))
      .post(`/api/applications/${fixture.id}/revise`)
      .send({
        model: fixture.model,
        version: 1,
        coverLetterPersonalisation: 'I am a runner.',
      });
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('defaults old requests and saved applications to both and rejects invalid selections', async () => {
    expect(savedDocumentSelection(fixture.documents)).toBe('both');
    generate
      .mockResolvedValueOnce({
        output: { isJobPosting: true, job: fixture.job },
      })
      .mockResolvedValueOnce({ output: fixture.documents });
    const app = createApp(repository);
    const body = {
      url: fixture.url,
      model: fixture.model,
      jobText:
        'A frontend role building React and TypeScript applications, collaborating with designers to create accessible interfaces.',
    };
    expect(
      (await request(app).post('/api/applications').send(body)).status,
    ).toBe(201);
    await expectScope(1, 'both');
    for (const documentSelection of ['none', '', []])
      expect(
        (
          await request(app)
            .post('/api/applications')
            .send({ ...body, documentSelection })
        ).status,
      ).toBe(400);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('can render a standalone letter from its saved applicant snapshot', async () => {
    const applicant = careerApplicant(await loadCareer());
    const application: Application = {
      ...fixture,
      applicant,
      documents: selectedDocuments('coverLetter'),
    };
    expect(
      textNodes(ApplicationPdf({ application, kind: 'coverLetter' })).join(''),
    ).toContain(applicant.contact.join('  |  '));
    expect(() => ApplicationPdf({ application, kind: 'cv' })).toThrow(
      'unavailable',
    );
  });
});
