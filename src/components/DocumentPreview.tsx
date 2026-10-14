import { useState } from 'react';
import {
  ArrowUpRight,
  Download,
  FileText,
  Mail,
  LoaderCircle,
} from 'lucide-react';
import type { Application } from '../../shared/schema';
import { cvHeader } from '../../shared/cv-header';
import { formatEmploymentDate } from '../../shared/employment-dates';
import {
  documentQualityIssues,
  documentQualityMessage,
} from '../../shared/document-quality';

export function DocumentPreview({
  application,
  kind,
  busy,
}: {
  application?: Application;
  kind: 'cv' | 'coverLetter';
  busy: boolean;
}) {
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const cv = application?.documents.cv;
  const letter = application?.documents.coverLetter;
  const header = cv ? cvHeader(cv) : undefined;
  const theme = application?.templates[kind].theme;
  const unfinished = application
    ? documentQualityIssues(application.documents, kind).length > 0
    : false;
  const label = kind === 'cv' ? 'Tailored CV' : 'Cover letter';
  const pdfUrl = application
    ? `/api/applications/${application.id}/pdf/${kind}?v=${application.version}`
    : '';

  async function download() {
    setDownloading(true);
    setDownloadError('');
    try {
      const response = await fetch(`${pdfUrl}&download=1`);
      if (!response.ok)
        throw new Error('Could not create the PDF. Please try again.');
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download =
        `${cv?.name}-${application?.job.company}-${kind}.pdf`.replace(
          /[/\\]/g,
          '-',
        );
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      setDownloadError((error as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section
      className="document-card"
      aria-label={label}
    >
      <div className="document-toolbar">
        <div className="flex items-center gap-2.5">
          {kind === 'cv' ? <FileText size={16} /> : <Mail size={16} />}
          <h3>{label}</h3>
          {application && (
            <span className="mini-tag">v{application.version}</span>
          )}
        </div>
        <button
          className="download-button"
          disabled={!application || unfinished || busy || downloading}
          onClick={download}
          aria-label={`Download ${label} as PDF`}
        >
          {downloading ? (
            <LoaderCircle
              size={14}
              className="animate-spin"
            />
          ) : (
            <Download size={14} />
          )}
          <span>PDF</span>
        </button>
      </div>
      {downloadError && (
        <p
          className="inline-error"
          role="alert"
        >
          {downloadError}
        </p>
      )}
      {unfinished ? (
        <p
          className="inline-error"
          role="alert"
        >
          {documentQualityMessage}
        </p>
      ) : application && cv && letter ? (
        <>
          <div
            className="document-scroll"
            tabIndex={0}
            aria-label={`${label} content`}
          >
            <article
              className="paper"
              style={
                {
                  '--document-accent': theme?.accent,
                  fontFamily:
                    theme?.fontFamily === 'Times-Roman'
                      ? 'Georgia, serif'
                      : 'Arial, sans-serif',
                  fontSize: `${theme?.fontSize || 10}pt`,
                } as React.CSSProperties
              }
            >
              {kind === 'cv' ? (
                <header className="paper-cv-header">
                  <h2>{cv.name}</h2>
                  <p className="paper-headline">{cv.headline}</p>
                  <p className="paper-location">{header?.location}</p>
                  <p className="paper-contact">{header?.contact.join(' | ')}</p>
                </header>
              ) : (
                <>
                  <h2>{cv.name}</h2>
                  <p className="paper-contact">
                    {[header?.location, ...(header?.contact || [])]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </>
              )}
              {kind === 'cv' ? (
                <>
                  <h3>Experience</h3>
                  {cv.experience.map((role, i) => (
                    <section key={i}>
                      <h4>
                        {role.title} | {role.employer}
                      </h4>
                      <p className="paper-dates">
                        {formatEmploymentDate(role.start)} –{' '}
                        {formatEmploymentDate(role.end)}
                      </p>
                      <ul>
                        {role.bullets.map((bullet, j) => (
                          <li key={j}>{bullet}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  {!!cv.education.length && <h3>Education</h3>}
                  {cv.education.map((entry, i) => (
                    <p key={i}>{entry}</p>
                  ))}
                  <h3>Core Skills</h3>
                  {cv.skills.map((skill, i) => (
                    <p key={i}>
                      <strong>{skill.category}: </strong>
                      {skill.items.join(', ')}
                    </p>
                  ))}
                </>
              ) : (
                <div className="letter-content">
                  <p>{letter.date}</p>
                  <p>{letter.recipient}</p>
                  <p>
                    <strong>{letter.subject}</strong>
                  </p>
                  <p>{letter.greeting}</p>
                  {letter.paragraphs.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  <p>
                    {letter.signoff}
                    <br />
                    {letter.name}
                  </p>
                </div>
              )}
            </article>
          </div>
          <div className="document-footer">
            <span>Content preview · A4 export</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              View PDF layout <ArrowUpRight size={13} />
            </a>
          </div>
        </>
      ) : (
        <div className={`empty-preview ${busy ? 'is-generating' : ''}`}>
          <div
            className="ghost-paper"
            aria-hidden="true"
          >
            <div className="ghost-name" />
            <div className="ghost-subtitle" />
            <div className="ghost-rule" />
            {kind === 'cv' ? (
              <>
                <div className="ghost-label" />
                <div className="ghost-line" />
                <div className="ghost-line" />
                <div className="ghost-line short" />
                <div className="ghost-label" />
                <div className="ghost-line" />
                <div className="ghost-line short" />
                <div className="ghost-label" />
                <div className="ghost-line" />
                <div className="ghost-line" />
              </>
            ) : (
              <>
                <div className="ghost-line short" />
                <div className="ghost-label" />
                <div className="ghost-line" />
                <div className="ghost-line" />
                <div className="ghost-line short" />
                <div className="ghost-label" />
                <div className="ghost-line" />
                <div className="ghost-line" />
                <div className="ghost-line short" />
                <div className="ghost-signature" />
              </>
            )}
          </div>
          <div className="empty-caption">
            <h4>
              {busy
                ? `Preparing your ${kind === 'cv' ? 'CV' : 'cover letter'}…`
                : `Your ${kind === 'cv' ? 'next chapter' : 'first impression'}, tailored.`}
            </h4>
            <p>
              {kind === 'cv'
                ? 'Relevant experience. Clear impact. A better fit.'
                : 'A thoughtful introduction, in your own voice.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
