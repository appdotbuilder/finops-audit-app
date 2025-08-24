import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  date,
  pgEnum,
  jsonb
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const currencyEnum = pgEnum('currency', ['USD', 'PKR']);
export const roleEnum = pgEnum('role', ['ADMIN', 'FINANCE', 'AUDITOR', 'PARTNER']);
export const incomeTypeEnum = pgEnum('income_type', ['SERVICES', 'OTHER']);
export const expenseTypeEnum = pgEnum('expense_type', ['OPERATIONAL', 'MARKETING']);
export const accountTypeEnum = pgEnum('account_type', [
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
  'PARTNER_USD', 'PARTNER_PKR', 'COMPANY_USD_OPERATING', 
  'VIRTUAL', 'CLEARING'
]);
export const transactionTypeEnum = pgEnum('transaction_type', [
  'INCOME', 'EXPENSE', 'SALARY_PAYMENT', 'CAPITAL_MOVEMENT', 
  'FX_TRANSACTION', 'ADJUSTMENT'
]);
export const journalStatusEnum = pgEnum('journal_status', ['DRAFT', 'POSTED', 'CANCELLED']);
export const periodStatusEnum = pgEnum('period_status', ['OPEN', 'CLOSED']);
export const auditActionEnum = pgEnum('audit_action', ['INSERT', 'UPDATE', 'DELETE']);
export const importStatusEnum = pgEnum('import_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export const fileTypeEnum = pgEnum('file_type', ['CSV', 'XLSX']);
export const reportTypeEnum = pgEnum('report_type', ['FULL', 'SUMMARY', 'PARTNER_SPECIFIC']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Partners table
export const partnersTable = pgTable('partners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  user_id: integer('user_id').references(() => usersTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Employees table
export const employeesTable = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  salary_amount: numeric('salary_amount', { precision: 15, scale: 2 }).notNull(),
  salary_currency: currencyEnum('salary_currency').notNull(),
  user_id: integer('user_id').references(() => usersTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Accounts table - define without self-reference first
export const accountsTable = pgTable('accounts', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  account_type: accountTypeEnum('account_type').notNull(),
  currency: currencyEnum('currency').notNull(),
  parent_id: integer('parent_id'), // Self-reference will be handled in relations
  partner_id: integer('partner_id').references(() => partnersTable.id),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// FX Rates table
export const fxRatesTable = pgTable('fx_rates', {
  id: serial('id').primaryKey(),
  from_currency: currencyEnum('from_currency').notNull(),
  to_currency: currencyEnum('to_currency').notNull(),
  rate: numeric('rate', { precision: 15, scale: 6 }).notNull(),
  effective_date: date('effective_date').notNull(),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Journal Entries table
export const journalEntriesTable = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  description: text('description').notNull(),
  transaction_type: transactionTypeEnum('transaction_type').notNull(),
  status: journalStatusEnum('status').notNull().default('DRAFT'),
  transaction_date: date('transaction_date').notNull(),
  posted_date: timestamp('posted_date'),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  posted_by: integer('posted_by').references(() => usersTable.id),
  partner_id: integer('partner_id').references(() => partnersTable.id),
  employee_id: integer('employee_id').references(() => employeesTable.id),
  fx_rate_id: integer('fx_rate_id').references(() => fxRatesTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Journal Lines table
export const journalLinesTable = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journal_entry_id: integer('journal_entry_id').notNull().references(() => journalEntriesTable.id),
  account_id: integer('account_id').notNull().references(() => accountsTable.id),
  debit_amount: numeric('debit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  credit_amount: numeric('credit_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  currency: currencyEnum('currency').notNull(),
  description: text('description'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Accounting Periods table
export const accountingPeriodsTable = pgTable('accounting_periods', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  status: periodStatusEnum('status').notNull().default('OPEN'),
  closed_by: integer('closed_by').references(() => usersTable.id),
  closed_at: timestamp('closed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Audit Trail table
export const auditTrailTable = pgTable('audit_trail', {
  id: serial('id').primaryKey(),
  table_name: text('table_name').notNull(),
  record_id: integer('record_id').notNull(),
  action: auditActionEnum('action').notNull(),
  old_values: jsonb('old_values'),
  new_values: jsonb('new_values'),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

// Data Imports table
export const dataImportsTable = pgTable('data_imports', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  file_type: fileTypeEnum('file_type').notNull(),
  status: importStatusEnum('status').notNull().default('PENDING'),
  total_records: integer('total_records'),
  processed_records: integer('processed_records').default(0),
  error_records: integer('error_records').default(0),
  error_details: text('error_details'),
  uploaded_by: integer('uploaded_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many, one }) => ({
  partners: many(partnersTable),
  employees: many(employeesTable),
  journalEntriesCreated: many(journalEntriesTable, { relationName: 'createdBy' }),
  journalEntriesPosted: many(journalEntriesTable, { relationName: 'postedBy' }),
  fxRates: many(fxRatesTable),
  auditTrail: many(auditTrailTable),
  dataImports: many(dataImportsTable),
  periodsClosedBy: many(accountingPeriodsTable)
}));

export const partnersRelations = relations(partnersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [partnersTable.user_id],
    references: [usersTable.id]
  }),
  accounts: many(accountsTable),
  journalEntries: many(journalEntriesTable)
}));

export const employeesRelations = relations(employeesTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [employeesTable.user_id],
    references: [usersTable.id]
  }),
  journalEntries: many(journalEntriesTable)
}));

export const accountsRelations = relations(accountsTable, ({ one, many }) => ({
  parent: one(accountsTable, {
    fields: [accountsTable.parent_id],
    references: [accountsTable.id],
    relationName: 'parentAccount'
  }),
  children: many(accountsTable, { relationName: 'parentAccount' }),
  partner: one(partnersTable, {
    fields: [accountsTable.partner_id],
    references: [partnersTable.id]
  }),
  journalLines: many(journalLinesTable)
}));

export const fxRatesRelations = relations(fxRatesTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [fxRatesTable.created_by],
    references: [usersTable.id]
  }),
  journalEntries: many(journalEntriesTable)
}));

export const journalEntriesRelations = relations(journalEntriesTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [journalEntriesTable.created_by],
    references: [usersTable.id],
    relationName: 'createdBy'
  }),
  postedBy: one(usersTable, {
    fields: [journalEntriesTable.posted_by],
    references: [usersTable.id],
    relationName: 'postedBy'
  }),
  partner: one(partnersTable, {
    fields: [journalEntriesTable.partner_id],
    references: [partnersTable.id]
  }),
  employee: one(employeesTable, {
    fields: [journalEntriesTable.employee_id],
    references: [employeesTable.id]
  }),
  fxRate: one(fxRatesTable, {
    fields: [journalEntriesTable.fx_rate_id],
    references: [fxRatesTable.id]
  }),
  journalLines: many(journalLinesTable)
}));

export const journalLinesRelations = relations(journalLinesTable, ({ one }) => ({
  journalEntry: one(journalEntriesTable, {
    fields: [journalLinesTable.journal_entry_id],
    references: [journalEntriesTable.id]
  }),
  account: one(accountsTable, {
    fields: [journalLinesTable.account_id],
    references: [accountsTable.id]
  })
}));

export const accountingPeriodsRelations = relations(accountingPeriodsTable, ({ one }) => ({
  closedBy: one(usersTable, {
    fields: [accountingPeriodsTable.closed_by],
    references: [usersTable.id]
  })
}));

export const auditTrailRelations = relations(auditTrailTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [auditTrailTable.user_id],
    references: [usersTable.id]
  })
}));

export const dataImportsRelations = relations(dataImportsTable, ({ one }) => ({
  uploadedBy: one(usersTable, {
    fields: [dataImportsTable.uploaded_by],
    references: [usersTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Partner = typeof partnersTable.$inferSelect;
export type NewPartner = typeof partnersTable.$inferInsert;

export type Employee = typeof employeesTable.$inferSelect;
export type NewEmployee = typeof employeesTable.$inferInsert;

export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;

export type FxRate = typeof fxRatesTable.$inferSelect;
export type NewFxRate = typeof fxRatesTable.$inferInsert;

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type NewJournalEntry = typeof journalEntriesTable.$inferInsert;

export type JournalLine = typeof journalLinesTable.$inferSelect;
export type NewJournalLine = typeof journalLinesTable.$inferInsert;

export type AccountingPeriod = typeof accountingPeriodsTable.$inferSelect;
export type NewAccountingPeriod = typeof accountingPeriodsTable.$inferInsert;

export type AuditTrail = typeof auditTrailTable.$inferSelect;
export type NewAuditTrail = typeof auditTrailTable.$inferInsert;

export type DataImport = typeof dataImportsTable.$inferSelect;
export type NewDataImport = typeof dataImportsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  partners: partnersTable,
  employees: employeesTable,
  accounts: accountsTable,
  fxRates: fxRatesTable,
  journalEntries: journalEntriesTable,
  journalLines: journalLinesTable,
  accountingPeriods: accountingPeriodsTable,
  auditTrail: auditTrailTable,
  dataImports: dataImportsTable
};