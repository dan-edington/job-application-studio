import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Application } from './schema.js';
import { applicantDetails } from './cv-header.js';
import { formatEmploymentDate } from './employment-dates.js';
import { documentTheme } from './document-theme.js';

export function ApplicationPdf({
  application,
  kind,
}: {
  application: Application;
  kind: 'cv' | 'coverLetter';
}) {
  const theme = documentTheme(application.templates[kind]);
  const s = StyleSheet.create({
    page: {
      padding: theme.margin,
      paddingBottom: Math.max(theme.margin, 36),
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      lineHeight: 1.45,
      color: '#252b2a',
    },
    name: {
      fontSize: 25,
      // React PDF inherits the resolved body line height, not its multiplier.
      // Give the larger name enough vertical space before the following line.
      lineHeight: 1.15,
      fontWeight: 'bold',
      color: theme.accent,
      marginBottom: 2,
    },
    headline: { fontSize: 12, lineHeight: 1.25, marginBottom: 4 },
    location: { fontSize: 9, color: '#58615e', marginBottom: 6 },
    contact: { fontSize: 8, color: '#58615e', marginBottom: 14 },
    cvHeader: { textAlign: 'center' },
    section: {
      fontSize: 10,
      fontWeight: 'bold',
      color: theme.accent,
      textTransform: 'uppercase',
      letterSpacing: 1.1,
      borderBottomWidth: 0.6,
      borderBottomColor: '#d7ddda',
      paddingBottom: 4,
      marginTop: 14,
      marginBottom: 7,
    },
    role: { fontWeight: 'bold', fontSize: 10.5 },
    muted: { color: '#64716b', fontSize: 9, marginBottom: 5 },
    bullet: { flexDirection: 'row', marginBottom: 3 },
    dot: { width: 11 },
    bulletText: { flex: 1 },
    paragraph: { marginBottom: 12 },
    projectLink: {
      fontSize: 8,
      lineHeight: 1.25,
      color: theme.accent,
      marginTop: 2,
    },
    footer: {
      position: 'absolute',
      bottom: 23,
      left: theme.margin,
      right: theme.margin,
      color: '#7a827e',
      fontSize: 8,
      textAlign: 'right',
    },
  });
  const cv = application.documents.cv;
  const letter = application.documents.coverLetter;
  if (!application.documents[kind])
    throw new Error('The requested document is unavailable.');
  const header = applicantDetails(application);
  return (
    <Document
      title={`${header.name} - ${kind === 'cv' ? 'CV' : 'Cover letter'} - ${application.job.company}`}
      author={header.name}
    >
      <Page
        size="A4"
        style={s.page}
        wrap
      >
        {kind === 'cv' && cv ? (
          <View
            style={s.cvHeader}
            wrap={false}
          >
            <Text style={s.name}>{header.name}</Text>
            <Text style={s.headline}>{cv.headline}</Text>
            <Text style={s.location}>{header.location}</Text>
            <Text style={s.contact}>{header.contact.join(' | ')}</Text>
          </View>
        ) : (
          <>
            <Text style={s.name}>{header.name}</Text>
            <Text style={s.contact}>
              {[header.location, ...header.contact]
                .filter(Boolean)
                .join('  |  ')}
            </Text>
          </>
        )}
        {kind === 'cv' && cv ? (
          <>
            <Text
              style={s.section}
              minPresenceAhead={65}
            >
              Experience
            </Text>
            {cv.experience.map((role, i) => (
              <View
                key={i}
                style={{ marginBottom: 10 }}
              >
                <View minPresenceAhead={40}>
                  <Text style={s.role}>
                    {role.title} | {role.employer}
                  </Text>
                  <Text style={s.muted}>
                    {formatEmploymentDate(role.start)} –{' '}
                    {formatEmploymentDate(role.end)}
                  </Text>
                </View>
                {role.bullets.map((bullet, j) => (
                  <View
                    key={j}
                    style={s.bullet}
                    wrap={false}
                  >
                    <Text style={s.dot}>•</Text>
                    <Text style={s.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
            {!!cv.personalProjects?.length && (
              <Text
                style={s.section}
                minPresenceAhead={50}
              >
                Personal Projects
              </Text>
            )}
            {cv.personalProjects?.map((project) => (
              <View
                key={project.sourceId}
                style={{ marginBottom: 6 }}
                wrap={false}
              >
                <Text style={s.role}>{project.name}</Text>
                <Text>{project.description}</Text>
                {project.repositoryUrl && (
                  <Link
                    src={project.repositoryUrl}
                    style={s.projectLink}
                  >
                    {project.repositoryUrl}
                  </Link>
                )}
              </View>
            ))}
            {cv.education.length > 0 && (
              <Text
                style={s.section}
                minPresenceAhead={40}
              >
                Education
              </Text>
            )}
            {cv.education.map((entry, i) => (
              <Text
                key={i}
                style={{ marginBottom: 4 }}
              >
                {entry}
              </Text>
            ))}
            <Text
              style={s.section}
              minPresenceAhead={40}
            >
              Core Skills
            </Text>
            {cv.skills.map((group, i) => (
              <Text
                key={i}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontWeight: 'bold' }}>{group.category}: </Text>
                {group.items.join(', ')}
              </Text>
            ))}
          </>
        ) : letter ? (
          <>
            <Text style={s.paragraph}>{letter.date}</Text>
            <Text style={s.paragraph}>{letter.recipient}</Text>
            <Text style={[s.role, s.paragraph]}>{letter.subject}</Text>
            <Text style={s.paragraph}>{letter.greeting}</Text>
            {letter.paragraphs.map((paragraph, i) => (
              <Text
                key={i}
                style={s.paragraph}
              >
                {paragraph}
              </Text>
            ))}
            <Text>{letter.signoff}</Text>
            <Text style={{ marginTop: 6 }}>{letter.name}</Text>
          </>
        ) : null}
        <Text
          fixed
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
