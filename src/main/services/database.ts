import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, like, or, isNull, sql } from 'drizzle-orm';
import { app } from 'electron';
import path from 'node:path';

import * as schema from '../../shared/schema';
import { CATEGORIES } from '../../shared/constants';
import type { DocumentRecord, Category, SuggestionSource, SuggestionOutcome, DocumentCounts, LibraryInfo, SuggestionStats } from '../../shared/types';
import { dbLog } from '../lib/logger';

export class DatabaseService {
  private sqlite: Database.Database;
  private db: BetterSQLite3Database<typeof schema>;

  constructor(libraryPath: string) {
    const dbPath = path.join(libraryPath, 'db.sqlite');
    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');

    this.db = drizzle(this.sqlite, { schema });

    const migrationsPath = app.isPackaged
      ? path.join(process.resourcesPath, 'drizzle')
      : path.join(app.getAppPath(), 'drizzle');

    dbLog.info(`Running migrations from ${migrationsPath}`);
    migrate(this.db, { migrationsFolder: migrationsPath });
    dbLog.info('Database initialized');
  }

  insertDocument(doc: Omit<DocumentRecord, 'updated_at'>): DocumentRecord {
    const now = new Date().toISOString();
    const row = { ...doc, updated_at: now };
    this.db.insert(schema.documents).values(row).run();
    return row;
  }

  getDocument(id: string): DocumentRecord | undefined {
    return this.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .get() as DocumentRecord | undefined;
  }

  getDocumentsByCategory(category: Category | null): DocumentRecord[] {
    if (category === null) {
      return this.db
        .select()
        .from(schema.documents)
        .where(isNull(schema.documents.category))
        .orderBy(sql`${schema.documents.added_at} DESC`)
        .all() as DocumentRecord[];
    }
    return this.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.category, category))
      .orderBy(sql`${schema.documents.added_at} DESC`)
      .all() as DocumentRecord[];
  }

  updateDocumentCategory(id: string, category: Category | null): void {
    this.db
      .update(schema.documents)
      .set({ category, updated_at: new Date().toISOString() })
      .where(eq(schema.documents.id, id))
      .run();
  }

  updateExtractedText(id: string, extractedText: string | null): void {
    this.db
      .update(schema.documents)
      .set({ extracted_text: extractedText, updated_at: new Date().toISOString() })
      .where(eq(schema.documents.id, id))
      .run();
  }

  renameDocument(id: string, newFilename: string): void {
    this.db
      .update(schema.documents)
      .set({ original_filename: newFilename, updated_at: new Date().toISOString() })
      .where(eq(schema.documents.id, id))
      .run();
  }

  deleteDocument(id: string): void {
    this.db
      .delete(schema.documents)
      .where(eq(schema.documents.id, id))
      .run();
  }

  updateSuggestion(
    id: string,
    suggestedCategory: Category | null,
    confidence: number | null,
    source: SuggestionSource | null,
    suggestedFilename: string | null
  ): void {
    this.db
      .update(schema.documents)
      .set({
        suggested_category: suggestedCategory,
        suggestion_confidence: confidence,
        suggestion_source: source,
        suggested_filename: suggestedFilename,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.documents.id, id))
      .run();
  }

  clearSuggestion(id: string): void {
    this.db
      .update(schema.documents)
      .set({
        suggested_category: null,
        suggestion_confidence: null,
        suggestion_source: null,
        suggested_filename: null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.documents.id, id))
      .run();
  }

  getDocumentByHash(hash: string): DocumentRecord | undefined {
    return this.db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.content_hash, hash))
      .get() as DocumentRecord | undefined;
  }

  getAllDocuments(): DocumentRecord[] {
    return this.db
      .select()
      .from(schema.documents)
      .all() as DocumentRecord[];
  }

  searchDocuments(query: string): DocumentRecord[] {
    const pattern = `%${query}%`;
    return this.db
      .select()
      .from(schema.documents)
      .where(
        or(
          like(schema.documents.original_filename, pattern),
          like(schema.documents.extracted_text, pattern)
        )
      )
      .orderBy(sql`${schema.documents.added_at} DESC`)
      .all() as DocumentRecord[];
  }

  getDocumentCounts(): DocumentCounts {
    const counts: DocumentCounts = { inbox: 0 };
    for (const cat of CATEGORIES) {
      counts[cat] = 0;
    }

    const rows = this.db
      .select({
        category: schema.documents.category,
        count: sql<number>`count(*)`,
      })
      .from(schema.documents)
      .groupBy(schema.documents.category)
      .all();

    for (const row of rows) {
      if (row.category === null) {
        counts.inbox = row.count;
      } else {
        counts[row.category] = row.count;
      }
    }
    return counts;
  }

  getDocumentsWithSuggestions(): DocumentRecord[] {
    return this.db
      .select()
      .from(schema.documents)
      .where(
        sql`${schema.documents.category} IS NULL AND ${schema.documents.suggested_category} IS NOT NULL AND coalesce(${schema.documents.suggestion_confidence}, 0) >= 0.3`
      )
      .orderBy(sql`${schema.documents.suggestion_confidence} DESC`)
      .all() as DocumentRecord[];
  }

  setSuggestionOutcome(id: string, outcome: SuggestionOutcome): void {
    this.db
      .update(schema.documents)
      .set({ suggestion_outcome: outcome, updated_at: new Date().toISOString() })
      .where(eq(schema.documents.id, id))
      .run();
  }

  getSuggestionStats(): SuggestionStats {
    const pending = this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.documents)
      .where(
        sql`${schema.documents.category} IS NULL AND ${schema.documents.suggested_category} IS NOT NULL AND coalesce(${schema.documents.suggestion_confidence}, 0) >= 0.3`
      )
      .get()!;

    const outcomes = this.db
      .select({
        outcome: schema.documents.suggestion_outcome,
        count: sql<number>`count(*)`,
      })
      .from(schema.documents)
      .where(sql`${schema.documents.suggestion_outcome} IS NOT NULL`)
      .groupBy(schema.documents.suggestion_outcome)
      .all();

    let accepted = 0;
    let dismissed = 0;
    for (const row of outcomes) {
      if (row.outcome === 'accepted') accepted = row.count;
      if (row.outcome === 'dismissed') dismissed = row.count;
    }

    const total = accepted + dismissed;
    const accuracyRate = total > 0 ? accepted / total : null;

    return { pendingSuggestions: pending.count, accepted, dismissed, accuracyRate };
  }

  getLibraryStats(libraryPath: string): LibraryInfo {
    const row = this.db
      .select({
        count: sql<number>`count(*)`,
        totalSize: sql<number>`coalesce(sum(${schema.documents.size_bytes}), 0)`,
      })
      .from(schema.documents)
      .get()!;

    return {
      path: libraryPath,
      documentCount: row.count,
      totalSizeBytes: row.totalSize,
      suggestionStats: this.getSuggestionStats(),
    };
  }

  walCheckpoint(): void {
    this.sqlite.pragma('wal_checkpoint(TRUNCATE)');
  }

  close(): void {
    this.sqlite.close();
    dbLog.info('Database connection closed');
  }
}
