import { cloneElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { ApplicationPdf } from '../shared/pdf';
import { documentTheme } from '../shared/document-theme';
import type { Application } from '../shared/schema';
import { fixture } from './fixtures';

// React PDF exposes its actual laid-out text through onRender. Checking these
// metrics catches overlaps that JSX snapshots and HTML previews cannot detect.
type LayoutNode = {
  box: {
    top: number;
    height: number;
    paddingLeft: number;
    paddingBottom: number;
  };
  children: LayoutNode[];
  lines?: {
    box: { y: number; height: number };
    ascent: number;
    runs: {
      attributes: {
        fontSize: number;
        font: { descent: number; unitsPerEm: number }[];
      };
    }[];
  }[];
};

async function renderLayout(
  application: Application,
  kind: 'cv' | 'coverLetter',
) {
  let layout: LayoutNode | undefined;
  const buffer = await renderToBuffer(
    cloneElement(ApplicationPdf({ application, kind }), {
      onRender: (result: unknown) => {
        layout = (result as { _INTERNAL__LAYOUT__DATA_: LayoutNode })
          ._INTERNAL__LAYOUT__DATA_;
      },
    }),
  );
  expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  expect(layout).toBeDefined();
  return layout!;
}

function assertTextFits(node: LayoutNode, next: LayoutNode) {
  expect(node.lines?.length).toBeGreaterThan(0);
  for (const line of node.lines!) {
    const descent = Math.max(
      ...line.runs.flatMap(({ attributes }) =>
        attributes.font.map(
          (font) => (-font.descent / font.unitsPerEm) * attributes.fontSize,
        ),
      ),
    );
    const inkHeight = line.ascent + descent;
    expect(line.box.height + 0.01).toBeGreaterThanOrEqual(inkHeight);
    expect(next.box.top).toBeGreaterThanOrEqual(
      node.box.top + line.box.y + inkHeight,
    );
  }
}

describe('rendered PDF geometry', () => {
  it('includes a clickable repository link in the exported CV', async () => {
    const pdf = await renderToBuffer(
      ApplicationPdf({ application: fixture, kind: 'cv' }),
    );
    expect(pdf.toString('latin1')).toContain(
      `/URI (${fixture.documents.cv.personalProjects[0].repositoryUrl})`,
    );
  });
  for (const fontFamily of ['Helvetica', 'Times-Roman'] as const) {
    for (const fontSize of [9, 13]) {
      it.each(['cv', 'coverLetter'] as const)(
        `${fontFamily} ${fontSize}pt %s keeps the name clear of the next line`,
        async (kind) => {
          const application = structuredClone(fixture);
          application.templates[kind].theme = {
            ...application.templates[kind].theme,
            fontFamily,
            fontSize,
          };
          const layout = await renderLayout(application, kind);
          const page = layout.children[0];
          const [name, following] =
            kind === 'cv' ? page.children[0].children : page.children;
          assertTextFits(name, following);
          expect(page.box.paddingLeft).toBe(24);
          expect(page.box.paddingBottom).toBe(36);
        },
      );
    }
    it(`${fontFamily} keeps wrapped names and titles from overlapping`, async () => {
      const application = structuredClone(fixture);
      application.templates.cv.theme.fontFamily = fontFamily;
      application.documents.cv.name = 'Dan Edington '.repeat(8).trim();
      application.documents.cv.headline = 'Senior Frontend Engineer '
        .repeat(8)
        .trim();
      const layout = await renderLayout(application, 'cv');
      const [name, headline, location] =
        layout.children[0].children[0].children;
      expect(name.lines!.length).toBeGreaterThan(1);
      expect(headline.lines!.length).toBeGreaterThan(1);
      assertTextFits(name, headline);
      assertTextFits(headline, location);
    });
  }

  it('compacts old built-in margins without changing custom templates or saved data', () => {
    for (const [id, oldMargin, expected] of [
      ['standard', 30, 24],
      ['standard', 42, 24],
      ['editorial', 46, 36],
      ['standard', 50, 50],
      ['custom', 42, 42],
    ] as const) {
      const template = {
        ...fixture.templates.cv,
        id,
        theme: { ...fixture.templates.cv.theme, margin: oldMargin },
      };
      expect(documentTheme(template).margin).toBe(expected);
      expect(template.theme.margin).toBe(oldMargin);
    }
  });
});
