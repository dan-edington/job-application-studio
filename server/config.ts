import 'dotenv/config';
import path from 'node:path';
const generationTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 300000);
if (!Number.isInteger(generationTimeoutMs) || generationTimeoutMs < 1000 || generationTimeoutMs > 900000) throw new Error('OPENAI_TIMEOUT_MS must be an integer between 1000 and 900000.');
export const config = {
  apiKey: process.env.OPENAI_API_KEY?.trim() || '',
  defaultModel: process.env.OPENAI_MODEL || 'gpt-5-nano',
  generationTimeoutMs,
  port: Number(process.env.PORT || 3001), host: process.env.HOST || '127.0.0.1',
  careerPath: path.resolve(process.env.CAREER_MASTER_PATH || './dan_edington_career_master.json'),
  templatesDir: path.resolve(process.env.TEMPLATES_DIR || './templates'),
  databasePath: path.resolve(process.env.DATABASE_PATH || './data/applications.sqlite'),
};
export class AppError extends Error { constructor(public status: number, message: string) { super(message); } }
