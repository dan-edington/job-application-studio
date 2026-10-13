export function CoverLetterPersonalisation({ value, onChange, disabled, saved = false }: { value: string; onChange: (value: string) => void; disabled: boolean; saved?: boolean }) {
  return <div className="paste-field">
    <label className="field-label" htmlFor="letter-personalisation">Cover letter personalisation <span>optional</span></label>
    <textarea id="letter-personalisation" aria-describedby="letter-personalisation-hint" rows={3} maxLength={3000} disabled={disabled} value={value} onChange={event => onChange(event.target.value)} placeholder="e.g. I’m a runner, so I understand the needs of people using a running app and would enjoy working on a product I’d use myself."/>
    <p className="field-hint" id="letter-personalisation-hint">Add personal interests, product familiarity or your motivation for this role. Used only in the cover letter.{saved && ' Edit or clear these notes, then choose Update previews or Regenerate application to apply them.'}</p>
  </div>;
}
