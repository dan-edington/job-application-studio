import type { Application, Applicant } from './schema.js';

// Older saved CVs stored location as the first contact entry.
// Read both formats without rewriting saved application content.
export function cvHeader(cv: { location?: string; contact: string[] }) {
  if (cv.location !== undefined)
    return { location: cv.location, contact: cv.contact };
  return { location: cv.contact[0] || '', contact: cv.contact.slice(1) };
}

// Cover-letter-only applications use canonical contact details snapshotted at
// generation time, without requiring the AI to generate a CV for the header.
export function applicantDetails(application: Application): Applicant {
  if (application.documents.cv)
    return {
      name: application.documents.cv.name,
      ...cvHeader(application.documents.cv),
    };
  return (
    application.applicant ?? {
      name: application.documents.coverLetter?.name ?? '',
      location: '',
      contact: [],
    }
  );
}
