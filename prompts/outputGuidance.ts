/**
 * Field-level guidance for job.keywords in the structured job-analysis schema.
 * Used by jobSchema in shared/schema.ts during analyseJob(). It reinforces
 * which terms to extract and their casing; it does not change the schema's
 * array limit or add technologies to the source posting.
 */
export const jobKeywordsGuidance =
  'Role-specific terms explicitly present in the job specification, primarily technologies such as JavaScript, CSS, AWS and CI/CD. Preserve the exact casing in the posting. Exclude generic recruiting language.';

/**
 * General description of the CV headline field in documentsSchema, defined in
 * shared/schema.ts. It explains the source of eligible headlines. During AI
 * document calls, careerDocumentsSchema() replaces this field with the actual
 * career-master enum and uses selectedHeadlineGuidance below.
 */
export const cvHeadlineGuidance =
  'The closest matching option from personal.headlineOptions for the job-spec role title.';

/**
 * Field-level instructions for cv.contact in shared/schema.ts. Sent with the
 * structured output schema during document generation, revisions and repairs
 * to keep location in its separate field. The career service still restores
 * canonical contact details after generation.
 */
export const cvContactGuidance =
  'Contact details and URLs only; location has its own field.';

/**
 * Field-level instructions for each employment entry's bullets in
 * shared/schema.ts. These reinforce role-specific keyword coverage, bullet
 * ordering and readable, factual outcomes directly beside the generated array.
 * Sent during document generation, regeneration, revisions and repairs. The
 * maximum bullet count is enforced separately by the schema, not this text.
 */
export const experienceBulletsGuidance =
  'Critical priority: use this employment entry’s keywords as confirmed technologies/activities and responsibilitiesAndAchievements as the fuller descriptions. Weave job-matching keywords into the most appropriate bullets even when the descriptions do not repeat them. At most five recruiter-readable what/why/outcome bullets, ordered with the most distinct job-matching keywords first. Unrelated skills only in later bullets. Match job-spec casing; no invented project relationships or quantified outcomes.';

/**
 * Instructions attached to cv.skills in shared/schema.ts, sent during drafting,
 * regeneration, revisions and repairs. Encourages broad category coverage within
 * the page budget while ranking job matches above supported modern extras.
 * The system prompt expands the general comparison rule with an illustrative
 * example; neither prompt defines a technology exclusion list.
 */
export const coreSkillsGuidance =
  'Use as many career-master skill categories as fit concisely within a two-page CV. Order categories by job relevance and each category with supported job-spec matches first, then useful modern supported skills. Across every category, compare alternatives serving a similar purpose and favour modern technologies with broad contemporary use when relevance is comparable. Do not select an older alternative while omitting a more suitable supported modern option. This is a general preference, not an exclusion list: older skills may still add distinct value, and explicit job requirements take priority. Preserve foundational skills and proficiency caveats. Prefer short category lines over exhaustive lists; never invent skills or follow source-list order without assessing relevance.';

/**
 * Instructions attached to cv.personalProjects in shared/schema.ts and used in
 * every document-writing call. The renderers place these entries immediately
 * after Experience. Only personalProjects from the career master may be used;
 * the career service validates IDs and ensures TonyGL is included when present.
 */
export const personalProjectsGuidance =
  'Always include TonyGL (sourceId tonygl) when present in career.personalProjects. Write a concise, finished description based on its description, technologies and features, emphasising supported job-relevant details. It is an independent learning project, not employment or client work. Preserve source IDs and names; never invent users, outcomes or production adoption. The application appends the repository URL directly from the master; do not invent a link or repeat the URL in the description.';

/**
 * Field-level instructions for each coverLetter.paragraphs item in
 * shared/schema.ts. Sent with every document-generation schema to encourage
 * finished prose without labels, placeholders or editing instructions. The
 * separate document-quality checks still reject detected drafting artefacts.
 */
export const coverLetterParagraphGuidance =
  'A finished, ready-to-send paragraph in the candidate’s voice. No internal labels, schema keys, placeholders or instructions to edit text later.';

/**
 * Description attached to the dynamic headline enum in careerDocumentsSchema()
 * in server/services/agent.ts. Used for drafts, regeneration, revisions and
 * repairs. It guides selection among personal.headlineOptions; the enum and
 * enforceFacts() separately restrict values and adapt interchangeable wording.
 */
export const selectedHeadlineGuidance =
  'Pick the option closest to the job-spec role name. Treat Developer/Engineer and Frontend/Front end as equivalent.';
