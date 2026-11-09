import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Modal } from './Modal';
import { isMissingCompanyName } from '../../shared/company-name';

export function CompanyNameDialog({
  jobTitle,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  jobTitle: string;
  pending: boolean;
  error?: Error | null;
  onConfirm: (companyName: string) => void;
  onClose: () => void;
}) {
  const [companyName, setCompanyName] = useState('');
  return (
    <Modal
      labelledBy="company-name-title"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="help-modal"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !isMissingCompanyName(companyName))
            onConfirm(companyName.trim());
        }}
      >
        <h2 id="company-name-title">What’s the company name?</h2>
        <p>
          The job description for {jobTitle} doesn’t specify the company. Add
          its name to continue generating your application.
        </p>
        <label
          className="field-label"
          htmlFor="company-name"
        >
          Company name
        </label>
        <input
          id="company-name"
          className="company-name-input"
          autoFocus
          required
          maxLength={200}
          value={companyName}
          disabled={pending}
          onChange={(event) => setCompanyName(event.target.value)}
        />
        {error && (
          <p
            className="action-error"
            role="alert"
          >
            {error.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={pending || isMissingCompanyName(companyName)}
          >
            {pending && (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            )}
            {pending ? 'Generating…' : 'Continue generating'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
