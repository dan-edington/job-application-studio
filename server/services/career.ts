import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { config, AppError } from '../config.js';
import type {
  ApplicationDocuments,
  Applicant,
  Job,
} from '../../shared/schema.js';

const careerSchema = z.object({
  personal: z.object({
    fullName: z.string(),
    preferredName: z.string(),
    headlineOptions: z.array(z.string().min(1)).min(1),
    email: z.string(),
    phone: z.string(),
    location: z.object({ city: z.string(), country: z.string() }),
    links: z.record(z.string(), z.string()),
    education: z.array(z.record(z.string(), z.unknown())),
  }),
  rules: z.array(z.string()).default([]),
  skills: z.record(z.string(), z.array(z.string())),
  employment: z.array(
    z.object({
      id: z.string(),
      employer: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      context: z.string(),
      responsibilitiesAndAchievements: z.array(z.string()),
      keywords: z.array(z.string()),
    }),
  ),
  personalProjects: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        description: z.string().min(1),
        repositoryUrl: z
          .string()
          .url()
          .refine((url) => /^https?:\/\//i.test(url))
          .optional(),
      })
      .passthrough(),
  ),
  selectedClients: z.array(z.string()),
  clientAttributionNote: z.string(),
  examplesForInterviewsAndCoverLetters: z.array(
    z.record(z.string(), z.unknown()),
  ),
  writingPreferences: z.record(z.string(), z.unknown()),
  generationRules: z.record(z.string(), z.unknown()),
  needsVerification: z.array(z.string()),
});
export type Career = z.infer<typeof careerSchema>;
export async function loadCareer() {
  try {
    return careerSchema.parse(
      JSON.parse(await readFile(config.careerPath, 'utf8')),
    );
  } catch {
    throw new AppError(
      500,
      'The career master is missing or invalid. Check CAREER_MASTER_PATH and its JSON structure.',
    );
  }
}
// The allowlisted schema excludes career preferences, salary and other private top-level fields.
export function enforceFacts<T extends ApplicationDocuments>(
  documents: T,
  career: Career,
  job: Pick<Job, 'title'>,
): T {
  const output = structuredClone(documents);
  const ids = new Set(
    [...career.employment, ...career.personalProjects].map((item) => item.id),
  );
  const cv = output.cv;
  if (cv) {
    for (const experience of cv.experience) {
      const source = career.employment.find(
        (item) => item.id === experience.sourceId,
      );
      if (!source)
        throw new AppError(
          502,
          'The AI returned an unsupported employment claim. Please generate again.',
        );
      Object.assign(experience, {
        employer: source.employer,
        title: source.title,
        start: source.start,
        end: source.end,
      });
    }
    cv.personalProjects ??= [];
    for (const project of cv.personalProjects) {
      const source = career.personalProjects.find(
        (item) => item.id === project.sourceId,
      );
      if (!source)
        throw new AppError(
          502,
          'The AI returned an unsupported personal project. Please generate again.',
        );
      project.name = source.name;
      // URLs are canonical metadata, never model-authored content.
      if (source.repositoryUrl) project.repositoryUrl = source.repositoryUrl;
      else delete project.repositoryUrl;
    }
    const tonygl = career.personalProjects.find(
      (project) => project.id === 'tonygl',
    );
    if (
      tonygl &&
      !cv.personalProjects.some((project) => project.sourceId === tonygl.id)
    )
      cv.personalProjects.unshift({
        sourceId: tonygl.id,
        name: tonygl.name,
        description: tonygl.description,
        ...(tonygl.repositoryUrl
          ? { repositoryUrl: tonygl.repositoryUrl }
          : {}),
      });

    const normaliseHeadline = (value: string) =>
      value
        .toLowerCase()
        .replace(/\bdeveloper\b/g, 'engineer')
        .replace(/\bfront[ -]+end\b/g, 'frontend')
        .replace(/\s+/g, ' ')
        .trim();

    const selectedHeadline = career.personal.headlineOptions.find(
      (option) => normaliseHeadline(option) === normaliseHeadline(cv.headline),
    );
    if (!selectedHeadline)
      throw new AppError(
        502,
        'The AI returned a headline outside personal.headlineOptions. Please generate again.',
      );
    const jobProfession = job.title.match(/\b(?:developer|engineer)\b/i)?.[0];
    const jobFrontend = job.title.match(/\bfront(?:[ -]+)?end\b/i)?.[0];
    cv.headline = selectedHeadline
      .replace(/\b(?:developer|engineer)\b/gi, (word) => jobProfession || word)
      .replace(/\bfront(?:[ -]+)?end\b/gi, (word) => jobFrontend || word);
    cv.name = career.personal.preferredName;
    cv.location =
      career.personal.location.city + ', ' + career.personal.location.country;
    cv.contact = [
      career.personal.email,
      career.personal.phone,
      ...Object.values(career.personal.links),
    ];
  }
  if (output.coverLetter)
    output.coverLetter.name = career.personal.preferredName;
  if (output.evidence.some((item) => item.sourceIds.some((id) => !ids.has(id))))
    throw new AppError(
      502,
      'The AI cited an unknown source. Please generate again.',
    );

  return output;
}

// Contact details are factual metadata, not an AI-generated document.
export function careerApplicant(career: Career): Applicant {
  return {
    name: career.personal.preferredName,
    location: `${career.personal.location.city}, ${career.personal.location.country}`,
    contact: [
      career.personal.email,
      career.personal.phone,
      ...Object.values(career.personal.links),
    ],
  };
}
