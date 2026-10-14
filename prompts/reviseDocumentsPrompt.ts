/**
 * Task instructions for updating existing documents using the user's suggested
 * changes and the current writing rules. Edit this to adjust how previous
 * wording and revision history are retained while applying new requirements.
 *
 * Used as the task field in reviseDocuments() in server/services/agent.ts when
 * Update previews is requested. The payload includes currentDocuments,
 * revisionHistory, requestedChanges, career, job, templates and the current
 * coverLetterPersonalisation. personalisationOnly marks a notes-only update;
 * the service also preserves the existing CV in code for that case. The system
 * prompt remains active and the complete updated documents are required.
 */
export const reviseDocumentsPrompt =
  'Apply the requested changes and the current CV writing rules to the current documents. When updating the CV, recheck each role’s confirmed keywords against the job specification, weave matches into its achievement-based bullets and order the bullets with the most matching keywords first. Preserve other factual content and prior revisions where compatible with these rules. Remove legacy summary/profile and separate project fields. Rewrite any existing CV outcome metrics qualitatively. Return complete updated documents.';
