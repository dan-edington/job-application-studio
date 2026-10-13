import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Application, ApplicationSummary } from '../shared/schema.js';
import { AppError } from './config.js';

export class ApplicationRepository {
  private db: DatabaseSync;
  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL)');
  }
  list(): ApplicationSummary[] {
    return this.db.prepare('SELECT payload FROM applications ORDER BY updated_at DESC LIMIT 100').all().map(row => {
      const a = JSON.parse(String(row.payload)) as Application;
      return { id: a.id, title: a.job.title, company: a.job.company, updatedAt: a.updatedAt, version: a.version, model: a.model };
    });
  }
  get(id: string): Application {
    const row = this.db.prepare('SELECT payload FROM applications WHERE id = ?').get(id);
    if (!row) throw new AppError(404, 'Application not found.');
    return JSON.parse(String(row.payload));
  }
  create(application: Application) {
    this.db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?)').run(application.id, application.updatedAt, application.version, JSON.stringify(application));
    return application;
  }
  update(application: Application, expectedVersion: number) {
    const result = this.db.prepare('UPDATE applications SET updated_at = ?, version = ?, payload = ? WHERE id = ? AND version = ?').run(application.updatedAt, application.version, JSON.stringify(application), application.id, expectedVersion);
    if (!result.changes) throw new AppError(409, 'This draft changed or was deleted in another session. Reopen it before trying again.');
    return application;
  }
  delete(id: string, expectedVersion: number) {
    this.get(id);
    const result = this.db.prepare('DELETE FROM applications WHERE id = ? AND version = ?').run(id, expectedVersion);
    if (!result.changes) throw new AppError(409, 'This draft changed in another session. Reopen it before deleting.');
  }
  close() { this.db.close(); }
}
