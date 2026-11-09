import { test, expect } from '@playwright/test';
import { fixture } from '../fixtures';
import type { Application } from '../../shared/schema';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        configured: false,
        models: [],
        defaultModel: '',
        modelWarning: null,
        templates: [fixture.templates.cv],
        templateWarnings: [],
        profile: {
          name: 'Dan Edington',
          role: 'Frontend Engineer',
          source: 'career.json',
          roleCount: 6,
        },
      },
    }),
  );
});

test('shows setup, template choices, and responsive empty previews', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Make your next move.' }),
  ).toBeVisible();
  await expect(page.getByLabel('CV template')).toHaveValue('standard');
  await expect(
    page.getByRole('button', { name: 'Download Tailored CV as PDF' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Have the description instead?' })
    .click();
  await expect(page.getByLabel('Job description')).toBeVisible();
  await page.screenshot({
    path: 'test-results/studio-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel('Job posting URL')).toBeVisible();
  await page.screenshot({
    path: 'test-results/studio-mobile.png',
    fullPage: true,
  });
});

test('accepts pasted text without a URL and asks for an unnamed company before generating', async ({
  page,
}) => {
  const jobText =
    'Senior frontend role building accessible React applications with TypeScript, collaborating with designers and backend engineers.';
  let draft: Application | null = null;
  let analysisRequests = 0;
  let completionRequests = 0;
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        configured: true,
        models: [fixture.model],
        defaultModel: fixture.model,
        templates: [fixture.templates.cv],
        templateWarnings: [],
        modelWarning: null,
        profile: { name: 'Dan Edington', source: 'career.json', roleCount: 7 },
      },
    }),
  );
  await page.route('**/api/applications', (route) => {
    if (route.request().method() === 'POST') {
      analysisRequests++;
      expect(route.request().postDataJSON()).toMatchObject({
        url: '',
        jobText,
      });
      return route.fulfill({
        status: 202,
        json: {
          status: 'company_name_required',
          token: '11111111-1111-4111-8111-111111111111',
          jobTitle: fixture.job.title,
        },
      });
    }
    return route.fulfill({
      json: draft
        ? [{ id: draft.id, title: draft.job.title, company: draft.job.company }]
        : [],
    });
  });
  await page.route('**/api/applications/complete', (route) => {
    completionRequests++;
    expect(route.request().postDataJSON()).toEqual({
      token: '11111111-1111-4111-8111-111111111111',
      companyName: 'Running Studio',
    });
    if (completionRequests === 1)
      return route.fulfill({
        status: 502,
        json: { error: 'Generation failed. Please retry.' },
      });
    draft = {
      ...fixture,
      url: '',
      job: { ...fixture.job, company: 'Running Studio' },
    };
    return route.fulfill({ status: 201, json: draft });
  });
  await page.route('**/api/applications/test-application', (route) =>
    route.fulfill({ json: draft }),
  );
  await page.goto('/');
  const generate = page.getByRole('button', {
    name: 'Generate application',
    exact: true,
  });
  await expect(generate).toBeDisabled();
  await page
    .getByRole('button', { name: 'Have the description instead?' })
    .click();
  await page.getByLabel('Job description').fill(jobText);
  await expect(page.getByLabel('Job posting URL')).toHaveValue('');
  await expect(generate).toBeEnabled();
  await generate.click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'What’s the company name?' }),
  ).toBeVisible();
  await expect(dialog.getByLabel('Company name')).toBeFocused();
  await expect(
    dialog.getByRole('button', { name: 'Continue generating' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Job description')).toHaveValue(jobText);
  expect(completionRequests).toBe(0);
  await generate.click();
  await dialog.getByLabel('Company name').fill('   ');
  await expect(
    dialog.getByRole('button', { name: 'Continue generating' }),
  ).toBeDisabled();
  await dialog.getByLabel('Company name').fill('  Running Studio  ');
  await dialog.getByRole('button', { name: 'Continue generating' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Please retry');
  await expect(dialog.getByLabel('Company name')).toHaveValue(
    '  Running Studio  ',
  );
  await dialog.getByRole('button', { name: 'Continue generating' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Running Studio', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Original job posting' }),
  ).toHaveCount(0);
  expect(analysisRequests).toBe(2); // One cancelled analysis, one resumed without repeating it.
  expect(completionRequests).toBe(2);
});

test('generates directly from pasted text when the company is known', async ({
  page,
}) => {
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        configured: true,
        models: [fixture.model],
        defaultModel: fixture.model,
        templates: [fixture.templates.cv],
        templateWarnings: [],
        modelWarning: null,
        profile: { name: 'Dan Edington', source: 'career.json', roleCount: 7 },
      },
    }),
  );
  await page.route('**/api/applications', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 201, json: { ...fixture, url: '' } })
      : route.fulfill({ json: [] }),
  );
  await page.route('**/api/applications/test-application', (route) =>
    route.fulfill({ json: { ...fixture, url: '' } }),
  );
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Have the description instead?' })
    .click();
  await page
    .getByLabel('Job description')
    .fill(
      'Example Studio is hiring a frontend engineer to build accessible React and TypeScript applications, collaborating with designers and backend engineers.',
    );
  await page
    .getByRole('button', { name: 'Generate application', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Example Studio', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Original job posting' }),
  ).toHaveCount(0);
  const repositoryLink = page.getByRole('link', {
    name: 'https://github.com/dan-edington/TonyGL',
  });
  await expect(repositoryLink).toHaveAttribute(
    'href',
    'https://github.com/dan-edington/TonyGL',
  );
});

for (const selection of ['cv', 'coverLetter'] as const) {
  test(`generates, revises and reopens ${selection} alone, then changes the selection`, async ({
    page,
  }) => {
    let draft: Application | null = null;
    const other = selection === 'cv' ? 'coverLetter' : 'cv';
    const label = selection === 'cv' ? 'Tailored CV' : 'Cover letter';
    const otherLabel = selection === 'cv' ? 'Cover letter' : 'Tailored CV';

    function documents(kind: 'cv' | 'coverLetter') {
      const { cv, coverLetter, ...shared } = fixture.documents;
      return { ...shared, ...(kind === 'cv' ? { cv } : { coverLetter }) };
    }

    await page.route('**/api/settings', (route) =>
      route.fulfill({
        json: {
          configured: true,
          models: [fixture.model],
          defaultModel: fixture.model,
          templates: [fixture.templates.cv],
          templateWarnings: [],
          modelWarning: null,
          profile: {
            name: 'Dan Edington',
            source: 'career.json',
            roleCount: 7,
          },
        },
      }),
    );
    await page.route('**/api/applications', (route) => {
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON();
        expect(input.documentSelection).toBe(selection);
        expect(input.coverLetterPersonalisation).toBe(
          selection === 'cv' ? '' : 'I am a runner.',
        );
        draft = {
          ...fixture,
          documents: documents(selection),
          applicant: {
            name: fixture.documents.cv.name,
            location: fixture.documents.cv.location,
            contact: fixture.documents.cv.contact,
          },
          coverLetterPersonalisation: input.coverLetterPersonalisation,
        };
        return route.fulfill({ status: 201, json: draft });
      }
      return route.fulfill({
        json: draft
          ? [
              {
                id: draft.id,
                title: draft.job.title,
                company: draft.job.company,
                version: draft.version,
              },
            ]
          : [],
      });
    });
    await page.route('**/api/applications/test-application', (route) =>
      route.fulfill({ json: draft }),
    );
    await page.route('**/api/applications/test-application/revise', (route) => {
      const input = route.request().postDataJSON();
      if (selection === 'cv')
        expect(input).not.toHaveProperty('coverLetterPersonalisation');
      draft = { ...draft!, version: 2 };
      return route.fulfill({ json: draft });
    });
    await page.route(
      '**/api/applications/test-application/regenerate',
      (route) => {
        expect(route.request().postDataJSON().documentSelection).toBe(other);
        draft = { ...draft!, version: 3, documents: documents(other) };
        return route.fulfill({ json: draft });
      },
    );
    await page.route('**/api/applications/test-application/pdf/**', (route) =>
      route.fulfill({
        contentType: 'application/pdf',
        body: '%PDF-1.4\n%%EOF',
      }),
    );
    await page.goto('/');
    await page.getByLabel('Documents to generate').selectOption(selection);
    await expect(
      page.getByLabel(selection === 'cv' ? 'Letter template' : 'CV template', {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: otherLabel, exact: true }),
    ).toHaveCount(0);
    if (selection === 'coverLetter')
      await page
        .getByLabel('Cover letter personalisation')
        .fill('I am a runner.');
    else
      await expect(page.getByLabel('Cover letter personalisation')).toHaveCount(
        0,
      );
    await page.getByLabel('Job posting URL').fill(fixture.url);
    await page
      .getByRole('button', { name: 'Generate application', exact: true })
      .click();
    const preview = page.getByRole('region', { name: label, exact: true });
    await expect(preview.locator('.paper h2')).toHaveText(
      fixture.documents.cv.name,
    );
    await expect(preview.locator('.paper-contact')).toContainText(
      fixture.documents.cv.contact[0],
    );
    await expect(
      page.getByRole('region', { name: otherLabel, exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('Suggested changes').fill('Make this more concise.');
    await page.getByRole('button', { name: 'Update previews' }).click();
    await expect(
      page.getByText('Revision 2 saved. Your previews are up to date.'),
    ).toBeVisible();
    const download = page.waitForEvent('download');
    await page
      .getByRole('button', { name: `Download ${label} as PDF` })
      .click();
    expect((await download).suggestedFilename()).toContain('Dan Edington');
    await page.reload();
    await expect(preview.locator('.paper h2')).toHaveText(
      fixture.documents.cv.name,
    );
    await expect(
      page.getByRole('region', { name: otherLabel, exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Regenerate application', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Documents to generate')).toHaveValue(
      selection,
    );
    await dialog.getByLabel('Documents to generate').selectOption(other);
    await dialog.getByRole('button', { name: 'Regenerate documents' }).click();
    await expect(
      page
        .getByRole('region', { name: otherLabel, exact: true })
        .locator('.paper h2'),
    ).toHaveText(fixture.documents.cv.name);
    await expect(preview).toHaveCount(0);
  });
}

test('generates and revises previews, downloads PDFs, and reopens a saved draft', async ({
  page,
}) => {
  let draft: typeof fixture | null = null;
  await page.route('**/api/settings', async (route) => {
    await route.fulfill({
      json: {
        configured: true,
        models: ['gpt-5-mini', 'gpt-4.1'],
        defaultModel: 'gpt-5-mini',
        modelWarning: null,
        templates: [fixture.templates.cv],
        templateWarnings: [],
        profile: {
          name: 'Dan Edington',
          role: 'Frontend Engineer',
          source: 'career.json',
          roleCount: 6,
        },
      },
    });
  });
  await page.route('**/api/applications', async (route) => {
    if (route.request().method() === 'POST') {
      const input = route.request().postDataJSON();
      expect(input.coverLetterPersonalisation).toBe('I am a runner.');
      draft = {
        ...structuredClone(fixture),
        coverLetterPersonalisation: input.coverLetterPersonalisation,
      };
      await route.fulfill({ status: 201, json: draft });
    } else
      await route.fulfill({
        json: draft
          ? [
              {
                id: draft.id,
                company: draft.job.company,
                title: draft.job.title,
                version: draft.version,
                updatedAt: draft.updatedAt,
                model: draft.model,
              },
            ]
          : [],
      });
  });
  await page.route('**/api/applications/test-application', (route) =>
    route.fulfill({ json: draft }),
  );
  await page.route('**/api/applications/test-application/revise', (route) => {
    const body = route.request().postDataJSON();
    expect(body.coverLetterPersonalisation).toBe(
      'I run regularly and would use a running app.',
    );
    draft = {
      ...draft!,
      coverLetterPersonalisation: body.coverLetterPersonalisation,
      version: 2,
      documents: {
        ...draft!.documents,
        cv: {
          ...draft!.documents.cv,
          experience: [
            {
              ...draft!.documents.cv.experience[0],
              bullets: [
                'Used React and TypeScript to build a solar design tool so installers could plan rooftop panel layouts.',
              ],
            },
          ],
        },
        coverLetter: {
          ...draft!.documents.coverLetter,
          paragraphs: [
            'Revised cover letter introduction.',
            'A concise closing paragraph.',
          ],
        },
      },
      revisions: [
        { instructions: body.instructions, date: new Date().toISOString() },
      ],
    };
    return route.fulfill({ json: draft });
  });
  await page.route('**/api/applications/test-application/pdf/**', (route) =>
    route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }),
  );
  await page.goto('/');
  await page.getByLabel('Job posting URL').fill(fixture.url);
  await page.getByLabel('AI model', { exact: true }).selectOption('gpt-4.1');
  await page.getByLabel('Cover letter personalisation').fill('I am a runner.');
  await page
    .getByRole('button', { name: 'Generate application', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Example Studio', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Built a React and TypeScript solar design tool to help installers plan rooftop panel layouts.',
      { exact: true },
    ),
  ).toBeVisible();
  const cvPreview = page.getByRole('region', {
    name: 'Tailored CV',
    exact: true,
  });
  await expect(cvPreview.locator('.paper h3')).toHaveText([
    'Experience',
    'Personal Projects',
    'Education',
    'Core Skills',
  ]);
  await expect(
    cvPreview.getByRole('heading', { name: 'TonyGL', exact: true }),
  ).toBeVisible();
  await expect(cvPreview.locator('.paper')).toHaveCSS('padding-left', '32px');
  const header = cvPreview.locator('.paper-cv-header');
  await expect(header).toHaveCSS('text-align', 'center');
  await expect(header.locator('.paper-location')).toHaveText(
    'Manchester, United Kingdom',
  );
  await expect(header.locator('.paper-contact')).toHaveText(
    fixture.documents.cv.contact.join(' | '),
  );
  await expect(
    cvPreview.getByRole('heading', { name: 'Profile', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Cover letter personalisation')).toHaveValue(
    'I am a runner.',
  );
  await page
    .getByLabel('Cover letter personalisation')
    .fill('I run regularly and would use a running app.');
  await expect(page.getByLabel('Suggested changes')).toHaveValue('');
  await expect(
    page.getByRole('button', { name: 'Update previews' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Update previews' }).click();
  await expect(
    page.getByText(
      'Used React and TypeScript to build a solar design tool so installers could plan rooftop panel layouts.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Revised cover letter introduction.', { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download Tailored CV as PDF' })
    .click();
  expect((await downloadPromise).suggestedFilename()).toContain('.pdf');
  await page.getByRole('button', { name: 'New application' }).click();
  await expect(
    page.getByRole('heading', { name: 'Make your next move.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Cover letter personalisation')).toHaveValue('');
  await page
    .getByRole('button', { name: /Example Studio Senior Frontend Engineer/ })
    .click();
  await expect(page.getByLabel('Cover letter personalisation')).toHaveValue(
    'I run regularly and would use a running app.',
  );
  await expect(
    page.getByText(
      'Used React and TypeScript to build a solar design tool so installers could plan rooftop panel layouts.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/studio-draft.png',
    fullPage: true,
  });
});

test('keeps a failed job URL and offers a pasted-description fallback', async ({
  page,
}) => {
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        configured: true,
        models: ['gpt-5-mini'],
        defaultModel: 'gpt-5-mini',
        modelWarning: null,
        templates: [fixture.templates.cv],
        templateWarnings: [],
        profile: {
          name: 'Dan Edington',
          role: 'Frontend Engineer',
          source: 'career.json',
          roleCount: 6,
        },
      },
    }),
  );
  await page.route('**/api/applications', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 422,
          json: {
            error: 'The website blocked access. Paste the job description.',
          },
        })
      : route.fulfill({ json: [] }),
  );
  await page.goto('/');
  await page.getByLabel('Job posting URL').fill(fixture.url);
  await page
    .getByRole('button', { name: 'Generate application', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('website blocked access');
  await expect(page.getByLabel('Job posting URL')).toHaveValue(fixture.url);
  await expect(page.getByLabel('Job description')).toBeVisible();
});

test('recovers model discovery and shows the complete returned list', async ({
  page,
}) => {
  let attempts = 0;
  const ids = [
    'ft:custom-model:example',
    'gpt-future-family',
    'gpt-image-1',
    'gpt-realtime',
  ];
  await page.route('**/api/settings', (route) => {
    const available = ++attempts > 1;
    return route.fulfill({
      json: {
        configured: true,
        models: available ? ids : [],
        defaultModel: available ? ids[0] : '',
        modelWarning: available ? null : 'Could not load models from OpenAI.',
        templates: [fixture.templates.cv],
        templateWarnings: [],
        profile: {
          name: 'Dan Edington',
          role: 'Frontend Engineer',
          source: 'career.json',
          roleCount: 6,
        },
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Job posting URL').fill(fixture.url);
  await expect(page.getByLabel('AI model', { exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Generate application', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Retry loading models' }).click();
  const selector = page.getByLabel('AI model', { exact: true });
  await expect(selector.locator('option')).toHaveText(ids);
  await selector.selectOption('gpt-future-family');
  await expect(selector).toHaveValue('gpt-future-family');
  await expect(
    page.getByRole('button', { name: 'Generate application', exact: true }),
  ).toBeEnabled();
});

test('shows fallback models with the budget default and explains an invalid key', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'application-studio-preferences',
      JSON.stringify({
        state: { model: 'gpt-5-mini', activeId: null },
        version: 0,
      }),
    ),
  );
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        configured: false,
        modelSource: 'fallback',
        models: ['gpt-5-nano', 'gpt-4.1-nano', 'gpt-5-mini'],
        defaultModel: 'gpt-5-nano',
        modelWarning:
          'OpenAI rejected OPENAI_API_KEY (401). Replace the key in .env and restart the server.',
        templates: [fixture.templates.cv],
        templateWarnings: [],
        profile: {
          name: 'Dan Edington',
          role: 'Frontend Engineer',
          source: 'career.json',
          roleCount: 6,
        },
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByLabel('AI model', { exact: true })).toHaveValue(
    'gpt-5-nano',
  );
  await expect(page.getByText(/OpenAI rejected OPENAI_API_KEY/)).toBeVisible();
  await expect(page.getByText(/Showing built-in text models/)).toBeVisible();
  await page.getByLabel('Job posting URL').fill(fixture.url);
  await expect(
    page.getByRole('button', { name: 'Generate application', exact: true }),
  ).toBeDisabled();
});

test('regenerates a saved application safely and deletes it after confirmation', async ({
  page,
}) => {
  let draft: typeof fixture | null = structuredClone(fixture);
  let regenerationRequests = 0;
  let deletionRequests = 0;
  await page.route('**/api/settings', (route) =>
    route.fulfill({
      json: {
        configured: true,
        modelSource: 'fallback',
        models: ['gpt-5-nano', 'gpt-5-mini'],
        defaultModel: 'gpt-5-nano',
        modelWarning: null,
        templates: [fixture.templates.cv],
        templateWarnings: [],
        profile: {
          name: 'Dan Edington',
          role: 'Frontend Engineer',
          source: 'career.json',
          roleCount: 6,
        },
      },
    }),
  );
  await page.route('**/api/applications', (route) =>
    route.fulfill({
      json: draft
        ? [
            {
              id: draft.id,
              company: draft.job.company,
              title: draft.job.title,
              version: draft.version,
              updatedAt: draft.updatedAt,
              model: draft.model,
            },
          ]
        : [],
    }),
  );
  await page.route('**/api/applications/test-application', (route) => {
    if (route.request().method() === 'DELETE') {
      deletionRequests++;
      expect(route.request().postDataJSON().version).toBe(2);
      draft = null;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: draft });
  });
  await page.route(
    '**/api/applications/test-application/regenerate',
    (route) => {
      regenerationRequests++;
      if (regenerationRequests === 1)
        return route.fulfill({
          status: 502,
          json: {
            error: 'Provider unavailable. The saved draft is unchanged.',
          },
        });
      const input = route.request().postDataJSON();
      expect(input.model).toBe('gpt-5-nano');
      expect(input.version).toBe(1);
      draft = {
        ...draft!,
        model: input.model,
        version: 2,
        documents: {
          ...draft!.documents,
          cv: {
            ...draft!.documents.cv,
            experience: [
              {
                ...draft!.documents.cv.experience[0],
                bullets: ['Freshly generated CV content.'],
              },
            ],
          },
          coverLetter: {
            ...draft!.documents.coverLetter,
            paragraphs: [
              'Freshly generated cover letter.',
              'A new closing paragraph.',
            ],
          },
        },
        revisions: [],
      };
      return route.fulfill({ json: draft });
    },
  );
  await page.goto('/');
  await page
    .getByRole('button', { name: /Example Studio Senior Frontend Engineer/ })
    .click();
  await page
    .getByRole('button', { name: 'Regenerate application', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(regenerationRequests).toBe(0);
  await page
    .getByRole('button', { name: 'Regenerate application', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Regenerate documents', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'saved draft is unchanged',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByText(fixture.documents.cv.experience[0].bullets[0], {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Regenerate application', exact: true })
    .click();
  await expect(page.getByLabel('AI model', { exact: true })).toHaveValue(
    'gpt-5-nano',
  );
  await page
    .getByRole('button', { name: 'Regenerate documents', exact: true })
    .click();
  await expect(
    page.getByText('Freshly generated CV content.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Freshly generated cover letter.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Delete application', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(deletionRequests).toBe(0);
  await page
    .getByRole('button', { name: 'Delete application', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Delete permanently', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Make your next move.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Example Studio Senior Frontend Engineer/,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Application deleted.');
  expect(deletionRequests).toBe(1);
});
