import type { Template } from './schema.js';

// Apply the compact built-in margins to older snapshots too. Explicit custom
// margins and custom templates retain their saved values.
export function documentTheme(template: Template): Template['theme'] {
  const { margin } = template.theme;
  if (template.id === 'standard' && [30, 42].includes(margin))
    return { ...template.theme, margin: 24 };
  if (template.id === 'editorial' && margin === 46)
    return { ...template.theme, margin: 36 };
  return template.theme;
}
