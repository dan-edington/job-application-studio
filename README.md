# Job Application Studio

A local web app that turns a job posting and a career data JSON file into a tailored CV, cover letter, or both. Review your selected documents, ask for changes, and download individual A4 PDFs.

## 🤖 Built with Codex

This project was built using OpenAI Codex as an AI coding assistant. I wanted to experiment with how far I could take AI-assisted development, from initial requirements through to a working full-stack application.

Codex handled much of the implementation, with me guiding the requirements, architecture, functionality and iterations throughout the process.

## Run locally

Use **Node.js 24 LTS** (minimum 22.13; the backend uses built-in SQLite).

```sh
npm install
cp .env.example .env  # only if .env does not already exist
cp example_career_master.json career_master.json  # only if .env does not already exist
```

Add your key and career JSON to `.env`:

```dotenv
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-5-nano
CAREER_MASTER_PATH=career_master.json
```

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. Express listens on port 3001; Vite proxies `/api` to it. Restart after changing `.env`. The supplied `.env` has an empty key; nothing is sent to OpenAI until you generate or revise. The key stays server-side and `.env` is gitignored.

1. Paste a public job posting URL. For blocked, login-protected or JavaScript-only job pages, expand the pasted-description field and paste the full text, keeping the URL as a reference.
2. Choose **CV and cover letter**, **CV only**, or **Cover letter only** under **Documents to generate**, then choose an OpenAI model and templates for the selected documents.
3. Generate the application. The backend extracts the role, then drafts only the selected documents using the canonical career facts. Unselected documents are omitted from the AI output schema, not generated and hidden.
4. Review the content previews and evidence notes. Use **View PDF layout** for exact pagination.
5. Enter suggested changes. Revisions use the current drafts, career facts, role and revision history; the selected previews update after a successful save.
6. Download each PDF next to its preview. Saved applications can be reopened from the sidebar.
7. Use **Regenerate application** to write fresh documents with a chosen model, the saved role analysis and templates, and your latest career master and writing rules. The dialog defaults to the saved document selection and lets you change it. It replaces the application’s documents with the new selection and clears revision history only after success; it does not re-fetch the job URL.
8. Use **Delete application** and confirm to permanently remove its saved documents and revision history. Previously downloaded files remain on your device.

When a cover letter is selected, the optional **Cover letter personalisation** box lets you add personal interests, product familiarity or motivation for a specific role, such as being a runner when applying to a running app. The notes are saved with that application and used in its cover letter during generation, regeneration and revisions. You can edit or clear them on a saved application and click **Update previews** without adding suggested changes; a personalisation-only update generates only the letter and preserves any existing CV. Notes are sent to OpenAI only when writing a cover letter and saved only when it succeeds. They supplement personal context without changing your career master or authorising invented professional claims.

New requests default to both documents for compatibility. Existing saved applications continue to work. A standalone cover letter uses canonical name and contact details saved from the career master, so it does not need a generated CV. Unselected document downloads return 404. Regeneration keeps the saved selection unless you change it; revisions do not add missing documents.

## Configuration

| Variable             | Purpose                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`     | Server-side OpenAI API key                                                                         |
| `OPENAI_MODEL`       | Optional preferred selection when present in the discovered or fallback list; default `gpt-5-nano` |
| `PORT`, `HOST`       | API port and bind address, defaults `3001` and `127.0.0.1`                                         |
| `CAREER_MASTER_PATH` | Path to canonical career JSON                                                                      |
| `TEMPLATES_DIR`      | Template directory, default `./templates`                                                          |
| `DATABASE_PATH`      | SQLite location, default `./data/applications.sqlite`                                              |

The OpenAI SDK fetches every model available to your API key from `/v1/models`. Successful results are cached for five minutes and refreshed periodically while the app is open. Model discovery is supported, but can fail because of an invalid key, restricted permissions, or network issues. Errors identify authentication (401), permissions (403), or rate limiting (429) without exposing the key.

If discovery fails, returns no models, or no key is configured, the app shows this built-in list:

| Model                  | Input / 1M tokens | Output / 1M tokens |
| ---------------------- | ----------------- | ------------------ |
| `gpt-5-nano` (default) | $0.05             | $0.40              |
| `gpt-4.1-nano`         | $0.10             | $0.40              |
| `gpt-5-mini`           | $0.25             | $2.00              |

Standard token rates checked on 13 October 2026: [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano), [GPT-4.1 nano](https://developers.openai.com/api/docs/models/gpt-4.1-nano), [GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini). GPT-5 nano has the lowest input rate and joint-lowest output rate in this list. Actual request cost depends on token usage, including reasoning tokens. These older models are marked deprecated in the catalogue; availability still depends on the account and OpenAI's retirement schedule. Review this fallback list as models are retired.

Fallback models support the Responses API and structured outputs. Listing them does not verify account access. A model-list permission or network failure no longer blocks an attempt to generate with a fallback model, but a known invalid key disables generation. For a 401 error, replace `OPENAI_API_KEY` in `.env` with a valid OpenAI API key and restart the server. A hardcoded model list cannot fix authentication. Failed discoveries can be retried immediately.

`OPENAI_MODEL` chooses the default only when the ID appears in the current list. Existing saved model preferences are reset once for the new budget default; subsequent choices remain remembered. Successful API discovery includes specialised image/audio/embedding models too, so choose a text model supporting structured outputs for document generation.

Changing the API port also requires updating Vite's proxy target. Run commands from the project root so data paths resolve consistently.

## CV writing and layout

Built-in AI prompts live in [`prompts/`](prompts/README.md), with comments explaining what each prompt does and where it is used. Edit those files to change the shared system rules, job analysis, drafting, revisions, repair instructions or output-field guidance.

CVs are tailored for a 20-second top-to-bottom scan. Keywords mean role-specific terms explicitly present in the job specification, primarily technologies such as JavaScript, CSS, AWS and CI/CD. Each employment entry leads with as many relevant, supported technologies as fit naturally; unrelated technologies are kept out of early bullets. Technologies are never transferred between employers simply to increase keyword coverage.

Each role's bullets are based on `employment[i].responsibilitiesAndAchievements`. These items are unordered: the agent selects, rewrites and, where supported, blends them by relevance to the role. It cross-checks that employment entry's `keywords` against the job specification. Skills unrelated to the specification can appear only in later bullets. Technology matching ignores case, but generated CV wording follows the exact casing from the posting, including in Core Skills (for example, `JavaScript` rather than `Javascript`). Job analysis preserves that casing for generation and revisions.

Role-level `keywords` are confirmed technologies used and activities performed in that employment, not just search hints. The agent combines them with the fuller achievement descriptions and weaves job-matching terms into the most appropriate bullets, even where the descriptions do not repeat the term. For example, Redux should appear in a relevant bullet when both the role inventory and posting include it. The system prompt makes coverage and ordering a critical priority: the earliest bullets must carry the most distinct matching keywords, and the agent checks each role for omissions and ordering before returning the CV. Specific project relationships and outcomes must still be supported by the facts.

The headline is selected from `personal.headlineOptions` to best match the role name, with Developer/Engineer and Frontend/Front end wording adapted to the posting. The structured output schema restricts selection to those master-file options and caps each employment entry at five bullets. Historical employment titles remain canonical.

Every bullet uses recruiter-friendly what/why/outcome wording. Outcomes stay qualitative, even where the master contains verified metrics. Dates and technology names such as 3D and WCAG 2.1 are retained. The CV has no summary. Personal Projects follows Experience and includes TonyGL whenever it is present in the career master, with a concise description tailored to the job. The backend validates project IDs, restores canonical names and fills in TonyGL from the master if the model omits it. Independent projects are not presented as employment.

Both previews and PDFs use a centred name, role, location and contact header. Name, role and location have separate lines; contact details and URLs use `|` separators. Body sections are **Experience → Personal Projects → Education → Core Skills**. The same rules apply when revising documents and override template structure. The career master's `writingPreferences.cvPrinciples` records these preferences too.

Core Skills puts supported job matches first, followed by useful supported modern technologies. Across every category, the agent compares alternatives serving a similar purpose and favours modern technologies with broad contemporary use when job relevance is comparable. It checks for stronger modern options omitted in favour of older alternatives. This is a general ranking preference, not a hardcoded exclusion list: older skills can still add distinct value, and explicit job requirements take priority. The agent is asked to cover as many useful categories as fit within the two-page target using concise lists, retaining proficiency caveats and established fundamentals. Selection and ordering instructions live in `prompts/systemPrompt.ts` and `prompts/outputGuidance.ts`.

The built-in CV and cover-letter layouts use compact margins (24pt standard, 36pt editorial), including older saved snapshots with the previous built-in defaults. Custom margins remain respected. PDF bottom padding leaves space for page numbers, and the name and headline have explicit line heights so the larger name cannot overlap the following line. Regenerate or request a CV revision to add TonyGL and apply the new skills rules to older applications; layout fixes apply when downloading again.

Employment dates display as full month names and years (for example, `May 2022 – June 2024`) in previews and PDFs, including existing saved applications. The backend retains the canonical dates from the career master; the display layer formats them without relying on the model. Year-only dates and labels such as `Present` are kept as supplied.

Existing saved CVs display in the new layout, including those whose location was stored in the old contact format. Their stored bullet wording is preserved until a revision or fresh generation is requested. Generated wording still needs human review for factual accuracy and compliance with the writing rules.

CV and cover-letter text is checked for known drafting artefacts, including internal paragraph labels, placeholders and editing instructions. Generation, regeneration and revisions make one repair attempt if these checks fail; a second failure returns an error without saving changes. Existing documents that fail these checks show a warning instead of a preview and cannot be exported as PDFs until revised or regenerated. These targeted checks complement, rather than replace, your final content review.

Each OpenAI call has a five-minute deadline, configurable with `OPENAI_TIMEOUT_MS` in `.env` (1,000–900,000 milliseconds; restart the server after changing it). GPT-5 nano uses low reasoning effort to reduce latency. Timeouts, authentication failures, rate limits, quota errors and invalid structured output have distinct error messages. Server diagnostics include the failed stage, model, elapsed time and error category, without logging API keys, prompts or document text. Job analysis, document writing and an optional repair are separate calls, so the complete operation can take longer than one call’s deadline.

## Templates

Add JSON files to `templates/`; see [the template guide](templates/README.md). Templates combine writing instructions and PDF styling. Independent dropdowns select CV and letter templates. Two styles are provided: Studio standard and Classic editorial. Existing applications retain a snapshot of their templates. Word/PDF/HTML template imports are not implemented.

## Architecture

```text
src/                       React frontend
  store.ts                 Zustand workspace preferences
  lib/api.ts               Typed API client
  components/              Document previews and downloads
shared/
  schema.ts                Shared Zod contracts and TypeScript types
  pdf.tsx                  Server-side A4 document renderer
server/
  app.ts                   Express routes, validation and error boundary
  repository.ts            SQLite persistence with optimistic concurrency
  services/
    agent.ts               Vercel AI SDK structured drafting and revision
    career.ts              Allowlisted career data and canonical fact checks
    job.ts                 URL retrieval and structured/visible text extraction
    models.ts              OpenAI SDK model discovery
    templates.ts           Template discovery and validation
prompts/                   Editable AI instructions with usage comments and a guide
templates/                 Optional user-provided JSON templates
tests/                     Service, API and browser tests
```

React handles the UI, Tailwind CSS and custom component styles handle presentation, Zustand keeps workspace preferences, and TanStack Query owns server state and mutations. The backend orchestrates extraction, role analysis and grounded writing with the Vercel AI SDK's OpenAI provider. The official OpenAI SDK is used for model discovery. Both use the same key. Schema-validated structured output keeps application content separate from presentation. PDFs are generated with React PDF and contain selectable text.

Routes:

| Method | Route                              | Behaviour                                                              |
| ------ | ---------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/settings`                    | Profile status, models and templates                                   |
| GET    | `/api/applications`                | Latest 100 saved applications                                          |
| GET    | `/api/applications/:id`            | Full saved application                                                 |
| DELETE | `/api/applications/:id`            | Delete with a `{ version }` body and conflict protection               |
| POST   | `/api/applications`                | Analyse role, generate and save                                        |
| POST   | `/api/applications/:id/revise`     | Revise with version conflict protection                                |
| POST   | `/api/applications/:id/regenerate` | Replace selected drafts using `{ model, version, documentSelection? }` |
| GET    | `/api/applications/:id/pdf/:kind`  | `cv` or `coverLetter`; `download=1` to download                        |
| GET    | `/api/health`                      | Health check                                                           |

Services are separate from routes and persistence so adding providers, background jobs, authentication or another database does not require rebuilding the UI. This first version runs generation within bounded HTTP requests; multi-user deployments should introduce a durable queue and job-status endpoints.

## Data and factual boundaries

- Career facts and the job description are sent to OpenAI for generation. Responses use `store: false`; OpenAI account retention policies still apply.
- Salary and career preferences are excluded from the allowlisted drafting context. The master file is never served statically.
- Employment names, titles and dates are restored from canonical source IDs after generation. Unknown employment and evidence IDs are rejected.
- Prompts forbid invented qualifications, metrics, proficiency claims and client mappings. Generated prose and evidence maps still require human review; this is not a complete factual verifier.
- Drafts, template snapshots and revision instructions are stored in `data/`. They persist across restarts. Back up this directory if needed; it is gitignored.
- Failed generations do not create incomplete drafts. Failed revisions and regenerations preserve the prior documents. Version checks reject stale concurrent revisions.
- Job fetching blocks private and reserved IPs, pins verified DNS results, revalidates redirects, and limits response size and time. It does not execute website scripts or bypass login walls.

This is a **single-user local application**, bound to loopback by default. Add authentication, per-user data isolation, TLS, appropriate origin policy, and rate-limit configuration before exposing it to other users or the public internet. No hosting deployment is included.

## Validation and production build

Formatting is automated with Prettier and ESLint Stylistic. Prettier expands JSX, uses one attribute per line for elements with multiple attributes, and applies two-space indentation. ESLint adds blank lines around function declarations, function-valued variables and class methods while allowing ordinary local variables to remain grouped.

```sh
npm run format        # Apply function spacing, then format the project
npm run format:check  # Check both spacing and formatting without changing files
npm run lint          # Check ESLint rules only
npm run lint:fix      # Apply ESLint fixes only
```

VS Code workspace settings enable formatting and ESLint fixes on save when the recommended Prettier and ESLint extensions are installed. Generated files, local data, environment files, the lockfile and the career master are excluded from Prettier.

```sh
npm run typecheck
npm test
npm run test:browser
npm run build
npm start
```

Browser tests use a locally installed Google Chrome. Install Chrome or change `channel` in `playwright.config.ts` and install Playwright Chromium. They cover the real frontend with mocked AI API responses. API tests mock AI calls but exercise the actual persistence, revisions and PDF renderer. They do not spend API credits or establish live model quality.

The production server serves `dist/client` and the API from **http://127.0.0.1:3001**. Keep `.env`, the career master, templates and the writable data directory alongside the deployment's project root. No secrets are included in the frontend bundle.

Implementation references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI model listing](https://developers.openai.com/api/reference/resources/models/methods/list), and [Vercel AI SDK structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data).
