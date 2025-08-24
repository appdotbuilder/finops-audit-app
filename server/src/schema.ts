import { z } from 'zod';

// Enums
export const CurrencyEnum = z.enum(['USD', 'PKR']);
export type Currency = z.infer<typeof CurrencyEnum>;

export const AccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'OTHER']);
export type AccountType = z.infer<typeof AccountTypeEnum>;

export const RoleEnum = z.enum(['ADMIN', 'FINANCE', 'AUDITOR', 'PARTNER']);
export type Role = z.infer<typeof RoleEnum>;

export const JournalStatusEnum = z.enum(['DRAFT', 'POSTED']);
export type JournalStatus = z.infer<typeof JournalStatusEnum>;

export const PeriodStatusEnum = z.enum(['OPEN', 'LOCKED']);
export type PeriodStatus = z.infer<typeof PeriodStatusEnum>;

export const ImportStatusEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export type ImportStatus = z.infer<typeof ImportStatusEnum>;

export const CapitalMovementTypeEnum = z.enum(['CONTRIBUTION', 'DRAW']);
export type CapitalMovementType = z.infer<typeof CapitalMovementTypeEnum>;

// Partner schema
export const partnerSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  has_usd_account: z.boolean(),
  has_pkr_account: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Partner = z.infer<typeof partnerSchema>;

export const createPartnerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  has_usd_account: z.boolean(),
  has_pkr_account: z.boolean()
});

export type CreatePartnerInput = z.infer<typeof createPartnerInputSchema>;

export const updatePartnerInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  has_usd_account: z.boolean().optional(),
  has_pkr_account: z.boolean().optional()
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerInputSchema>;

// Employee schema
export const employeeSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  salary_currency: CurrencyEnum,
  funding_account_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Employee = z.infer<typeof employeeSchema>;

export const createEmployeeInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  salary_currency: CurrencyEnum,
  funding_account_id: z.number()
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeInputSchema>;

// Account schema
export const accountSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  account_type: AccountTypeEnum,
  currency: CurrencyEnum,
  is_bank_account: z.boolean(),
  is_capital_account: z.boolean(),
  is_payroll_source: z.boolean(),
  is_intercompany: z.boolean(),
  partner_id: z.number().nullable(),
  parent_account_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Account = z.infer<typeof accountSchema>;

export const createAccountInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  account_type: AccountTypeEnum,
  currency: CurrencyEnum,
  is_bank_account: z.boolean().default(false),
  is_capital_account: z.boolean().default(false),
  is_payroll_source: z.boolean().default(false),
  is_intercompany: z.boolean().default(false),
  partner_id: z.number().nullable().optional(),
  parent_account_id: z.number().nullable().optional()
});

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

// FX Rate schema
export const fxRateSchema = z.object({
  id: z.number(),
  date: z.coerce.date(),
  usd_to_pkr_rate: z.number(),
  is_locked: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type FxRate = z.infer<typeof fxRateSchema>;

export const createFxRateInputSchema = z.object({
  date: z.coerce.date(),
  usd_to_pkr_rate: z.number().positive()
});

export type CreateFxRateInput = z.infer<typeof createFxRateInputSchema>;

export const updateFxRateInputSchema = z.object({
  id: z.number(),
  usd_to_pkr_rate: z.number().positive().optional(),
  is_locked: z.boolean().optional()
});

export type UpdateFxRateInput = z.infer<typeof updateFxRateInputSchema>;

// Period schema
export const periodSchema = z.object({
  id: z.number(),
  year: z.number(),
  month: z.number(),
  status: PeriodStatusEnum,
  locked_at: z.coerce.date().nullable(),
  locked_by: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Period = z.infer<typeof periodSchema>;

export const createPeriodInputSchema = z.object({
  year: z.number().int().min(2000).max(3000),
  month: z.number().int().min(1).max(12)
});

export type CreatePeriodInput = z.infer<typeof createPeriodInputSchema>;

export const lockPeriodInputSchema = z.object({
  id: z.number(),
  locked_by: z.number()
});

export type LockPeriodInput = z.infer<typeof lockPeriodInputSchema>;

// Journal schema
export const journalSchema = z.object({
  id: z.number(),
  reference: z.string(),
  description: z.string(),
  transaction_date: z.coerce.date(),
  period_id: z.number(),
  status: JournalStatusEnum,
  posted_at: z.coerce.date().nullable(),
  posted_by: z.number().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Journal = z.infer<typeof journalSchema>;

export const createJournalInputSchema = z.object({
  reference: z.string().min(1),
  description: z.string().min(1),
  transaction_date: z.coerce.date(),
  period_id: z.number(),
  created_by: z.number()
});

export type CreateJournalInput = z.infer<typeof createJournalInputSchema>;

export const postJournalInputSchema = z.object({
  id: z.number(),
  posted_by: z.number()
});

export type PostJournalInput = z.infer<typeof postJournalInputSchema>;

// Journal Line schema
export const journalLineSchema = z.object({
  id: z.number(),
  journal_id: z.number(),
  account_id: z.number(),
  description: z.string(),
  debit_amount: z.number(),
  credit_amount: z.number(),
  debit_amount_base: z.number(),
  credit_amount_base: z.number(),
  fx_rate: z.number().nullable(),
  partner_id: z.number().nullable(),
  employee_id: z.number().nullable(),
  created_at: z.coerce.date()
});

export type JournalLine = z.infer<typeof journalLineSchema>;

export const createJournalLineInputSchema = z.object({
  journal_id: z.number(),
  account_id: z.number(),
  description: z.string().min(1),
  debit_amount: z.number().nonnegative(),
  credit_amount: z.number().nonnegative(),
  debit_amount_base: z.number().nonnegative(),
  credit_amount_base: z.number().nonnegative(),
  fx_rate: z.number().positive().nullable().optional(),
  partner_id: z.number().nullable().optional(),
  employee_id: z.number().nullable().optional()
});

export type CreateJournalLineInput = z.infer<typeof createJournalLineInputSchema>;

// Capital Movement schema
export const capitalMovementSchema = z.object({
  id: z.number(),
  partner_id: z.number(),
  movement_type: CapitalMovementTypeEnum,
  amount: z.number(),
  currency: CurrencyEnum,
  amount_base: z.number(),
  fx_rate: z.number().nullable(),
  description: z.string(),
  transaction_date: z.coerce.date(),
  journal_id: z.number().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date()
});

export type CapitalMovement = z.infer<typeof capitalMovementSchema>;

export const createCapitalMovementInputSchema = z.object({
  partner_id: z.number(),
  movement_type: CapitalMovementTypeEnum,
  amount: z.number().positive(),
  currency: CurrencyEnum,
  description: z.string().min(1),
  transaction_date: z.coerce.date(),
  created_by: z.number()
});

export type CreateCapitalMovementInput = z.infer<typeof createCapitalMovementInputSchema>;

// Attachment schema
export const attachmentSchema = z.object({
  id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  file_path: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  journal_id: z.number().nullable(),
  import_batch_id: z.number().nullable(),
  uploaded_by: z.number(),
  created_at: z.coerce.date()
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const createAttachmentInputSchema = z.object({
  filename: z.string().min(1),
  original_filename: z.string().min(1),
  file_path: z.string().min(1),
  file_size: z.number().positive(),
  mime_type: z.string().min(1),
  journal_id: z.number().nullable().optional(),
  import_batch_id: z.number().nullable().optional(),
  uploaded_by: z.number()
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentInputSchema>;

// Import Batch schema
export const importBatchSchema = z.object({
  id: z.number(),
  filename: z.string(),
  status: ImportStatusEnum,
  total_rows: z.number(),
  processed_rows: z.number(),
  error_rows: z.number(),
  error_details: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable()
});

export type ImportBatch = z.infer<typeof importBatchSchema>;

export const createImportBatchInputSchema = z.object({
  filename: z.string().min(1),
  total_rows: z.number().nonnegative(),
  created_by: z.number()
});

export type CreateImportBatchInput = z.infer<typeof createImportBatchInputSchema>;

export const updateImportBatchInputSchema = z.object({
  id: z.number(),
  status: ImportStatusEnum.optional(),
  processed_rows: z.number().nonnegative().optional(),
  error_rows: z.number().nonnegative().optional(),
  error_details: z.string().nullable().optional()
});

export type UpdateImportBatchInput = z.infer<typeof updateImportBatchInputSchema>;

// Audit Log schema
export const auditLogSchema = z.object({
  id: z.number(),
  table_name: z.string(),
  record_id: z.number(),
  action: z.string(),
  old_values: z.string().nullable(),
  new_values: z.string().nullable(),
  user_id: z.number(),
  created_at: z.coerce.date()
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export const createAuditLogInputSchema = z.object({
  table_name: z.string().min(1),
  record_id: z.number(),
  action: z.string().min(1),
  old_values: z.string().nullable().optional(),
  new_values: z.string().nullable().optional(),
  user_id: z.number()
});

export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;

// User schema (for authentication and roles)
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: RoleEnum,
  partner_id: z.number().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleEnum,
  partner_id: z.number().nullable().optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Dashboard widget schemas
export const dashboardBalanceSchema = z.object({
  currency: CurrencyEnum,
  balance: z.number(),
  balance_pkr: z.number()
});

export type DashboardBalance = z.infer<typeof dashboardBalanceSchema>;

export const dashboardIncomeExpenseSchema = z.object({
  period_type: z.enum(['MTD', 'YTD']),
  currency: CurrencyEnum,
  income: z.number(),
  expense: z.number(),
  net: z.number(),
  income_pkr: z.number(),
  expense_pkr: z.number(),
  net_pkr: z.number()
});

export type DashboardIncomeExpense = z.infer<typeof dashboardIncomeExpenseSchema>;

// Report schemas
export const trialBalanceLineSchema = z.object({
  account_code: z.string(),
  account_name: z.string(),
  account_type: AccountTypeEnum,
  currency: CurrencyEnum,
  debit_balance: z.number(),
  credit_balance: z.number(),
  debit_balance_base: z.number(),
  credit_balance_base: z.number()
});

export type TrialBalanceLine = z.infer<typeof trialBalanceLineSchema>;

export const trialBalanceInputSchema = z.object({
  as_of_date: z.coerce.date(),
  currency: CurrencyEnum.optional()
});

export type TrialBalanceInput = z.infer<typeof trialBalanceInputSchema>;

export const generalLedgerInputSchema = z.object({
  account_id: z.number().optional(),
  from_date: z.coerce.date(),
  to_date: z.coerce.date(),
  currency: CurrencyEnum.optional()
});

export type GeneralLedgerInput = z.infer<typeof generalLedgerInputSchema>;

// Additional input schemas for TRPC procedures
export const idInputSchema = z.object({
  id: z.number()
});

export const accountTypeInputSchema = z.object({
  accountType: z.string()
});

export const currencyInputSchema = z.object({
  currency: z.string()
});

export const dateInputSchema = z.object({
  date: z.coerce.date()
});

export const dateRangeInputSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date()
});

export const yearMonthInputSchema = z.object({
  year: z.number(),
  month: z.number()
});

export const periodIdInputSchema = z.object({
  periodId: z.number().optional()
});

export const journalIdInputSchema = z.object({
  journalId: z.number()
});

export const lineIdInputSchema = z.object({
  lineId: z.number()
});

export const partnerIdInputSchema = z.object({
  partnerId: z.number()
});

export const userIdInputSchema = z.object({
  userId: z.number()
});

export const emailInputSchema = z.object({
  email: z.string().email()
});

export const tableRecordInputSchema = z.object({
  tableName: z.string(),
  recordId: z.number()
});

export const limitInputSchema = z.object({
  limit: z.number().optional()
});

export const fileBufferInputSchema = z.object({
  fileBuffer: z.string(),
  mapping: z.record(z.string())
});

export const profitLossInputSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  currency: z.string().optional()
});

export const balanceSheetInputSchema = z.object({
  asOfDate: z.coerce.date(),
  currency: z.string().optional()
});

export const capitalRollforwardInputSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  partnerId: z.number().optional()
});

export const salaryRegisterInputSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  currency: z.string().optional()
});

export const fxSummaryInputSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date()
});

export const auditPackInputSchema = z.object({
  periodId: z.number()
});

export const updateUserRoleInputSchema = z.object({
  userId: z.number(),
  role: z.string(),
  partnerId: z.number().optional()
});

export const auditFilterInputSchema = z.object({
  tableName: z.string().optional(),
  userId: z.number().optional(),
  action: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.number().optional()
});

export const journalFilterInputSchema = z.object({
  periodId: z.number().optional(),
  status: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional()
});

export const capitalMovementFilterInputSchema = z.object({
  partnerId: z.number().optional(),
  movementType: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional()
});

export const partnerBalanceInputSchema = z.object({
  partnerId: z.number(),
  asOfDate: z.coerce.date().optional()
});