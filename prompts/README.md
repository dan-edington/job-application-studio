# Editing AI prompts

All built-in AI instruction text is kept in this folder and imported by the application. Each exported prompt has a comment describing its purpose, caller and accompanying data.

| File                                                   | What to edit                                                              | Used when                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [systemPrompt.ts](systemPrompt.ts)                     | Shared factual rules, CV priorities, writing style and cover-letter rules | Drafting, regeneration, revisions and repairs                |
| [jobAnalysisPrompt.ts](jobAnalysisPrompt.ts)           | Extracting the role, requirements and keywords from a posting             | Analysing a new job posting                                  |
| [draftDocumentsPrompt.ts](draftDocumentsPrompt.ts)     | The task for creating fresh documents                                     | Initial generation and regeneration                          |
| [reviseDocumentsPrompt.ts](reviseDocumentsPrompt.ts)   | Applying requested changes to existing documents                          | Updating previews, including personalisation-only updates    |
| [repairDocumentsPrompt.ts](repairDocumentsPrompt.ts)   | Correcting unfinished text that failed quality checks                     | The single automatic repair attempt                          |
| [outputGuidance.ts](outputGuidance.ts)                 | Instructions attached to individual structured-output fields              | Job analysis and document generation, depending on the field |
| [standardTemplatePrompt.ts](standardTemplatePrompt.ts) | Style and length guidance for the built-in Studio standard template       | New applications using that template                         |

`server/services/agent.ts` assembles the runtime data: the career master, job, current documents, user changes, personalisation, selected template instructions and repair feedback. This data stays separate from the editable instruction text. Job analysis uses its own system prompt; document-writing calls combine `systemPrompt` with the appropriate task prompt and output-field guidance.

Change the exported text while keeping the export names intact. Run `npm run format` after editing. The development server reloads imported TypeScript changes; production requires `npm run build` and a server restart. Revisions or regeneration apply the updated instructions to existing applications; simply viewing a saved application does not rewrite it. A personalisation-only update preserves the existing CV.

Custom template instructions remain in `templates/*.json`, and career-specific preferences remain in `dan_edington_career_master.json`. Saved applications retain their template snapshots, so changing a template's instructions affects newly created applications rather than rewriting saved snapshots.

Prompts guide the AI; structural constraints and deterministic behaviour still live in code. For example, bullet limits are enforced in `shared/schema.ts`, factual checks in `server/services/career.ts`, quality checks in `shared/document-quality.ts`, and displayed employment dates in `shared/employment-dates.ts`.
