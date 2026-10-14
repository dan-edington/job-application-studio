/**
 * Default writing guidance for the built-in Studio standard template, shared by
 * the CV and cover letter. Edit this for that template's presentation and length
 * preferences; universal content rules belong in systemPrompt.ts.
 *
 * Used as standardTemplate.instructions in server/services/templates.ts. When
 * selected, it reaches draftDocuments() or reviseDocuments() through the
 * templates payload. Applications save a template snapshot, so editing this
 * default affects newly created applications; saved ones retain their snapshot.
 * Optional user templates keep their own instructions in templates/*.json.
 */
export const standardTemplatePrompt =
  'A concise, ATS-friendly CV. Aim for two pages. Keep the cover letter to one page.';
