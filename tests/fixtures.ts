import type { Application } from '../shared/schema';
import { standardTemplate } from '../server/services/templates';
export const fixture: Application = {
  id: 'test-application', url: 'https://example.com/careers/frontend', model: 'gpt-5-mini', version: 1,
  createdAt: '2026-10-13T12:00:00.000Z', updatedAt: '2026-10-13T12:00:00.000Z',
  job: { title: 'Senior Frontend Engineer', company: 'Example Studio', location: 'Remote UK', summary: 'Build accessible React and TypeScript applications for a product team.', requirements: ['React and TypeScript', 'Accessible interfaces'], keywords: ['React', 'TypeScript', 'WCAG'] },
  templates: { cv: standardTemplate, coverLetter: standardTemplate }, revisions: [],
  documents: {
    cv: { name: 'Dan Edington', headline: 'Senior Frontend Engineer', location: 'Manchester, United Kingdom', contact: ['dan@example.com', '+44 7000 000000', 'https://example.com/portfolio'], skills: [{ category: 'Frontend', items: ['React', 'TypeScript', 'Accessibility'] }], experience: [{ sourceId: 'fuze', employer: 'Fuze Software', title: 'Senior Frontend Engineer', start: '2024-02', end: '2026-01', bullets: ['Built a React and TypeScript solar design tool to help installers plan rooftop panel layouts.', 'Moved simulation work to Web Workers to keep the interface responsive.'] }], education: ['HND Graphic Design, City College, Manchester, 2006–2008'] },
    coverLetter: { date: '13 October 2026', recipient: 'Hiring team, Example Studio', subject: 'Application: Senior Frontend Engineer', greeting: 'Dear hiring team,', paragraphs: ['I am applying for the Senior Frontend Engineer role. My work combines React and TypeScript development with practical frontend architecture.', 'At Fuze Software I built an interactive solar design tool and used Web Workers to keep the interface responsive during calculations. I would welcome the opportunity to discuss this experience.'], signoff: 'Kind regards,', name: 'Dan Edington' },
    evidence: [{ requirement: 'React and TypeScript', evidence: 'Built the solar design tool using React and TypeScript at Fuze Software.', sourceIds: ['fuze'] }], cautions: ['Review the final wording before submitting.'],
  },
};
