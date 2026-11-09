import { LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type {
  Application,
  DocumentSelection as Selection,
} from '../../shared/schema';
import { savedDocumentSelection } from '../../shared/document-selection';
import { DocumentSelection } from './DocumentSelection';
import { Modal } from './Modal';

export function ApplicationActionDialog({
  action,
  application,
  model,
  models,
  configured,
  pending,
  error,
  onModelChange,
  onConfirm,
  onClose,
}: {
  action: 'delete' | 'regenerate';
  application: Application;
  model: string;
  models: string[];
  configured: boolean;
  pending: boolean;
  error?: Error | null;
  onModelChange: (model: string) => void;
  onConfirm: (selection: Selection) => void;
  onClose: () => void;
}) {
  const deleting = action === 'delete';
  const [selection, setSelection] = useState(() =>
    savedDocumentSelection(application.documents),
  );
  return (
    <Modal
      labelledBy="application-action-title"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <section
        className="help-modal action-dialog"
        aria-busy={pending}
      >
        <span className="small-icon">
          {deleting ? <Trash2 size={20} /> : <RefreshCw size={20} />}
        </span>
        <h2 id="application-action-title">
          {deleting
            ? 'Delete this application?'
            : 'Regenerate this application?'}
        </h2>
        <p>
          <strong>
            {application.job.title} at {application.job.company}
          </strong>
        </p>
        <p>
          {deleting
            ? 'This permanently removes the saved application, its documents and revision history. Files you already downloaded are kept.'
            : 'Create the selected documents using the saved role analysis, your latest career master, current writing rules and this application’s saved templates. This replaces the application’s documents with your selection and clears revision history only after generation succeeds.'}
        </p>
        {!deleting && (
          <div className="action-model">
            <DocumentSelection
              id="regenerate-documents"
              value={selection}
              onChange={setSelection}
              disabled={pending}
            />
            <label
              htmlFor="regenerate-model"
              className="field-label"
            >
              AI model
            </label>
            <select
              id="regenerate-model"
              value={model}
              disabled={pending || !models.length}
              onChange={(event) => onModelChange(event.target.value)}
            >
              {!models.length && <option value="">No models available</option>}
              {models.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </div>
        )}
        {error && (
          <p
            className="action-error"
            role="alert"
          >
            {error.message}
          </p>
        )}
        {pending && (
          <p role="status">
            {deleting
              ? 'Deleting application…'
              : 'Writing fresh documents. This can take a few minutes.'}
          </p>
        )}
        <div className="dialog-actions">
          <button
            autoFocus
            className="secondary-button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={deleting ? 'danger-button' : 'primary-button'}
            disabled={pending || (!deleting && (!configured || !model))}
            onClick={() => onConfirm(selection)}
          >
            {pending ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : deleting ? (
              <Trash2 size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            {deleting ? 'Delete permanently' : 'Regenerate documents'}
          </button>
        </div>
      </section>
    </Modal>
  );
}
