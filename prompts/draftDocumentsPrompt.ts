/**
 * Task instructions for writing a fresh CV, cover letter, evidence map and
 * cautions. Edit this for requirements specific to a new draft; shared rules
 * belong in systemPrompt.ts so they also apply to revisions and repairs.
 *
 * Used as the task field of the JSON user payload in draftDocuments() in
 * server/services/agent.ts. The payload also contains the career master, job,
 * date, personalisation and template instructions. Both initial generation and
 * Regenerate application use this prompt; regeneration replaces the documents
 * rather than revising their existing wording.
 */
export const draftDocumentsPrompt =
  'Write the tailored CV, cover letter, evidence map, and cautions. Apply the critical per-role keyword coverage and bullet-order rules: combine each role’s confirmed keywords with its fuller achievements and place the most job-matching keywords in the earliest bullets.';
