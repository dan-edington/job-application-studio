import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { renderToBuffer } from '@react-pdf/renderer';
import { ZodError } from 'zod';
import { config, AppError } from './config.js';
import { ApplicationRepository } from './repository.js';
import {
  generateSchema,
  completeApplicationSchema,
  reviseSchema,
  regenerateSchema,
  deleteSchema,
  type Application,
} from '../shared/schema.js';
import { isMissingCompanyName } from '../shared/company-name.js';
import {
  PendingApplications,
  type PreparedApplication,
} from './services/pending-applications.js';
import { ApplicationPdf } from '../shared/pdf.js';
import { applicantDetails } from '../shared/cv-header.js';
import { savedDocumentSelection } from '../shared/document-selection.js';
import {
  documentQualityIssues,
  documentQualityMessage,
} from '../shared/document-quality.js';
import { loadCareer, careerApplicant } from './services/career.js';
import {
  loadTemplates,
  selectTemplate,
  standardTemplate,
} from './services/templates.js';
import { listModels, validateModel } from './services/models.js';
import { readJob } from './services/job.js';
import {
  analyseJob,
  draftDocuments,
  reviseDocuments,
} from './services/agent.js';

export function createApp(
  repository = new ApplicationRepository(config.databasePath),
) {
  const app = express();
  const pendingApplications = new PendingApplications();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'frame-src': ["'self'", 'blob:'],
          'img-src': ["'self'", 'data:'],
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    const origin = req.get('origin');
    if (
      origin &&
      ![
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        `http://${req.get('host')}`,
        `https://${req.get('host')}`,
      ].includes(origin)
    )
      return next(
        new AppError(403, 'Cross-origin API requests are not allowed.'),
      );
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/settings', async (_req, res) => {
    const [career, templates, models] = await Promise.all([
      loadCareer(),
      loadTemplates(),
      listModels(),
    ]);
    res.json({
      configured: !!config.apiKey && !models.authenticationFailed,
      modelSource: models.source,
      models: models.models,
      defaultModel: models.models.includes(config.defaultModel)
        ? config.defaultModel
        : models.models[0] || '',
      modelWarning: models.warning,
      templates: templates.templates,
      templateWarnings: templates.warnings,
      profile: {
        name: career.personal.preferredName,
        role: career.personal.headlineOptions[0],
        source: path.basename(config.careerPath),
        roleCount: career.employment.length,
      },
    });
  });
  app.get('/api/applications', (_req, res) => res.json(repository.list()));
  app.get('/api/applications/:id', (req, res) =>
    res.json(repository.get(req.params.id)),
  );
  app.delete('/api/applications/:id', (req, res) => {
    const input = deleteSchema.parse(req.body);
    repository.delete(req.params.id, input.version);
    res.status(204).end();
  });
  const generationLimit = rateLimit({
    windowMs: 60000,
    limit: 6,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: 'Please wait a minute before making more generation requests.',
    },
  });
  app.post('/api/applications', generationLimit, async (req, res) => {
    const input = generateSchema.parse(req.body);
    await validateModel(input.model);
    const [career, templateData, jobText] = await Promise.all([
      loadCareer(),
      loadTemplates(),
      readJob(input.url, input.jobText),
    ]);
    const templates = {
      cv:
        input.documentSelection === 'coverLetter'
          ? standardTemplate
          : selectTemplate(templateData.templates, input.cvTemplate, 'cv'),
      coverLetter:
        input.documentSelection === 'cv'
          ? standardTemplate
          : selectTemplate(
              templateData.templates,
              input.letterTemplate,
              'coverLetter',
            ),
    };
    const job = await analyseJob(jobText, input.model);
    const prepared = { input, career, templates, job };
    if (isMissingCompanyName(job.company)) {
      res.status(202).json(pendingApplications.add(prepared));
      return;
    }
    res.status(201).json(await savePreparedApplication(prepared));
  });

  app.post('/api/applications/complete', generationLimit, async (req, res) => {
    const { token, companyName } = completeApplicationSchema.parse(req.body);
    const application = await pendingApplications.complete(
      token,
      async (prepared) => {
        await validateModel(prepared.input.model);
        return savePreparedApplication({
          ...prepared,
          job: { ...prepared.job, company: companyName },
        });
      },
    );
    res.status(201).json(application);
  });

  async function savePreparedApplication({
    input,
    career,
    templates,
    job,
  }: PreparedApplication): Promise<Application> {
    const documents = await draftDocuments(
      career,
      job,
      templates,
      input.model,
      input.coverLetterPersonalisation,
      input.documentSelection,
    );
    const date = new Date().toISOString();
    const application: Application = {
      id: randomUUID(),
      url: input.url,
      model: input.model,
      coverLetterPersonalisation: input.coverLetterPersonalisation,
      createdAt: date,
      updatedAt: date,
      version: 1,
      job,
      documents,
      applicant: careerApplicant(career),
      templates,
      revisions: [],
    };
    return repository.create(application);
  }

  app.post(
    '/api/applications/:id/revise',
    generationLimit,
    async (req, res) => {
      const input = reviseSchema.parse(req.body);
      const application = repository.get(String(req.params.id));
      if (application.version !== input.version)
        throw new AppError(
          409,
          'This draft has changed. Reopen it before making another revision.',
        );
      if (!application.documents.coverLetter && !input.instructions.trim())
        throw new AppError(400, 'Add suggested changes to revise this CV.');
      await validateModel(input.model);
      const coverLetterPersonalisation =
        input.coverLetterPersonalisation ??
        application.coverLetterPersonalisation ??
        '';
      const career = await loadCareer();
      const documents = await reviseDocuments(
        career,
        { ...application, coverLetterPersonalisation },
        input.instructions,
        input.model,
      );
      const date = new Date().toISOString();
      res.json(
        repository.update(
          {
            ...application,
            documents,
            applicant: careerApplicant(career),
            coverLetterPersonalisation,
            model: input.model,
            updatedAt: date,
            version: application.version + 1,
            revisions: [
              ...application.revisions,
              {
                instructions:
                  input.instructions || 'Updated cover-letter personalisation.',
                date,
                version: application.version + 1,
              },
            ],
          },
          input.version,
        ),
      );
    },
  );
  app.post(
    '/api/applications/:id/regenerate',
    generationLimit,
    async (req, res) => {
      const input = regenerateSchema.parse(req.body);
      const application = repository.get(String(req.params.id));
      if (application.version !== input.version)
        throw new AppError(
          409,
          'This draft has changed. Reopen it before regenerating.',
        );
      await validateModel(input.model);
      const coverLetterPersonalisation =
        input.coverLetterPersonalisation ??
        application.coverLetterPersonalisation ??
        '';
      const career = await loadCareer();
      const documentSelection =
        input.documentSelection ??
        savedDocumentSelection(application.documents);
      const documents = await draftDocuments(
        career,
        application.job,
        application.templates,
        input.model,
        coverLetterPersonalisation,
        documentSelection,
      );
      res.json(
        repository.update(
          {
            ...application,
            documents,
            applicant: careerApplicant(career),
            coverLetterPersonalisation,
            model: input.model,
            updatedAt: new Date().toISOString(),
            version: application.version + 1,
            revisions: [],
          },
          input.version,
        ),
      );
    },
  );
  app.get('/api/applications/:id/pdf/:kind', async (req, res) => {
    if (!['cv', 'coverLetter'].includes(req.params.kind))
      throw new AppError(400, 'Unknown document type.');
    const application = repository.get(req.params.id);
    const kind = req.params.kind as 'cv' | 'coverLetter';
    if (!application.documents[kind])
      throw new AppError(
        404,
        'This application does not contain that document.',
      );
    if (documentQualityIssues(application.documents, kind).length)
      throw new AppError(422, documentQualityMessage);
    const buffer = await renderToBuffer(ApplicationPdf({ application, kind }));
    const filename =
      `${applicantDetails(application).name}-${application.job.company}-${kind}`
        .replace(/[^a-z0-9-]/gi, '_')
        .slice(0, 150);
    res
      .type('pdf')
      .set(
        'Content-Disposition',
        `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${filename}.pdf"`,
      )
      .send(buffer);
  });
  app.use('/api', (_req, _res, next) =>
    next(new AppError(404, 'API endpoint not found.')),
  );
  const clientDir = path.resolve('dist/client');
  app.use(express.static(clientDir));
  app.get('/{*path}', (_req, res, next) =>
    res.sendFile(path.join(clientDir, 'index.html'), (error) => {
      if (error) next(error);
    }),
  );

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request is too large.' });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON request.' });
      return;
    }
    console.error('Request failed:', error.name || 'Error');
    res.status(500).json({
      error:
        'Something went wrong. Please try again. Your saved applications are unchanged.',
    });
  };

  app.use(errorHandler);
  return app;
}
