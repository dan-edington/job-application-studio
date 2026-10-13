import { z } from 'zod';

const text = z.string().min(1).max(12000);
export const jobSchema = z.object({
  title: text, company: text, location: z.string(), summary: text,
  requirements: z.array(text).max(20), keywords: z.array(text).max(50).describe('Role-specific terms explicitly present in the job specification, primarily technologies such as JavaScript, CSS, AWS and CI/CD. Preserve the exact casing in the posting. Exclude generic recruiting language.'),
});
export const documentsSchema = z.object({
  cv: z.object({
    name: text, headline: text.describe('The closest matching option from personal.headlineOptions for the job-spec role title.'), location: text, contact: z.array(text).max(10).describe('Contact details and URLs only; location has its own field.'),
    skills: z.array(z.object({ category: text, items: z.array(text).max(30) })).max(10),
    experience: z.array(z.object({ sourceId: text, employer: text, title: text, start: text, end: text, bullets: z.array(text).min(1).max(5).describe('At most five recruiter-readable what/why/outcome bullets per role, based on that employment entry’s unordered responsibilitiesAndAchievements. Rephrase or blend supported items and cross-check its keywords against the job spec. Lead with relevant skills; unrelated skills belong only in later bullets. Match technology casing to the job spec. No quantified outcomes.') })).max(12),
    education: z.array(text).max(5),
  }),
  coverLetter: z.object({ date: text, recipient: text, subject: text, greeting: text, paragraphs: z.array(text.describe('A finished, ready-to-send paragraph in the candidate’s voice. No internal labels, schema keys, placeholders or instructions to edit text later.')).min(2).max(6), signoff: text, name: text }),
  evidence: z.array(z.object({ requirement: text, evidence: text, sourceIds: z.array(text) })).max(15),
  cautions: z.array(text).max(15),
});
export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(100),
  kind: z.enum(['cv', 'coverLetter', 'both']), description: z.string().max(500),
  instructions: z.string().max(12000).default(''),
  theme: z.object({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#214b43'), fontFamily: z.enum(['Helvetica', 'Times-Roman']).default('Helvetica'), fontSize: z.number().min(9).max(13).default(10), margin: z.number().min(28).max(65).default(42) }).default({ accent: '#214b43', fontFamily: 'Helvetica', fontSize: 10, margin: 42 }),
});
const personalisation = z.string().trim().max(3000);
export const generateSchema = z.object({
  url: z.string().url().max(2048).refine(v => /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS job URL.'),
  jobText: z.string().max(45000).default(''), model: z.string().min(1).max(150),
  cvTemplate: z.string().max(100).default('standard'), letterTemplate: z.string().max(100).default('standard'),
  coverLetterPersonalisation: personalisation.default(''),
});
export const regenerateSchema = z.object({ model: z.string().min(1).max(150), version: z.number().int().positive(), coverLetterPersonalisation: personalisation.optional() });
export const reviseSchema = regenerateSchema.extend({ instructions: z.string().trim().max(6000).default('') }).refine(value => value.instructions.length >= 3 || (value.instructions.length === 0 && value.coverLetterPersonalisation !== undefined), { message: 'Add suggested changes or update the cover-letter personalisation.', path: ['instructions'] });
export const deleteSchema = regenerateSchema.pick({ version: true });
export type Job = z.infer<typeof jobSchema>;
export type Documents = z.infer<typeof documentsSchema>;
export type Template = z.infer<typeof templateSchema>;
export type GenerateInput = z.infer<typeof generateSchema>;
export type Application = { id: string; url: string; model: string; createdAt: string; updatedAt: string; version: number; coverLetterPersonalisation?: string; job: Job; documents: Documents; templates: { cv: Template; coverLetter: Template }; revisions: { instructions: string; date: string; version?: number }[] };
export type ApplicationSummary = Pick<Application, 'id' | 'updatedAt' | 'version' | 'model'> & { title: string; company: string };
export type Settings = { configured: boolean; modelSource: 'openai' | 'fallback'; models: string[]; defaultModel: string; modelWarning: string | null; templates: Template[]; templateWarnings: string[]; profile: { name: string; role: string; source: string; roleCount: number } };
