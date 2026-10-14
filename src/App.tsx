import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  FileCheck2,
  FolderOpen,
  Layers2,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import type { Application, ApplicationSummary } from '../shared/schema';
import { api } from './lib/api';
import { useStudio } from './store';
import { DocumentPreview } from './components/DocumentPreview';
import { Modal } from './components/Modal';
import { ApplicationActionDialog } from './components/ApplicationActionDialog';
import { CoverLetterPersonalisation } from './components/CoverLetterPersonalisation';

export function App() {
  const state = useStudio();
  const client = useQueryClient();
  const [showPaste, setShowPaste] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [savedPersonalisation, setSavedPersonalisation] = useState('');
  const [actionDialog, setActionDialog] = useState<
    'delete' | 'regenerate' | null
  >(null);
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState('');
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings,
    refetchInterval: 300000,
  });
  const history = useQuery({
    queryKey: ['applications'],
    queryFn: api.applications,
  });
  const current = useQuery({
    queryKey: ['application', state.activeId],
    queryFn: () => api.application(state.activeId!),
    enabled: !!state.activeId,
  });
  const application = state.activeId ? current.data : undefined;
  const model = settings.data?.models.includes(state.model)
    ? state.model
    : settings.data?.defaultModel || '';
  const personalisationChanged =
    !!application &&
    savedPersonalisation.trim() !==
      (application.coverLetterPersonalisation || '');

  function saved(app: Application) {
    setSavedPersonalisation(app.coverLetterPersonalisation || '');
    client.setQueryData(['application', app.id], app);
    state.set({ activeId: app.id });
    void client.invalidateQueries({ queryKey: ['applications'] });
  }

  const generate = useMutation({
    mutationFn: api.generate,
    onSuccess: (app) => {
      saved(app);
      setNotice(
        'Your application is ready. Review the documents and refine anything you like.',
      );
      setInstructions('');
    },
    onError: () => setShowPaste(true),
  });
  const revise = useMutation({
    mutationFn: () =>
      api.revise(
        application!.id,
        instructions,
        model,
        application!.version,
        savedPersonalisation,
      ),
    onSuccess: (app) => {
      saved(app);
      setInstructions('');
      setNotice(`Revision ${app.version} saved. Both previews are up to date.`);
    },
  });
  const regenerate = useMutation({
    mutationFn: ({
      id,
      selectedModel,
      version,
      personalisation,
    }: {
      id: string;
      selectedModel: string;
      version: number;
      personalisation: string;
    }) => api.regenerate(id, selectedModel, version, personalisation),
    onSuccess: (app) => {
      saved(app);
      setInstructions('');
      setActionDialog(null);
      setNotice(
        `Application regenerated as version ${app.version}. Both documents are ready to review.`,
      );
    },
  });
  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.delete(id, version),
    onSuccess: async (_result, { id }) => {
      state.newApplication();
      setActionDialog(null);
      setShowPaste(false);
      generate.reset();
      revise.reset();
      regenerate.reset();
      await client.cancelQueries({ queryKey: ['application', id] });
      client.removeQueries({ queryKey: ['application', id], exact: true });
      client.setQueryData<ApplicationSummary[]>(['applications'], (items) =>
        (items || []).filter((item) => item.id !== id),
      );
      void client.invalidateQueries({ queryKey: ['applications'] });
      setNotice('Application deleted.');
    },
  });
  const busy =
    generate.isPending ||
    revise.isPending ||
    regenerate.isPending ||
    remove.isPending;
  useEffect(() => {
    setInstructions('');
  }, [state.activeId]);
  useEffect(() => {
    setSavedPersonalisation(application?.coverLetterPersonalisation || '');
  }, [application?.id, application?.coverLetterPersonalisation]);

  function newApplication() {
    state.newApplication();
    generate.reset();
    revise.reset();
    regenerate.reset();
    remove.reset();
    setActionDialog(null);
    setNotice('');
    setShowPaste(false);
  }

  function openApplication(id: string) {
    state.set({ activeId: id });
    generate.reset();
    revise.reset();
    regenerate.reset();
    remove.reset();
    setNotice('');
    setActionDialog(null);
  }

  const error =
    generate.error || revise.error || settings.error || current.error;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          aria-label="Application Studio home"
        >
          <span className="brand-mark">
            <Layers2
              size={23}
              strokeWidth={1.7}
            />
          </span>
          <span>
            application<span className="brand-sub">STUDIO</span>
          </span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <button
          className={`nav-button ${!application ? 'active' : ''}`}
          onClick={newApplication}
          disabled={busy}
        >
          <Plus size={17} />
          New application<span className="nav-shortcut">↗</span>
        </button>
        <div className="history-heading">
          <span>RECENT APPLICATIONS</span>
          <span>{history.data?.length || '0'}</span>
        </div>
        <nav
          className="application-history"
          aria-label="Saved applications"
        >
          {history.isPending ? (
            <p className="history-empty">Loading applications…</p>
          ) : history.error ? (
            <button
              className="text-button"
              onClick={() => history.refetch()}
            >
              Retry loading drafts
            </button>
          ) : history.data?.length ? (
            history.data.map((item) => (
              <button
                key={item.id}
                className={`history-item ${state.activeId === item.id ? 'selected' : ''}`}
                disabled={busy}
                onClick={() => openApplication(item.id)}
              >
                <FolderOpen size={16} />
                <span>
                  <strong>{item.company}</strong>
                  <small>{item.title}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="history-empty">
              <FolderOpen size={20} />
              <p>A new opportunity starts here.</p>
              <span>Your saved applications will appear in this space.</span>
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-spark">✳</span>
            <p>
              Good work deserves
              <br />a great introduction.
            </p>
          </div>
          <button
            className="nav-button help-button"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={17} />
            How it works
            <ArrowUpRight
              size={14}
              className="ml-auto"
            />
          </button>
          <div className="profile">
            <span className="avatar">DE</span>
            <div>
              <strong>{settings.data?.profile.name || 'Your workspace'}</strong>
              <span>Personal workspace</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {application ? 'Application details' : 'New application'}
            </strong>
          </div>
          <span className="private-badge">
            <ShieldCheck size={14} />
            Local workspace
          </span>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                <span /> A LITTLE MORE YOU. A LOT MORE RELEVANT.
              </p>
              <h1>
                {application ? application.job.company : 'Make your next move.'}
              </h1>
              <p className="page-description">
                {application
                  ? application.job.title
                  : 'Turn a job posting into a CV and cover letter that tell the right story.'}
              </p>
            </div>
            <span
              className="heading-flower"
              aria-hidden="true"
            >
              ✳
            </span>
          </div>
          <div
            className="steps"
            aria-label="Application workflow"
          >
            <span className={!application ? 'current' : 'completed'}>
              <b>{application ? <Check size={12} /> : '1'}</b>Add a role
            </span>
            <i />
            <span className={application ? 'current' : ''}>
              <b>2</b>Review & refine
            </span>
            <i />
            <span>
              <b>3</b>Make it yours
            </span>
          </div>
          {settings.data && !settings.data.configured && (
            <div className="setup-banner">
              <SlidersHorizontal size={18} />
              <p>
                <strong>One quick setup, then you’re ready.</strong> Add your
                OpenAI API key to <code>.env</code> and restart the server.
              </p>
              <button onClick={() => setHelp(true)}>
                Setup guide <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          {settings.data?.modelWarning && (
            <div
              className="warning-message"
              role="status"
            >
              <p>{settings.data.modelWarning}</p>
              <button
                className="text-button"
                disabled={settings.isFetching}
                onClick={() => settings.refetch()}
              >
                {settings.isFetching
                  ? 'Loading models…'
                  : 'Retry loading models'}
              </button>
            </div>
          )}
          {!!settings.data?.models.length && (
            <p className="field-hint">
              {settings.data.modelSource === 'fallback'
                ? 'Showing built-in text models. GPT-5 nano has the lowest per-token price in this list; access depends on your API key.'
                : 'All models available to your API key are listed. For CVs and cover letters, choose a text model that supports structured output.'}
            </p>
          )}
          {settings.data?.templateWarnings.map((w) => (
            <p
              key={w}
              className="warning-message"
            >
              {w}
            </p>
          ))}
          {error && (
            <div
              className="error-banner"
              role="alert"
            >
              <p>{error.message}</p>
              <button
                className="text-button"
                onClick={() => {
                  generate.reset();
                  revise.reset();
                  void settings.refetch();
                  if (state.activeId) void current.refetch();
                }}
              >
                Dismiss / retry connection
              </button>
            </div>
          )}
          {current.isFetching && state.activeId && !application && (
            <div className="status-message">
              <LoaderCircle
                className="animate-spin"
                size={16}
              />
              Loading saved application…
            </div>
          )}
          {!application ? (
            <div className="setup-grid">
              <form
                className="role-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNotice('');
                  revise.reset();
                  generate.mutate({
                    url: state.url,
                    jobText: state.jobText,
                    model,
                    cvTemplate: state.cvTemplate,
                    letterTemplate: state.letterTemplate,
                    coverLetterPersonalisation:
                      state.coverLetterPersonalisation,
                  });
                }}
              >
                <div className="card-title">
                  <span className="small-icon">
                    <Link2 size={17} />
                  </span>
                  <div>
                    <h2>Start with the opportunity</h2>
                    <p>
                      We’ll find the connection between the role and your
                      experience.
                    </p>
                  </div>
                </div>
                <label
                  className="field-label"
                  htmlFor="job-url"
                >
                  Job posting URL
                </label>
                <div className="url-input">
                  <Link2 size={17} />
                  <input
                    id="job-url"
                    type="url"
                    required
                    placeholder="https://company.com/careers/your-next-role"
                    value={state.url}
                    disabled={busy}
                    onChange={(e) => state.set({ url: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="paste-toggle"
                  aria-expanded={showPaste}
                  onClick={() => setShowPaste(!showPaste)}
                >
                  Have the description instead? Paste it here{' '}
                  <ChevronDown
                    size={13}
                    className={showPaste ? 'rotate-180' : ''}
                  />
                </button>
                {showPaste && (
                  <div className="paste-field">
                    <label
                      htmlFor="job-text"
                      className="field-label"
                    >
                      Job description{' '}
                      <span>optional · used instead of fetching the URL</span>
                    </label>
                    <textarea
                      id="job-text"
                      rows={6}
                      maxLength={45000}
                      minLength={100}
                      value={state.jobText}
                      disabled={busy}
                      onChange={(e) => state.set({ jobText: e.target.value })}
                      placeholder="Paste the full role description, including responsibilities and requirements…"
                    />
                    <p className="field-hint">
                      Keep the original job URL above as a reference.
                    </p>
                  </div>
                )}
                <CoverLetterPersonalisation
                  value={state.coverLetterPersonalisation}
                  onChange={(value) =>
                    state.set({ coverLetterPersonalisation: value })
                  }
                  disabled={busy}
                />
                <div className="form-divider" />
                <div className="select-grid">
                  <div>
                    <label
                      className="field-label"
                      htmlFor="model"
                    >
                      AI model <Sparkles size={12} />
                    </label>
                    <select
                      id="model"
                      value={model}
                      disabled={busy || !model}
                      onChange={(e) => state.set({ model: e.target.value })}
                    >
                      {!model && (
                        <option value="">
                          {settings.isPending
                            ? 'Loading models…'
                            : 'No models available'}
                        </option>
                      )}
                      {settings.data?.models.map((m) => (
                        <option
                          key={m}
                          value={m}
                        >
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="field-label"
                      htmlFor="cv-template"
                    >
                      CV template
                    </label>
                    <select
                      id="cv-template"
                      value={state.cvTemplate}
                      disabled={busy}
                      onChange={(e) =>
                        state.set({ cvTemplate: e.target.value })
                      }
                    >
                      {settings.data?.templates
                        .filter((t) => t.kind !== 'coverLetter')
                        .map((t) => (
                          <option
                            key={t.id}
                            value={t.id}
                          >
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label
                      className="field-label"
                      htmlFor="letter-template"
                    >
                      Letter template
                    </label>
                    <select
                      id="letter-template"
                      value={state.letterTemplate}
                      disabled={busy}
                      onChange={(e) =>
                        state.set({ letterTemplate: e.target.value })
                      }
                    >
                      {settings.data?.templates
                        .filter((t) => t.kind !== 'cv')
                        .map((t) => (
                          <option
                            key={t.id}
                            value={t.id}
                          >
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="generate-row">
                  <span>
                    <ShieldCheck size={13} />
                    Grounded in your real experience
                  </span>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      busy ||
                      !model ||
                      !settings.data?.configured ||
                      !state.url.trim()
                    }
                  >
                    {generate.isPending ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Sparkles size={16} />
                    )}{' '}
                    {generate.isPending
                      ? 'Creating your application…'
                      : 'Generate application'}
                    {!generate.isPending && <ArrowRight size={16} />}
                  </button>
                </div>
              </form>
              <aside className="source-card">
                <div className="source-top">
                  <span className="small-icon">
                    <FileCheck2 size={19} />
                  </span>
                  <span className="connected">
                    <span /> {settings.data ? 'CONNECTED' : 'LOADING'}
                  </span>
                </div>
                <h2>
                  Your experience.
                  <br />
                  The source of truth.
                </h2>
                <p>
                  Every application starts with your career master, so the story
                  stays yours.
                </p>
                <div className="source-file">
                  <FileCheck2 size={16} />
                  <div>
                    <strong>Career master</strong>
                    <span>
                      {settings.data?.profile.source || 'Loading profile…'}
                    </span>
                  </div>
                  <Check size={15} />
                </div>
                <div className="source-facts">
                  <span>
                    {settings.data?.profile.roleCount || '—'} career chapters
                  </span>
                  <span>One authentic story</span>
                </div>
                <div className="source-footer">
                  <ShieldCheck size={14} />
                  <span>Facts first. No invented experience.</span>
                </div>
              </aside>
            </div>
          ) : (
            <div className="job-summary">
              <div>
                <span className="connected">
                  <span /> SAVED APPLICATION
                </span>
                <p>{application.job.summary}</p>
                <a
                  href={application.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original job posting <ArrowUpRight size={13} />
                </a>
              </div>
              <div className="saved-meta">
                <span>Version {application.version}</span>
                <strong>{application.model}</strong>
                <small>
                  Updated{' '}
                  {new Date(application.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </small>
              </div>
            </div>
          )}
          {application && (
            <div className="application-actions">
              <button
                className="secondary-button"
                disabled={busy || !model || !settings.data?.configured}
                onClick={() => {
                  regenerate.reset();
                  generate.reset();
                  revise.reset();
                  setActionDialog('regenerate');
                }}
              >
                <RefreshCw size={14} />
                Regenerate application
              </button>
              <button
                className="delete-application-button"
                disabled={busy}
                onClick={() => {
                  remove.reset();
                  setActionDialog('delete');
                }}
              >
                <Trash2 size={14} />
                Delete application
              </button>
            </div>
          )}
          {busy && (
            <div
              role="status"
              className="status-message"
            >
              <LoaderCircle
                size={16}
                className="animate-spin"
              />
              <span>
                {generate.isPending
                  ? 'Reading the role and writing your documents. This can take a few minutes.'
                  : regenerate.isPending
                    ? 'Regenerating both documents. Your saved application is kept until generation succeeds.'
                    : remove.isPending
                      ? 'Deleting application…'
                      : 'Applying your changes. Your current documents stay available until the revision is saved.'}
              </span>
            </div>
          )}
          {notice && (
            <p
              role="status"
              className="success-message"
            >
              <Check size={15} />
              {notice}
            </p>
          )}
          <div className="section-heading">
            <div>
              <h2>Your application, taking shape</h2>
              <span>
                {application
                  ? 'Review your drafts, then add your finishing touches.'
                  : 'Two documents. One consistent story.'}
              </span>
            </div>
            <span className="draft-badge">
              <span />
              {application ? 'Ready to refine' : 'Ready when you are'}
            </span>
          </div>
          <div
            className="previews-grid"
            aria-busy={busy}
          >
            <DocumentPreview
              application={application}
              kind="cv"
              busy={busy}
            />
            <DocumentPreview
              application={application}
              kind="coverLetter"
              busy={busy}
            />
          </div>
          {application && (
            <>
              <form
                className="revision-card"
                onSubmit={(event) => {
                  event.preventDefault();
                  generate.reset();
                  setNotice('');
                  revise.mutate();
                }}
              >
                <div className="card-title">
                  <span className="small-icon">
                    <WandSparkles size={18} />
                  </span>
                  <div>
                    <h2>A little fine-tuning?</h2>
                    <p>
                      Tell the agent what to change. Both previews will update
                      when it’s done.
                    </p>
                  </div>
                </div>
                <CoverLetterPersonalisation
                  value={savedPersonalisation}
                  onChange={setSavedPersonalisation}
                  disabled={busy}
                  saved
                />
                <label
                  className="field-label mt-4"
                  htmlFor="revision"
                >
                  Suggested changes
                </label>
                <textarea
                  id="revision"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={busy}
                  minLength={3}
                  maxLength={6000}
                  rows={3}
                  placeholder="e.g. Lead each relevant experience entry with React and TypeScript, explain the practical outcomes, and shorten the cover letter."
                />
                <div className="revision-footer">
                  <label>
                    AI model
                    <select
                      aria-label="Revision AI model"
                      value={model}
                      disabled={busy || !model}
                      onChange={(e) => state.set({ model: e.target.value })}
                    >
                      {!model && <option value="">No models available</option>}
                      {settings.data?.models.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    disabled={
                      busy ||
                      !model ||
                      (instructions.trim().length < 3 &&
                        !personalisationChanged) ||
                      !settings.data?.configured
                    }
                  >
                    {revise.isPending ? (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <RefreshCw size={15} />
                    )}
                    Update previews
                  </button>
                </div>
              </form>
              <details className="evidence-panel">
                <summary>
                  <ShieldCheck size={17} />
                  Behind the application
                  <span>
                    {application.documents.evidence.length} evidence matches ·{' '}
                    {application.documents.cautions.length} review notes
                  </span>
                  <ChevronDown size={15} />
                </summary>
                <div className="evidence-content">
                  <p className="field-hint">
                    These notes help you review the drafts. They are excluded
                    from downloaded documents. Always check the final wording
                    before submitting.
                  </p>
                  {application.documents.evidence.map((item, i) => (
                    <div
                      className="evidence-item"
                      key={i}
                    >
                      <strong>{item.requirement}</strong>
                      <p>{item.evidence}</p>
                      <span>{item.sourceIds.join(' · ')}</span>
                    </div>
                  ))}
                  {!!application.documents.cautions.length && (
                    <div className="review-notes">
                      <h3>Things to review</h3>
                      <ul>
                        {application.documents.cautions.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
              {!!application.revisions.length && (
                <details className="revision-history">
                  <summary>
                    Revision history ({application.revisions.length})
                  </summary>
                  {application.revisions.map((revision, i) => (
                    <div key={i}>
                      <span>
                        v{revision.version ?? i + 2} ·{' '}
                        {new Date(revision.date).toLocaleString('en-GB')}
                      </span>
                      <p>{revision.instructions}</p>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Layers2 size={13} />
              Made for your next chapter.
            </span>
            <span>
              Your experience stays at the heart of every application.
            </span>
          </footer>
        </div>
      </main>
      {actionDialog && application && (
        <ApplicationActionDialog
          action={actionDialog}
          application={application}
          model={model}
          models={settings.data?.models || []}
          configured={!!settings.data?.configured}
          pending={regenerate.isPending || remove.isPending}
          error={actionDialog === 'delete' ? remove.error : regenerate.error}
          onModelChange={(selectedModel) => state.set({ model: selectedModel })}
          onClose={() => {
            setActionDialog(null);
            if (remove.error || regenerate.error) void current.refetch();
          }}
          onConfirm={() => {
            setNotice('');
            if (actionDialog === 'delete')
              remove.mutate({
                id: application.id,
                version: application.version,
              });
            else
              regenerate.mutate({
                id: application.id,
                selectedModel: model,
                version: application.version,
                personalisation: savedPersonalisation,
              });
          }}
        />
      )}
      {help && (
        <Modal onClose={() => setHelp(false)}>
          <section
            className="help-modal"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setHelp(false);
            }}
          >
            <button
              autoFocus
              className="close-button"
              aria-label="Close setup guide"
              onClick={() => setHelp(false)}
            >
              <X size={19} />
            </button>
            <span className="small-icon">
              <Sparkles size={20} />
            </span>
            <h2 id="help-title">From opportunity to introduction.</h2>
            <ol>
              <li>
                <strong>Connect OpenAI</strong>
                <p>
                  Add <code>OPENAI_API_KEY</code> to the project’s{' '}
                  <code>.env</code> file, then restart with{' '}
                  <code>npm run dev</code>. Your key stays on the server.
                </p>
              </li>
              <li>
                <strong>Add the role</strong>
                <p>
                  Paste a public job URL and choose a model. If a page blocks
                  access, paste its job description too.
                </p>
              </li>
              <li>
                <strong>Make it yours</strong>
                <p>
                  Review both drafts and their evidence notes. Request changes,
                  then download each document as a PDF.
                </p>
              </li>
            </ol>
            <div className="help-template">
              <strong>Bring your own style</strong>
              <p>
                Add JSON templates to the <code>templates/</code> folder, then
                reload. See <code>templates/README.md</code> for the format.
              </p>
            </div>
            <p className="field-hint">
              Generation sends your career facts and the job description to
              OpenAI. Drafts are saved in a local database.
            </p>
            <button
              className="primary-button w-full justify-center"
              onClick={() => setHelp(false)}
            >
              Let’s get started <ArrowRight size={15} />
            </button>
          </section>
        </Modal>
      )}
    </div>
  );
}
