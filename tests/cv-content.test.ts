import { describe, expect, it } from 'vitest';
import { documentsSchema } from '../shared/schema';
import { enforceFacts, loadCareer } from '../server/services/career';
import { fixture } from './fixtures';

describe('personal projects', () => {
  it('restores TonyGL from the master when omitted without changing the input', async () => {
    const career = await loadCareer();
    const documents = structuredClone(fixture.documents);
    documents.cv.personalProjects = [];
    const result = enforceFacts(documents, career, fixture.job);
    const source = career.personalProjects.find(
      (project) => project.id === 'tonygl',
    )!;
    expect(result.cv.personalProjects).toEqual([
      {
        sourceId: source.id,
        name: source.name,
        description: source.description,
        repositoryUrl: source.repositoryUrl,
      },
    ]);
    expect(documents.cv.personalProjects).toEqual([]);
  });

  it('keeps the tailored description and canonical name without duplicating TonyGL', async () => {
    const documents = structuredClone(fixture.documents);
    documents.cv.personalProjects[0].name = 'An invented project name';
    const result = enforceFacts(documents, await loadCareer(), fixture.job);
    expect(result.cv.personalProjects).toEqual(
      fixture.documents.cv.personalProjects,
    );
  });

  it('rejects projects from outside the career master', async () => {
    const documents = structuredClone(fixture.documents);
    documents.cv.personalProjects[0].sourceId = 'invented';
    const career = await loadCareer();
    expect(() => enforceFacts(documents, career, fixture.job)).toThrow(
      'unsupported personal project',
    );
  });

  it('restores repository URLs from the master and removes invented links', async () => {
    const career = await loadCareer();
    const documents = structuredClone(fixture.documents);
    documents.cv.personalProjects[0].repositoryUrl =
      'https://example.com/invented';
    const result = enforceFacts(documents, career, fixture.job);
    expect(result.cv.personalProjects[0].repositoryUrl).toBe(
      'https://github.com/dan-edington/TonyGL',
    );
    const source = career.personalProjects.find(
      (project) => project.id === 'tonygl',
    )!;
    delete source.repositoryUrl;
    expect(
      enforceFacts(documents, career, fixture.job).cv.personalProjects[0],
    ).not.toHaveProperty('repositoryUrl');
  });

  it('reads older documents with no personalProjects and supports all master skill categories', async () => {
    const { personalProjects, ...cv } = fixture.documents.cv;
    const career = await loadCareer();
    const parsed = documentsSchema.parse({
      ...fixture.documents,
      cv: {
        ...cv,
        skills: Object.entries(career.skills).map(([category, items]) => ({
          category,
          items,
        })),
      },
    });
    expect(parsed.cv.personalProjects).toEqual([]);
    expect(parsed.cv.skills).toHaveLength(Object.keys(career.skills).length);
  });
});

describe('Core Skills preferences', () => {
  it('preserves the model-selected skills and ordering without a technology blacklist', async () => {
    const documents = structuredClone(fixture.documents);
    documents.cv.skills = [
      {
        category: 'Tools',
        items: ['Vite', 'Webpack', 'esbuild', 'Gulp', 'Grunt', 'SVN'],
      },
      { category: 'Frontend', items: ['React', 'JavaScript'] },
    ];
    const result = enforceFacts(documents, await loadCareer(), fixture.job);
    expect(result.cv.skills).toEqual(documents.cv.skills);
  });
});
