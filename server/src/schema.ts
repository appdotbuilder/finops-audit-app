import { z } from 'zod';

// Enums for the application
export const currencySchema = z.enum(['USD', 'PKR']);
export type Currency = z.infer<typeof currencySchema>;

export const roleSchema = z.enum(['ADMIN', 'FINANCE', 'AUDITOR', 'PARTNER']);
export type Role = z.infer<typeof roleSchema>;

export const incomeTypeSchema = z.enum(['SERVICES', 'OTHER']);
export type IncomeType = z.infer<typeof incomeTypeSchema>;

export const expenseTypeSchema = z.enum(['OPERATIONAL', 'MARKETING']);
export type ExpenseType = z.infer<typeof expenseTypeSchema>;

export const accountTypeSchema = z.enum([
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
  'PARTNER_USD', 'PARTNER_PKR', 'COMPANY_USD_OPERATING', 
  'VIRTUAL', 'CLEARING'
]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const transactionTypeSchema = z.enum([
  'INCOME', 'EXPENSE', 'SALARY_PAYMENT', 'CAPITAL_MOVEMENT', 
  'FX_TRANSACTION', 'ADJUSTMENT'
]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const journalStatusSchema = z.enum(['DRAFT', 'POSTED', 'CANCELLED']);
export type JournalStatus = z.infer<typeof journalStatusSchema>;

export const periodStatusSchema = z.enum(['OPEN', 'CLOSED']);
export type PeriodStatus = z.infer<typeof periodStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type User = z.infer<typeof userSchema>;

// Partner schema
export const partnerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  user_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Partner = z.infer<typeof partnerSchema>;

// Employee schema
export const employeeSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  salary_amount: z.number(),
  salary_currency: currencySchema,
  user_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Employee = z.infer<typeof employeeSchema>;

// Account schema
export const accountSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  account_type: accountTypeSchema,
  currency: currencySchema,
  parent_id: z.number().nullable(),
  partner_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Account = z.infer<typeof accountSchema>;

// FX Rate schema
export const fxRateSchema = z.object({
  id: z.number(),
  from_currency: currencySchema,
  to_currency: currencySchema,
  rate: z.number(),
  effective_date: z.coerce.date(),
  created_by: z.number(),
  created_at: z.coerce.date()
});
export type FxRate = z.infer<typeof fxRateSchema>;

// Journal Entry schema
export const journalEntrySchema = z.object({
  id: z.number(),
  reference: z.string(),
  description: z.string(),
  transaction_type: transactionTypeSchema,
  status: journalStatusSchema,
  transaction_date: z.coerce.date(),
  posted_date: z.coerce.date().nullable(),
  created_by: z.number(),
  posted_by: z.number().nullable(),
  partner_id: z.number().nullable(),
  employee_id: z.number().nullable(),
  fx_rate_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

// Journal Line schema
export const journalLineSchema = z.object({
  id: z.number(),
  journal_entry_id: z.number(),
  account_id: z.number(),
  debit_amount: z.number(),
  credit_amount: z.number(),
  currency: currencySchema,
  description: z.string().nullable(),
  created_at: z.coerce.date()
});
export type JournalLine = z.infer<typeof journalLineSchema>;

// Accounting Period schema
export const accountingPeriodSchema = z.object({
  id: z.number(),
  name: z.string(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  status: periodStatusSchema,
  closed_by: z.number().nullable(),
  closed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type AccountingPeriod = z.infer<typeof accountingPeriodSchema>;

// Audit Trail schema
export const auditTrailSchema = z.object({
  id: z.number(),
  table_name: z.string(),
  record_id: z.number(),
  action: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  old_values: z.string().nullable(),
  new_values: z.string().nullable(),
  user_id: z.number(),
  timestamp: z.coerce.date()
});
export type AuditTrail = z.infer<typeof auditTrailSchema>;

// Data Import schema
export const dataImportSchema = z.object({
  id: z.number(),
  filename: z.string(),
  file_type: z.enum(['CSV', 'XLSX']),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  total_records: z.number().nullable(),
  processed_records: z.number().nullable(),
  error_records: z.number().nullable(),
  error_details: z.string().nullable(),
  uploaded_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type DataImport = z.infer<typeof dataImportSchema>;

// Input schemas for API operations

// Create User Input
export const createUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: roleSchema,
  is_active: z.boolean().default(true)
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Create Partner Input
export const createPartnerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable(),
  user_id: z.number().nullable(),
  is_active: z.boolean().default(true)
});
export type CreatePartnerInput = z.infer<typeof createPartnerInputSchema>;

// Create Employee Input
export const createEmployeeInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable(),
  salary_amount: z.number().positive(),
  salary_currency: currencySchema,
  user_id: z.number().nullable(),
  is_active: z.boolean().default(true)
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeInputSchema>;

// Create Account Input
export const createAccountInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  account_type: accountTypeSchema,
  currency: currencySchema,
  parent_id: z.number().nullable(),
  partner_id: z.number().nullable(),
  is_active: z.boolean().default(true)
});
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

// Create FX Rate Input
export const createFxRateInputSchema = z.object({
  from_currency: currencySchema,
  to_currency: currencySchema,
  rate: z.number().positive(),
  effective_date: z.coerce.date(),
  created_by: z.number()
});
export type CreateFxRateInput = z.infer<typeof createFxRateInputSchema>;

// Create Journal Entry Input
export const createJournalEntryInputSchema = z.object({
  reference: z.string().min(1),
  description: z.string().min(1),
  transaction_type: transactionTypeSchema,
  transaction_date: z.coerce.date(),
  created_by: z.number(),
  partner_id: z.number().nullable(),
  employee_id: z.number().nullable(),
  fx_rate_id: z.number().nullable(),
  journal_lines: z.array(z.object({
    account_id: z.number(),
    debit_amount: z.number().nonnegative(),
    credit_amount: z.number().nonnegative(),
    currency: currencySchema,
    description: z.string().nullable()
  })).min(2) // At least 2 lines for double entry
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntryInputSchema>;

// Post Journal Entry Input
export const postJournalEntryInputSchema = z.object({
  journal_entry_id: z.number(),
  posted_by: z.number()
});
export type PostJournalEntryInput = z.infer<typeof postJournalEntryInputSchema>;

// Create Accounting Period Input
export const createAccountingPeriodInputSchema = z.object({
  name: z.string().min(1),
  start_date: z.coerce.date(),
  end_date: z.coerce.date()
});
export type CreateAccountingPeriodInput = z.infer<typeof createAccountingPeriodInputSchema>;

// Close Accounting Period Input
export const closeAccountingPeriodInputSchema = z.object({
  period_id: z.number(),
  closed_by: z.number()
});
export type CloseAccountingPeriodInput = z.infer<typeof closeAccountingPeriodInputSchema>;

// Dashboard Data Response
export const dashboardDataSchema = z.object({
  cash_balances: z.object({
    USD: z.number(),
    PKR: z.number()
  }),
  income_vs_expense: z.object({
    income: z.object({
      USD: z.number(),
      PKR: z.number()
    }),
    expense: z.object({
      USD: z.number(),
      PKR: z.number()
    })
  }),
  salaries_by_currency: z.object({
    USD: z.number(),
    PKR: z.number()
  }),
  partner_profit_loss: z.array(z.object({
    partner_id: z.number(),
    partner_name: z.string(),
    profit_loss_usd: z.number(),
    profit_loss_pkr: z.number()
  })),
  realized_fx: z.number()
});
export type DashboardData = z.infer<typeof dashboardDataSchema>;

// Data Import Input
export const createDataImportInputSchema = z.object({
  filename: z.string().min(1),
  file_type: z.enum(['CSV', 'XLSX']),
  uploaded_by: z.number()
});
export type CreateDataImportInput = z.infer<typeof createDataImportInputSchema>;

// Audit Report Input
export const generateAuditReportInputSchema = z.object({
  period_id: z.number(),
  report_type: z.enum(['FULL', 'SUMMARY', 'PARTNER_SPECIFIC']),
  partner_id: z.number().nullable(),
  include_audit_trail: z.boolean().default(false)
});
export type GenerateAuditReportInput = z.infer<typeof generateAuditReportInputSchema>;