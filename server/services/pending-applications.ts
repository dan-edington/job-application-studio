import { randomUUID } from 'node:crypto';
import type {
  Application,
  GenerateInput,
  Job,
  CompanyNameRequest,
} from '../../shared/schema.js';
import type { Career } from './career.js';
import { AppError } from '../config.js';

export type PreparedApplication = {
  input: GenerateInput;
  job: Job;
  career: Career;
  templates: Application['templates'];
};

// Short-lived server-side continuations avoid paying for job analysis again
// after the user supplies a company. No career data or trusted job analysis is
// round-tripped through the browser. Entries expire and memory use is bounded.
export class PendingApplications {
  private entries = new Map<
    string,
    { prepared: PreparedApplication; expiresAt: number; busy: boolean }
  >();

  add(prepared: PreparedApplication): CompanyNameRequest {
    for (const [token, entry] of this.entries)
      if (!entry.busy && entry.expiresAt <= Date.now())
        this.entries.delete(token);
    if (this.entries.size >= 100)
      throw new AppError(
        503,
        'Too many pending applications. Please try again later.',
      );
    const token = randomUUID();
    this.entries.set(token, {
      prepared,
      expiresAt: Date.now() + 30 * 60 * 1000,
      busy: false,
    });
    return {
      status: 'company_name_required',
      token,
      jobTitle: prepared.job.title,
    };
  }

  async complete(
    token: string,
    generate: (prepared: PreparedApplication) => Promise<Application>,
  ): Promise<Application> {
    const entry = this.entries.get(token);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry && !entry.busy) this.entries.delete(token);
      throw new AppError(
        410,
        'This pending application has expired. Close this dialog and generate again; your entered job details are still in the form.',
      );
    }
    if (entry.busy)
      throw new AppError(409, 'This application is already being generated.');
    entry.busy = true;
    try {
      const application = await generate(entry.prepared);
      this.entries.delete(token);
      return application;
    } finally {
      entry.busy = false;
    }
  }
}
