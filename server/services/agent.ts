import { jobAnalysisPrompt } from '../../prompts/jobAnalysisPrompt.js';
import { draftDocumentsPrompt } from '../../prompts/draftDocumentsPrompt.js';
import { reviseDocumentsPrompt } from '../../prompts/reviseDocumentsPrompt.js';
import { repairDocumentsPrompt } from '../../prompts/repairDocumentsPrompt.js';
import {
  selectedHeadlineGuidance,
  personalProjectsGuidance,
} from '../../prompts/outputGuidance.js';
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { config, AppError } from '../config.js';
import {
  jobSchema,
  documentsSchema,
  type Application,
  type Template,
  type Job,
  type ApplicationDocuments,
  type DocumentSelection,
} from '../../shared/schema.js';
import {
  savedDocumentSelection,
  selectedDocumentKinds,
} from '../../shared/document-selection.js';
import { enforceFacts, type Career } from './career.js';
import { systemPrompt } from '../../prompts/systemPrompt.js';
import { documentQualityIssues } from '../../shared/document-quality.js';
import { generationFailure } from './generation-errors.js';

async function structured<T>(
  schema: z.ZodType<T>,
  model: string,
  prompt: string,
  instructions = systemPrompt,
  stage = 'writing documents',
): Promise<T> {
  const started = Date.now();
  const deadline = AbortSignal.timeout(config.generationTimeoutMs);
  try {
    const provider = createOpenAI({ apiKey: config.apiKey });
    const result = await generateText({
      model: provider.responses(model),
      system: instructions,
      prompt,
      output: Output.object({ schema }),
      maxRetries: 1,
      abortSignal: deadline,
      providerOptions: {
        openai: {
          store: false,
          ...(/^gpt-5-nano(?:-\d{4}-\d{2}-\d{2})?$/.test(model)
            ? { reasoningEffort: 'low' }
            : {}),
        },
      },
    });
    return result.output;
  } catch (error) {
    const failure = generationFailure(error, {
      model,
      stage,
      elapsedMs: Date.now() - started,
      timeoutMs: config.generationTimeoutMs,
      timedOut: deadline.aborted,
    });
    console.error('OpenAI generation failed:', failure.diagnostics);
    throw failure.error;
  }
}

export async function analyseJob(text: string, model: string): Promise<Job> {
  const result = await structured(
    z.object({ isJobPosting: z.boolean(), job: jobSchema }),
    model,
    JSON.stringify({ jobPage: text }),
    jobAnalysisPrompt,
    'analysing the job posting',
  );
  if (!result.isJobPosting)
    throw new AppError(
      422,
      'The page did not contain a readable job posting. Paste the full job description below.',
    );
  return result.job;
}
export async function draftDocuments(
  career: Career,
  job: Job,
  templates: Application['templates'],
  model: string,
  coverLetterPersonalisation = '',
  documentSelection: DocumentSelection = 'both',
): Promise<ApplicationDocuments> {
  return finishedDocuments(
    career,
    job,
    model,
    JSON.stringify({
      task: draftDocumentsPrompt,
      requestedDocuments: selectedDocumentKinds(documentSelection),
      ...(documentSelection !== 'cv' ? { coverLetterPersonalisation } : {}),
      date: new Date().toLocaleDateString('en-GB', { dateStyle: 'long' }),
      career,
      job,
      templates: templateInstructions(templates, documentSelection),
    }),
    documentSelection,
  );
}
export async function reviseDocuments(
  career: Career,
  application: Application,
  instructions: string,
  model: string,
) {
  const personalisationOnly = !instructions.trim();
  if (personalisationOnly && !application.documents.coverLetter)
    throw new AppError(400, 'Add suggested changes to revise this CV.');
  const documentSelection = personalisationOnly
    ? 'coverLetter'
    : savedDocumentSelection(application.documents);
  const currentDocuments = {
    ...application.documents,
    ...(personalisationOnly ? { cv: undefined } : {}),
  };
  const result = await finishedDocuments(
    career,
    application.job,
    model,
    JSON.stringify({
      task: reviseDocumentsPrompt,
      requestedDocuments: selectedDocumentKinds(documentSelection),
      career,
      job: application.job,
      currentDocuments,
      revisionHistory: application.revisions,
      requestedChanges: instructions,
      ...(documentSelection !== 'cv'
        ? {
            coverLetterPersonalisation:
              application.coverLetterPersonalisation ?? '',
          }
        : {}),
      personalisationOnly,
      templates: templateInstructions(application.templates, documentSelection),
    }),
    documentSelection,
  );
  // A personalisation-only update should not rewrite the candidate's CV.
  return personalisationOnly && application.documents.cv
    ? { ...result, cv: structuredClone(application.documents.cv) }
    : result;
}

// One bounded repair attempt; never return or persist text that still fails checks.
async function finishedDocuments(
  career: Career,
  job: Job,
  model: string,
  prompt: string,
  documentSelection: DocumentSelection,
): Promise<ApplicationDocuments> {
  const schema = careerDocumentsSchema(career, documentSelection);
  let nextPrompt = prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await structured<ApplicationDocuments>(
      schema,
      model,
      nextPrompt,
      systemPrompt,
      attempt === 0 ? 'writing documents' : 'repairing documents',
    );
    const documents = enforceFacts(schema.parse(result), career, job);
    const issues = documentQualityIssues(documents);
    if (!issues.length) return documents;
    nextPrompt = JSON.stringify({
      originalRequest: JSON.parse(prompt),
      rejectedDocuments: documents,
      qualityFeedback: {
        fields: issues,
        instructions: repairDocumentsPrompt,
      },
    });
  }
  throw new AppError(
    502,
    'The generated documents contained unfinished drafting text even after a repair attempt. Please regenerate or try another model. No changes were saved.',
  );
}

// Constrain selection to the actual master file, not a hardcoded set of job titles.
function careerDocumentsSchema(career: Career, selection: DocumentSelection) {
  const fullSchema = documentsSchema.extend({
    cv: documentsSchema.shape.cv.extend({
      // Required for structured AI output; the default only supports old drafts.
      personalProjects: z
        .array(
          documentsSchema.shape.cv.shape.personalProjects
            .removeDefault()
            .element.omit({ repositoryUrl: true }),
        )
        .max(5)
        .describe(personalProjectsGuidance),
      headline: z
        .enum(career.personal.headlineOptions as [string, ...string[]])
        .describe(selectedHeadlineGuidance),
    }),
  });
  // Omit unrequested fields entirely so the model spends no output tokens
  // writing the other document. All remaining fields stay required by OpenAI.
  if (selection === 'cv') return fullSchema.omit({ coverLetter: true });
  if (selection === 'coverLetter') return fullSchema.omit({ cv: true });
  return fullSchema;
}

function templateInstructions(
  templates: {
    cv: Template;
    coverLetter: Template;
  },
  selection: DocumentSelection,
) {
  return Object.fromEntries(
    selectedDocumentKinds(selection).map((kind) => [
      kind,
      templates[kind].instructions,
    ]),
  );
}
