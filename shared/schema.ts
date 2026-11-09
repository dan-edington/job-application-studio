import {
  jobKeywordsGuidance,
  cvHeadlineGuidance,
  cvContactGuidance,
  experienceBulletsGuidance,
  coverLetterParagraphGuidance,
  coreSkillsGuidance,
  personalProjectsGuidance,
} from '../prompts/outputGuidance.js';
import { z } from 'zod';
import { isMissingCompanyName } from './company-name.js';

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
      .max(20)
      .describe(coreSkillsGuidance),
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
    personalProjects: z
      .array(
        z.object({
          sourceId: text,
          name: text,
          description: text,
          repositoryUrl: z
            .string()
            .url()
            .refine((url) => /^https?:\/\//i.test(url))
            .optional(),
        }),
      )
      .max(5)
      .describe(personalProjectsGuidance)
      .default([]),
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
      margin: z.number().min(24).max(65).default(24),
    })
    .default({
      accent: '#214b43',
      fontFamily: 'Helvetica',
      fontSize: 10,
      margin: 24,
    }),
});
const personalisation = z.string().trim().max(3000);
export const documentSelectionSchema = z.enum(['both', 'cv', 'coverLetter']);
export type DocumentSelection = z.infer<typeof documentSelectionSchema>;
export type DocumentKind = Exclude<DocumentSelection, 'both'>;
export const generateSchema = z
  .object({
    documentSelection: documentSelectionSchema.default('both'),
    url: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) =>
          !value ||
          (z.string().url().safeParse(value).success &&
            /^https?:\/\//i.test(value)),
        'Use an HTTP or HTTPS job URL.',
      )
      .default(''),
    jobText: z.string().trim().max(45000).default(''),
    model: z.string().min(1).max(150),
    cvTemplate: z.string().max(100).default('standard'),
    letterTemplate: z.string().max(100).default('standard'),
    coverLetterPersonalisation: personalisation.default(''),
  })
  .superRefine((value, context) => {
    if (!value.url && !value.jobText)
      context.addIssue({
        code: 'custom',
        path: ['jobText'],
        message: 'Add a job posting URL or paste the full job description.',
      });
    else if (value.jobText && value.jobText.length < 100)
      context.addIssue({
        code: 'custom',
        path: ['jobText'],
        message: 'Paste the full job description (at least 100 characters).',
      });
  });
export const completeApplicationSchema = z.object({
  token: z.string().uuid(),
  companyName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(
      (name) => !isMissingCompanyName(name),
      'Enter the company name rather than a placeholder.',
    ),
});
export type CompanyNameRequest = {
  status: 'company_name_required';
  token: string;
  jobTitle: string;
};
export type GenerateResult = Application | CompanyNameRequest;
export const regenerateSchema = z.object({
  documentSelection: documentSelectionSchema.optional(),
  model: z.string().min(1).max(150),
  version: z.number().int().positive(),
  coverLetterPersonalisation: personalisation.optional(),
});
export const reviseSchema = regenerateSchema
  .omit({ documentSelection: true })
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
export type ApplicationDocuments = Pick<Documents, 'evidence' | 'cautions'> &
  Partial<Pick<Documents, DocumentKind>>;
export type Applicant = Pick<Documents['cv'], 'name' | 'location' | 'contact'>;
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
  documents: ApplicationDocuments;
  applicant?: Applicant;
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
