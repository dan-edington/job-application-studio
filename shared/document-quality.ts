import type { Documents } from './schema.js';

// Check finished document text, not evidence/cautions where review instructions belong.
// These deliberately targeted rules catch drafting artefacts without banning ordinary
// prose about paragraphs, appendices, templates or editing tools.
const draftingArtefacts = [
  /\bparagraphs?[_\s.-]*appendix[_\s.-]*\d+[\w-]*/i,
  /^\s*(?:paragraph|bullet)\s*\d+\s*[:.)-]/im,
  /\breplace\s+(?:after\s+(?:creation|generation)|this\s+(?:paragraph|text|section|placeholder)\b)/i,
  /^\s*(?:please\s+)?replace\s+(?:the\s+)?(?:paragraph|text|section|placeholder)\b/im,
  /\b(?:also\s+)?ensure\s+(?:that\s+)?this\s+(?:paragraph|section|letter|bullet)\b/i,
  /^\s*(?:\[(?:TODO|TBD)\]|TODO\b|TBD\b|(?:editor|drafting|writer)(?:'s)?\s+note\s*:)/im,
  /\[(?:insert|add|replace|write|your|company|employer|candidate|hiring manager|project|name|date|TODO|TBD)\b[^\]\n]*\]/i,
  /\{\{[^{}\n]+\}\}/,
];

export function documentQualityIssues(
  documents: Pick<Documents, 'cv' | 'coverLetter'>,
  kind?: 'cv' | 'coverLetter',
): string[] {
  const issues: string[] = [];

  function visit(value: unknown, path: string) {
    if (typeof value === 'string') {
      if (
        !value.trim() ||
        draftingArtefacts.some((pattern) => pattern.test(value))
      )
        issues.push(path);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value))
        visit(item, `${path}.${key}`);
    }
  }

  for (const documentKind of kind ? [kind] : (['cv', 'coverLetter'] as const))
    visit(documents[documentKind], documentKind);
  return issues;
}

export const documentQualityMessage =
  'This document contains unfinished drafting text. Regenerate the application or request a revision before downloading it.';
