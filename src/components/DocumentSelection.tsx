import type { DocumentSelection as Selection } from '../../shared/schema';

export function DocumentSelection({
  value,
  onChange,
  disabled,
  id = 'document-selection',
}: {
  value: Selection;
  onChange: (value: Selection) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="document-selection">
      <label
        className="field-label"
        htmlFor={id}
      >
        Documents to generate
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Selection)}
      >
        <option value="both">CV and cover letter</option>
        <option value="cv">CV only</option>
        <option value="coverLetter">Cover letter only</option>
      </select>
    </div>
  );
}
