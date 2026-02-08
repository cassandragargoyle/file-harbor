import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable(
  'documents',
  {
    id: text('id').primaryKey(),
    original_filename: text('original_filename').notNull(),
    stored_path: text('stored_path').notNull(),
    mime_type: text('mime_type').notNull(),
    size_bytes: integer('size_bytes').notNull(),
    added_at: text('added_at').notNull(),
    source: text('source').notNull(),
    source_path: text('source_path'),
    category: text('category'),
    content_hash: text('content_hash').notNull(),
    extracted_text: text('extracted_text'),
    updated_at: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_documents_category').on(table.category),
    index('idx_documents_content_hash').on(table.content_hash),
    index('idx_documents_added_at').on(table.added_at),
  ]
);
