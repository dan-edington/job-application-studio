/**
 * Task instructions for updating existing documents using the user's suggested
 * changes and the current writing rules. Edit this to adjust how previous
 * wording and revision history are retained while applying new requirements.
 *
 * Used as the task field in reviseDocuments() in server/services/agent.ts when
 * Update previews is requested. The payload includes currentDocuments,
 * requestedDocuments, revisionHistory, requestedChanges, career, job, templates and the current
 * coverLetterPersonalisation. personalisationOnly marks a notes-only update;
 * only the letter is generated and the service preserves any existing CV in code. The system
 * prompt remains active and the complete updated documents are required.
 */
export const reviseDocumentsPrompt =
  'Apply the requested changes and current writing rules only to the documents listed in requestedDocuments. When updating the CV, recheck each role’s confirmed keywords against the job specification, weave matches into its achievement-based bullets and order the bullets with the most matching keywords first. Preserve other factual content and prior revisions where compatible with these rules. Remove legacy summary/profile and obsolete projects fields, retaining personalProjects under the current rules. Rewrite any existing CV outcome metrics qualitatively. Return complete updated versions of the requested documents with evidence and cautions; never create an unrequested document.';
