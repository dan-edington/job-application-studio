# Document templates

Add a `.json` file here and refresh the app's settings (or reload the page). Both selectors include the built-in Studio standard template. Files are validated; invalid files produce a visible warning rather than breaking generation.

Use `editorial.json` as an example. Each template has:

- `id`: unique lowercase letters, digits and hyphens; `standard` is reserved.
- `name`, `description`: shown in the app.
- `kind`: `cv`, `coverLetter`, or `both`.
- `instructions`: guidance on tone, emphasis, length and structure. Cannot override factual rules.
- `theme.accent`: six-digit hex colour.
- `theme.fontFamily`: `Helvetica` or `Times-Roman` (PDF built-in fonts).
- `theme.fontSize`: 9–13 points.
- `theme.margin`: 28–65 points.

Templates are snapshotted into a saved application, so later edits do not silently change an existing draft's PDF. CV and cover-letter templates can be selected independently. This version supports JSON templates, not Word, PDF or HTML uploads. For new layouts, extend the typed schema in `shared/schema.ts` and the shared document renderer in `shared/pdf.tsx`.

CV generation rules take precedence over template instructions: no summary, body sections in the order Experience, Education, Core Skills, and a centred header with separate name, role and location lines. Templates can change typography and colour, but cannot restore a profile or separate projects section. Experience bullets prioritise truthful job-spec technology keywords, use plain-English what/why/outcome wording, and omit quantified outcomes.
