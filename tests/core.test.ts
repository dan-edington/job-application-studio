import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { config } from '../server/config';
import { extractJobText, isPublicAddress, resolvePublicUrl, readJob } from '../server/services/job';
import { enforceFacts, loadCareer } from '../server/services/career';
import { ApplicationRepository } from '../server/repository';
import { loadTemplates, selectTemplate } from '../server/services/templates';
import { fixture } from './fixtures';

describe('job extraction and request boundaries', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '100.64.0.1'])('blocks non-public IP %s', address => expect(isPublicAddress(address)).toBe(false));
  it('allows public IPv4 and IPv6', () => { expect(isPublicAddress('8.8.8.8')).toBe(true); expect(isPublicAddress('2606:4700:4700::1111')).toBe(true); });
  it('rejects private destinations and unsafe URL forms', async () => {
    for (const url of ['http://127.0.0.1', 'http://[::1]', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com:9000']) await expect(resolvePublicUrl(url)).rejects.toThrow();
  });
  it('extracts structured postings and strips navigation and scripts', () => {
    expect(extractJobText('<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Engineer","description":"Build accessible React apps"}]}</script>')).toContain('Build accessible React apps');
    const text = extractJobText('<nav>Noise</nav><main><h1>Engineer</h1><p>Build products</p><script>malicious()</script></main>');
    expect(text).toContain('Engineer'); expect(text).not.toContain('Noise'); expect(text).not.toContain('malicious');
  });
  it('supports pasted content without fetching blocked pages', async () => {
    const text = 'A senior engineer role creating accessible React and TypeScript applications with a collaborative team. '.repeat(3);
    expect(await readJob('https://example.com', text)).toBe(text.trim());
    await expect(readJob('https://example.com', 'too short')).rejects.toThrow('at least 100');
  });
});

describe('career grounding', () => {
  it('loads employment keywords and keeps unordered achievements intact for generation', async () => {
    const source = JSON.parse(await readFile(config.careerPath, 'utf8'));
    const career = await loadCareer();
    expect(career.employment).toHaveLength(source.employment.length);
    for (const [index, role] of career.employment.entries()) {
      expect(role.keywords).toEqual(source.employment[index].keywords);
      expect(role.responsibilitiesAndAchievements).toEqual(source.employment[index].responsibilitiesAndAchievements);
    }
  });
  it('removes private preferences and restores canonical employment facts', async () => {
    const career = await loadCareer(); expect(career).not.toHaveProperty('careerPreferences');
    const documents = structuredClone(fixture.documents); documents.cv.experience[0].employer = 'Invented employer'; documents.cv.experience[0].start = '1999';
    const result = enforceFacts(documents, career, fixture.job);
    expect(result.cv.experience[0].employer).toBe('Fuze Software'); expect(result.cv.experience[0].start).toBe('2024-02'); expect(result.cv.contact).toContain(career.personal.email);
  });
  it('rejects invented source IDs', async () => {
    const documents = structuredClone(fixture.documents); documents.cv.experience[0].sourceId = 'invented';
    const career = await loadCareer(); expect(() => enforceFacts(documents, career, fixture.job)).toThrow('unsupported employment');
    documents.cv.experience[0].sourceId = 'fuze'; documents.evidence[0].sourceIds = ['invented'];
    expect(() => enforceFacts(documents, career, fixture.job)).toThrow('unknown source');
  });
});

describe('saved applications and templates', () => {
  it('preserves data and rejects stale concurrent revisions', () => {
    const repo = new ApplicationRepository(':memory:');
    repo.create(fixture); expect(repo.get(fixture.id)).toEqual(fixture); expect(repo.list()[0].company).toBe('Example Studio');
    repo.update({ ...fixture, version: 2 }, 1); expect(() => repo.update({ ...fixture, version: 2 }, 1)).toThrow('another session');
    expect(repo.get(fixture.id).version).toBe(2); repo.close();
  });
  it('loads the optional template and prevents path traversal in selection', async () => {
    const { templates, warnings } = await loadTemplates(); expect(warnings).toEqual([]); expect(selectTemplate(templates, 'editorial', 'cv').theme.fontFamily).toBe('Times-Roman');
    expect(() => selectTemplate(templates, '../.env', 'cv')).toThrow('unavailable');
  });
});
