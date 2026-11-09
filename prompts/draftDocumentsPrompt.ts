/**
 * Task instructions for writing a fresh CV, cover letter, evidence map and
 * cautions. Edit this for requirements specific to a new draft; shared rules
 * belong in systemPrompt.ts so they also apply to revisions and repairs.
 *
 * Used as the task field of the JSON user payload in draftDocuments() in
 * server/services/agent.ts. The payload also contains the career master, job,
 * requestedDocuments, date, relevant personalisation and template instructions. Both initial generation and
 * Regenerate application use this prompt; regeneration replaces the documents
 * rather than revising their existing wording.
 */
export const draftDocumentsPrompt =
  'Write only the documents listed in requestedDocuments, with their evidence map and cautions. If a CV is requested, apply the critical per-role keyword coverage and bullet-order rules: combine each role’s confirmed keywords with its fuller achievements and place the most job-matching keywords in the earliest bullets. If a cover letter is requested, write a complete tailored letter. Do not generate an unrequested document.';
