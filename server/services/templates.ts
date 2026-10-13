import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { templateSchema, type Template } from '../../shared/schema.js';
import { config, AppError } from '../config.js';
export const standardTemplate: Template = templateSchema.parse({ id: 'standard', name: 'Studio standard', kind: 'both', description: 'A clean, single-column layout with a restrained green accent.', instructions: 'A concise, ATS-friendly CV. Aim for two pages. Keep the cover letter to one page.' });
export async function loadTemplates() {
  const templates = [standardTemplate]; const warnings: string[] = [];
  let files: string[];
  try { files = await readdir(config.templatesDir); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { templates, warnings }; throw error; }
  for (const file of files.filter(f => f.endsWith('.json')).sort()) {
    try {
      const template = templateSchema.parse(JSON.parse(await readFile(path.join(config.templatesDir, file), 'utf8')));
      if (templates.some(t => t.id === template.id)) throw new Error('Duplicate template ID');
      templates.push(template);
    } catch { warnings.push(`${file} could not be loaded. Check its JSON and template schema.`); }
  }
  return { templates, warnings };
}
export function selectTemplate(templates: Template[], id: string, kind: 'cv' | 'coverLetter') {
  const template = templates.find(t => t.id === id && (t.kind === 'both' || t.kind === kind));
  if (!template) throw new AppError(400, `The selected ${kind} template is unavailable. Refresh and select a template.`);
  return template;
}
