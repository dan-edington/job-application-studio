import type {
  ApplicationDocuments,
  DocumentKind,
  DocumentSelection,
} from './schema.js';

export function selectedDocumentKinds(
  selection: DocumentSelection,
): DocumentKind[] {
  return selection === 'both' ? ['cv', 'coverLetter'] : [selection];
}

// Derive the selection from saved content, including drafts saved before the
// selector existed. This avoids a separate flag drifting from actual documents.
export function savedDocumentSelection(
  documents: ApplicationDocuments,
): DocumentSelection {
  if (documents.cv && documents.coverLetter) return 'both';
  return documents.cv ? 'cv' : 'coverLetter';
}
