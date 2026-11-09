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

CVs now include Personal Projects immediately after Experience. TonyGL is required when present in the career master; the career service restores its source description if the model omits it. Core Skills ranks job matches first and uses compact category lists with modern supported extras. Across every category, the model compares alternatives and favours modern technologies with broad contemporary use when relevance is comparable, checking for stronger options it has omitted. There is no hardcoded technology exclusion list. Edit `systemPrompt.ts` and `outputGuidance.ts` to adjust this general selection preference; the Vite/Webpack comparison in the system prompt is only an example.

Document-writing payloads include `requestedDocuments` (`cv`, `coverLetter`, or both). The system, drafting, revision and repair prompts respect that scope. The agent also removes unrequested fields from the structured output schema, so the model does not generate the other document. Revisions use the saved selection; personalisation-only changes request only the letter and preserve any CV in code. Contact details for standalone letters come directly from the career master, outside AI output.
