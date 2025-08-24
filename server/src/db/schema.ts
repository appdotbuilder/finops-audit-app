import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  date,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const currencyEnum = pgEnum('currency', ['USD', 'PKR']);
export const accountTypeEnum = pgEnum('account_type', ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'OTHER']);
export const roleEnum = pgEnum('role', ['ADMIN', 'FINANCE', 'AUDITOR', 'PARTNER']);
export const journalStatusEnum = pgEnum('journal_status', ['DRAFT', 'POSTED']);
export const periodStatusEnum = pgEnum('period_status', ['OPEN', 'LOCKED']);
export const importStatusEnum = pgEnum('import_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export const capitalMovementTypeEnum = pgEnum('capital_movement_type', ['CONTRIBUTION', 'DRAW']);

// Partners table
export const partnersTable = pgTable('partners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  has_usd_account: boolean('has_usd_account').notNull().default(false),
  has_pkr_account: boolean('has_pkr_account').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  partner_id: integer('partner_id').references(() => partnersTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Accounts table
export const accountsTable = pgTable('accounts', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  account_type: accountTypeEnum('account_type').notNull(),
  currency: currencyEnum('currency').notNull(),
  is_bank_account: boolean('is_bank_account').notNull().default(false),
  is_capital_account: boolean('is_capital_account').notNull().default(false),
  is_payroll_source: boolean('is_payroll_source').notNull().default(false),
  is_intercompany: boolean('is_intercompany').notNull().default(false),
  partner_id: integer('partner_id').references(() => partnersTable.id),
  parent_account_id: integer('parent_account_id').references((): any => accountsTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Employees table
export const employeesTable = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  salary_currency: currencyEnum('salary_currency').notNull(),
  funding_account_id: integer('funding_account_id').notNull().references(() => accountsTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// FX Rates table
export const fxRatesTable = pgTable('fx_rates', {
  id: serial('id').primaryKey(),
  date: date('date').notNull().unique(),
  usd_to_pkr_rate: numeric('usd_to_pkr_rate', { precision: 10, scale: 4 }).notNull(),
  is_locked: boolean('is_locked').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Periods table
export const periodsTable = pgTable('periods', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: periodStatusEnum('status').notNull().default('OPEN'),
  locked_at: timestamp('locked_at'),
  locked_by: integer('locked_by').references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Journals table
export const journalsTable = pgTable('journals', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull(),
  description: text('description').notNull(),
  transaction_date: date('transaction_date').notNull(),
  period_id: integer('period_id').notNull().references(() => periodsTable.id),
  status: journalStatusEnum('status').notNull().default('DRAFT'),
  posted_at: timestamp('posted_at'),
  posted_by: integer('posted_by').references(() => usersTable.id),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Journal Lines table
export const journalLinesTable = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journal_id: integer('journal_id').notNull().references(() => journalsTable.id),
  account_id: integer('account_id').notNull().references(() => accountsTable.id),
  description: text('description').notNull(),
  debit_amount: numeric('debit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  credit_amount: numeric('credit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  debit_amount_base: numeric('debit_amount_base', { precision: 15, scale: 2 }).notNull().default('0'),
  credit_amount_base: numeric('credit_amount_base', { precision: 15, scale: 2 }).notNull().default('0'),
  fx_rate: numeric('fx_rate', { precision: 10, scale: 4 }),
  partner_id: integer('partner_id').references(() => partnersTable.id),
  employee_id: integer('employee_id').references(() => employeesTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Capital Movements table
export const capitalMovementsTable = pgTable('capital_movements', {
  id: serial('id').primaryKey(),
  partner_id: integer('partner_id').notNull().references(() => partnersTable.id),
  movement_type: capitalMovementTypeEnum('movement_type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: currencyEnum('currency').notNull(),
  amount_base: numeric('amount_base', { precision: 15, scale: 2 }).notNull(),
  fx_rate: numeric('fx_rate', { precision: 10, scale: 4 }),
  description: text('description').notNull(),
  transaction_date: date('transaction_date').notNull(),
  journal_id: integer('journal_id').references(() => journalsTable.id),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Import Batches table
export const importBatchesTable = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  status: importStatusEnum('status').notNull().default('PENDING'),
  total_rows: integer('total_rows').notNull().default(0),
  processed_rows: integer('processed_rows').notNull().default(0),
  error_rows: integer('error_rows').notNull().default(0),
  error_details: text('error_details'),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

// Attachments table
export const attachmentsTable = pgTable('attachments', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  original_filename: text('original_filename').notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size').notNull(),
  mime_type: text('mime_type').notNull(),
  journal_id: integer('journal_id').references(() => journalsTable.id),
  import_batch_id: integer('import_batch_id').references(() => importBatchesTable.id),
  uploaded_by: integer('uploaded_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Audit Log table
export const auditLogsTable = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  table_name: text('table_name').notNull(),
  record_id: integer('record_id').notNull(),
  action: text('action').notNull(),
  old_values: jsonb('old_values'),
  new_values: jsonb('new_values'),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const partnersRelations = relations(partnersTable, ({ many, one }) => ({
  users: many(usersTable),
  accounts: many(accountsTable),
  capitalMovements: many(capitalMovementsTable),
  journalLines: many(journalLinesTable),
}));

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  partner: one(partnersTable, {
    fields: [usersTable.partner_id],
    references: [partnersTable.id],
  }),
  createdJournals: many(journalsTable, { relationName: 'createdBy' }),
  postedJournals: many(journalsTable, { relationName: 'postedBy' }),
  lockedPeriods: many(periodsTable),
  capitalMovements: many(capitalMovementsTable),
  importBatches: many(importBatchesTable),
  attachments: many(attachmentsTable),
  auditLogs: many(auditLogsTable),
}));

export const accountsRelations = relations(accountsTable, ({ one, many }) => ({
  partner: one(partnersTable, {
    fields: [accountsTable.partner_id],
    references: [partnersTable.id],
  }),
  parentAccount: one(accountsTable, {
    fields: [accountsTable.parent_account_id],
    references: [accountsTable.id],
    relationName: 'parentChild',
  }),
  childAccounts: many(accountsTable, { relationName: 'parentChild' }),
  employees: many(employeesTable),
  journalLines: many(journalLinesTable),
}));

export const employeesRelations = relations(employeesTable, ({ one, many }) => ({
  fundingAccount: one(accountsTable, {
    fields: [employeesTable.funding_account_id],
    references: [accountsTable.id],
  }),
  journalLines: many(journalLinesTable),
}));

export const periodsRelations = relations(periodsTable, ({ one, many }) => ({
  lockedByUser: one(usersTable, {
    fields: [periodsTable.locked_by],
    references: [usersTable.id],
  }),
  journals: many(journalsTable),
}));

export const journalsRelations = relations(journalsTable, ({ one, many }) => ({
  period: one(periodsTable, {
    fields: [journalsTable.period_id],
    references: [periodsTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [journalsTable.created_by],
    references: [usersTable.id],
    relationName: 'createdBy',
  }),
  postedBy: one(usersTable, {
    fields: [journalsTable.posted_by],
    references: [usersTable.id],
    relationName: 'postedBy',
  }),
  journalLines: many(journalLinesTable),
  capitalMovements: many(capitalMovementsTable),
  attachments: many(attachmentsTable),
}));

export const journalLinesRelations = relations(journalLinesTable, ({ one }) => ({
  journal: one(journalsTable, {
    fields: [journalLinesTable.journal_id],
    references: [journalsTable.id],
  }),
  account: one(accountsTable, {
    fields: [journalLinesTable.account_id],
    references: [accountsTable.id],
  }),
  partner: one(partnersTable, {
    fields: [journalLinesTable.partner_id],
    references: [partnersTable.id],
  }),
  employee: one(employeesTable, {
    fields: [journalLinesTable.employee_id],
    references: [employeesTable.id],
  }),
}));

export const capitalMovementsRelations = relations(capitalMovementsTable, ({ one }) => ({
  partner: one(partnersTable, {
    fields: [capitalMovementsTable.partner_id],
    references: [partnersTable.id],
  }),
  journal: one(journalsTable, {
    fields: [capitalMovementsTable.journal_id],
    references: [journalsTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [capitalMovementsTable.created_by],
    references: [usersTable.id],
  }),
}));

export const importBatchesRelations = relations(importBatchesTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [importBatchesTable.created_by],
    references: [usersTable.id],
  }),
  attachments: many(attachmentsTable),
}));

export const attachmentsRelations = relations(attachmentsTable, ({ one }) => ({
  journal: one(journalsTable, {
    fields: [attachmentsTable.journal_id],
    references: [journalsTable.id],
  }),
  importBatch: one(importBatchesTable, {
    fields: [attachmentsTable.import_batch_id],
    references: [importBatchesTable.id],
  }),
  uploadedBy: one(usersTable, {
    fields: [attachmentsTable.uploaded_by],
    references: [usersTable.id],
  }),
}));

export const auditLogsRelations = relations(auditLogsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [auditLogsTable.user_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Partner = typeof partnersTable.$inferSelect;
export type NewPartner = typeof partnersTable.$inferInsert;

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;

export type Employee = typeof employeesTable.$inferSelect;
export type NewEmployee = typeof employeesTable.$inferInsert;

export type FxRate = typeof fxRatesTable.$inferSelect;
export type NewFxRate = typeof fxRatesTable.$inferInsert;

export type Period = typeof periodsTable.$inferSelect;
export type NewPeriod = typeof periodsTable.$inferInsert;

export type Journal = typeof journalsTable.$inferSelect;
export type NewJournal = typeof journalsTable.$inferInsert;

export type JournalLine = typeof journalLinesTable.$inferSelect;
export type NewJournalLine = typeof journalLinesTable.$inferInsert;

export type CapitalMovement = typeof capitalMovementsTable.$inferSelect;
export type NewCapitalMovement = typeof capitalMovementsTable.$inferInsert;

export type ImportBatch = typeof importBatchesTable.$inferSelect;
export type NewImportBatch = typeof importBatchesTable.$inferInsert;

export type Attachment = typeof attachmentsTable.$inferSelect;
export type NewAttachment = typeof attachmentsTable.$inferInsert;

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type NewAuditLog = typeof auditLogsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  partners: partnersTable,
  users: usersTable,
  accounts: accountsTable,
  employees: employeesTable,
  fxRates: fxRatesTable,
  periods: periodsTable,
  journals: journalsTable,
  journalLines: journalLinesTable,
  capitalMovements: capitalMovementsTable,
  importBatches: importBatchesTable,
  attachments: attachmentsTable,
  auditLogs: auditLogsTable,
};