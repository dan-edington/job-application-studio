import {
  jobKeywordsGuidance,
  cvHeadlineGuidance,
  cvContactGuidance,
  experienceBulletsGuidance,
  coverLetterParagraphGuidance,
} from '../prompts/outputGuidance.js';
import { z } from 'zod';

const text = z.string().min(1).max(12000);
export const jobSchema = z.object({
  title: text,
  company: text,
  location: z.string(),
  summary: text,
  requirements: z.array(text).max(20),
  keywords: z.array(text).max(50).describe(jobKeywordsGuidance),
});
export const documentsSchema = z.object({
  cv: z.object({
    name: text,
    headline: text.describe(cvHeadlineGuidance),
    location: text,
    contact: z.array(text).max(10).describe(cvContactGuidance),
    skills: z
      .array(z.object({ category: text, items: z.array(text).max(30) }))
      .max(10),
    experience: z
      .array(
        z.object({
          sourceId: text,
          employer: text,
          title: text,
          start: text,
          end: text,
          bullets: z
            .array(text)
            .min(1)
            .max(5)
            .describe(experienceBulletsGuidance),
        }),
      )
      .max(12),
    education: z.array(text).max(5),
  }),
  coverLetter: z.object({
    date: text,
    recipient: text,
    subject: text,
    greeting: text,
    paragraphs: z
      .array(text.describe(coverLetterParagraphGuidance))
      .min(2)
      .max(6),
    signoff: text,
    name: text,
  }),
  evidence: z
    .array(
      z.object({ requirement: text, evidence: text, sourceIds: z.array(text) }),
    )
    .max(15),
  cautions: z.array(text).max(15),
});
export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  kind: z.enum(['cv', 'coverLetter', 'both']),
  description: z.string().max(500),
  instructions: z.string().max(12000).default(''),
  theme: z
    .object({
      accent: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .default('#214b43'),
      fontFamily: z.enum(['Helvetica', 'Times-Roman']).default('Helvetica'),
      fontSize: z.number().min(9).max(13).default(10),
      margin: z.number().min(28).max(65).default(42),
    })
    .default({
      accent: '#214b43',
      fontFamily: 'Helvetica',
      fontSize: 10,
      margin: 30,
    }),
});
const personalisation = z.string().trim().max(3000);
export const generateSchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((v) => /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS job URL.'),
  jobText: z.string().max(45000).default(''),
  model: z.string().min(1).max(150),
  cvTemplate: z.string().max(100).default('standard'),
  letterTemplate: z.string().max(100).default('standard'),
  coverLetterPersonalisation: personalisation.default(''),
});
export const regenerateSchema = z.object({
  model: z.string().min(1).max(150),
  version: z.number().int().positive(),
  coverLetterPersonalisation: personalisation.optional(),
});
export const reviseSchema = regenerateSchema
  .extend({ instructions: z.string().trim().max(6000).default('') })
  .refine(
    (value) =>
      value.instructions.length >= 3 ||
      (value.instructions.length === 0 &&
        value.coverLetterPersonalisation !== undefined),
    {
      message:
        'Add suggested changes or update the cover-letter personalisation.',
      path: ['instructions'],
    },
  );
export const deleteSchema = regenerateSchema.pick({ version: true });
export type Job = z.infer<typeof jobSchema>;
export type Documents = z.infer<typeof documentsSchema>;
export type Template = z.infer<typeof templateSchema>;
export type GenerateInput = z.infer<typeof generateSchema>;
export type Application = {
  id: string;
  url: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  coverLetterPersonalisation?: string;
  job: Job;
  documents: Documents;
  templates: { cv: Template; coverLetter: Template };
  revisions: { instructions: string; date: string; version?: number }[];
};
export type ApplicationSummary = Pick<
  Application,
  'id' | 'updatedAt' | 'version' | 'model'
> & { title: string; company: string };
export type Settings = {
  configured: boolean;
  modelSource: 'openai' | 'fallback';
  models: string[];
  defaultModel: string;
  modelWarning: string | null;
  templates: Template[];
  templateWarnings: string[];
  profile: { name: string; role: string; source: string; roleCount: number };
};
