import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { documentsSchema, type Application } from '../shared/schema';
import { cvHeader } from '../shared/cv-header';
import { ApplicationPdf } from '../shared/pdf';
import { DocumentPreview } from '../src/components/DocumentPreview';
import { enforceFacts, loadCareer } from '../server/services/career';
import { fixture } from './fixtures';

function textNodes(node: ReactNode): string[] {
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textNodes);
  return isValidElement<{ children?: ReactNode }>(node) ? textNodes(node.props.children) : [];
}

function legacyApplication(): Application {
  const { location, ...cv } = fixture.documents.cv;
  return { ...fixture, documents: { ...fixture.documents, cv: { ...cv, contact: [location, ...cv.contact], summary: 'LEGACY PROFILE CONTENT', projects: [{ sourceId: 'old-project', name: 'LEGACY PROJECT', description: 'Legacy description' }] } } } as unknown as Application;
}

describe('CV layout and stored-document compatibility', () => {
  it('uses the same header details for new and older saved CVs', () => {
    const expected = { location: fixture.documents.cv.location, contact: fixture.documents.cv.contact };
    expect(cvHeader(fixture.documents.cv)).toEqual(expected);
    expect(cvHeader(legacyApplication().documents.cv)).toEqual(expected);
  });

  it('renders the requested section order and separated header in previews, including old drafts', () => {
    for (const application of [fixture, legacyApplication()]) {
      const $ = load(renderToStaticMarkup(<DocumentPreview application={application} kind="cv" busy={false}/>));
      expect($('.paper h3').map((_i, element) => $(element).text()).get()).toEqual(['Experience', 'Education', 'Core Skills']);
      expect($('.paper-cv-header').children().map((_i, element) => $(element).text()).get()).toEqual([
        fixture.documents.cv.name, fixture.documents.cv.headline, fixture.documents.cv.location, fixture.documents.cv.contact.join(' | '),
      ]);
      expect($('.paper').text()).not.toContain('LEGACY PROFILE CONTENT');
      expect($('.paper').text()).not.toContain('LEGACY PROJECT');
    }
  });

  it('keeps the same content ordering in the PDF and omits old summary/project content', () => {
    const nodes = textNodes(ApplicationPdf({ application: legacyApplication(), kind: 'cv' }));
    expect(nodes.slice(0, 4)).toEqual([fixture.documents.cv.name, fixture.documents.cv.headline, fixture.documents.cv.location, fixture.documents.cv.contact.join(' | ')]);
    expect(nodes.indexOf('Experience')).toBeLessThan(nodes.indexOf('Education'));
    expect(nodes.indexOf('Education')).toBeLessThan(nodes.indexOf('Core Skills'));
    expect(nodes).not.toContain('LEGACY PROFILE CONTENT');
    expect(nodes).not.toContain('LEGACY PROJECT');
  });

  it('preserves the cover-letter contact information across both storage formats', () => {
    const oldText = textNodes(ApplicationPdf({ application: legacyApplication(), kind: 'coverLetter' }));
    expect(oldText).toEqual(textNodes(ApplicationPdf({ application: fixture, kind: 'coverLetter' })));
  });

  it('removes summary/projects from generated data and restores location from the master', async () => {
    const parsed = documentsSchema.parse({ ...fixture.documents, cv: { ...fixture.documents.cv, summary: 'Not part of the CV', projects: [] } });
    expect(parsed.cv).not.toHaveProperty('summary');
    expect(parsed.cv).not.toHaveProperty('projects');
    const career = await loadCareer();
    const grounded = enforceFacts(parsed, career, fixture.job);
    expect(grounded.cv.location).toBe(`${career.personal.location.city}, ${career.personal.location.country}`);
    expect(grounded.cv.contact).not.toContain(grounded.cv.location);
    expect(grounded.cv.contact).toContain(career.personal.email);
  });

  it('accepts five bullets per role and rejects a sixth', () => {
    const documents = structuredClone(fixture.documents);
    documents.cv.experience[0].bullets = Array.from({ length: 5 }, () => fixture.documents.cv.experience[0].bullets[0]);
    expect(documentsSchema.safeParse(documents).success).toBe(true);
    documents.cv.experience[0].bullets.push('Another contribution.');
    const result = documentsSchema.safeParse(documents);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['cv', 'experience', 0, 'bullets']);
  });

  it.each([
    ['Senior Frontend Engineer', 'Senior Front end Developer', 'Senior Front end Developer'],
    ['Lead Frontend Engineer', 'Lead Frontend Developer', 'Lead Frontend Developer'],
    ['Senior Frontend Engineer', 'Senior Frontend Engineer', 'Senior Frontend Engineer'],
    ['Senior Frontend Engineer', 'Web Specialist', 'Senior Frontend Engineer'],
  ])('adapts the allowed headline %s to the wording in %s', async (selected, title, expected) => {
    const documents = structuredClone(fixture.documents);
    documents.cv.headline = selected;
    const result = enforceFacts(documents, await loadCareer(), { title });
    expect(result.cv.headline).toBe(expected);
    expect(result.cv.experience[0].title).toBe(fixture.documents.cv.experience[0].title);
  });

  it('rejects headlines outside the master options', async () => {
    const documents = structuredClone(fixture.documents);
    documents.cv.headline = 'Chief Technology Officer';
    const career = await loadCareer();
    expect(() => enforceFacts(documents, career, fixture.job)).toThrow('outside personal.headlineOptions');
  });
});
