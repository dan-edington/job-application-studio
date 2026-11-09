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
- `theme.margin`: 24–65 points (24 by default).

Templates are snapshotted into a saved application. Custom templates and explicit custom margins retain their saved values. The built-in layouts now use smaller margins: Studio standard uses 24pt and Classic editorial uses 36pt. The renderers also apply these compact margins to saved snapshots with the previous built-in defaults (standard 30/42pt or editorial 46pt), so existing applications benefit on their next download. PDF bottom padding is at least 36pt to leave room for page numbers. CV and cover-letter templates can be selected independently. This version supports JSON templates, not Word, PDF or HTML uploads. For new layouts, extend the typed schema in `shared/schema.ts` and the shared document renderer in `shared/pdf.tsx`.

CV generation rules take precedence over template instructions: no summary, body sections in the order Experience, Personal Projects, Education, Core Skills, and a centred header with separate name, role and location lines. TonyGL is always included when present in the career master. Experience bullets prioritise truthful job-spec technology keywords, use plain-English what/why/outcome wording, and omit quantified outcomes. Core Skills prioritises job matches, then supported modern technologies, using concise lists to cover as many useful categories as possible. In every category, favour modern, broadly adopted options over older alternatives when relevance is comparable, without a fixed exclusion list or dropping explicit job requirements.
