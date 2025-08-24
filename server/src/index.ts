import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createPartnerInputSchema,
  updatePartnerInputSchema,
  createAccountInputSchema,
  createEmployeeInputSchema,
  createFxRateInputSchema,
  updateFxRateInputSchema,
  createPeriodInputSchema,
  lockPeriodInputSchema,
  createJournalInputSchema,
  createJournalLineInputSchema,
  postJournalInputSchema,
  createCapitalMovementInputSchema,
  createImportBatchInputSchema,
  updateImportBatchInputSchema,
  trialBalanceInputSchema,
  generalLedgerInputSchema,
  createAuditLogInputSchema,
  createUserInputSchema,
  idInputSchema,
  accountTypeInputSchema,
  currencyInputSchema,
  dateInputSchema,
  dateRangeInputSchema,
  yearMonthInputSchema,
  periodIdInputSchema,
  journalIdInputSchema,
  lineIdInputSchema,
  partnerIdInputSchema,
  userIdInputSchema,
  emailInputSchema,
  tableRecordInputSchema,
  limitInputSchema,
  fileBufferInputSchema,
  profitLossInputSchema,
  balanceSheetInputSchema,
  capitalRollforwardInputSchema,
  salaryRegisterInputSchema,
  fxSummaryInputSchema,
  auditPackInputSchema,
  updateUserRoleInputSchema,
  auditFilterInputSchema,
  journalFilterInputSchema,
  capitalMovementFilterInputSchema,
  partnerBalanceInputSchema,
} from './schema';

// Import handlers
import {
  createPartner,
  getPartners,
  getPartner,
  updatePartner,
  deletePartner,
} from './handlers/partner_handlers';

import {
  createAccount,
  getAccounts,
  getAccountsByType,
  getBankAccounts,
  getCapitalAccounts,
  getPayrollSourceAccounts,
} from './handlers/account_handlers';

import {
  createEmployee,
  getEmployees,
  getEmployeesByCurrency,
  getEmployee,
} from './handlers/employee_handlers';

import {
  setFxRate,
  getFxRate,
  getFxRates,
  lockFxRate,
  getCurrentFxRate,
} from './handlers/fx_rate_handlers';

import {
  createPeriod,
  getPeriods,
  getCurrentPeriod,
  getPeriod,
  lockPeriod,
  validatePeriodClose,
} from './handlers/period_handlers';

import {
  createJournal,
  addJournalLine,
  getJournal,
  getJournals,
  postJournal,
  validateJournal,
  deleteJournalLine,
} from './handlers/journal_handlers';

import {
  createCapitalMovement,
  getPartnerCapitalMovements,
  getCapitalMovements,
  getPartnerCapitalBalance,
} from './handlers/capital_movement_handlers';

import {
  createImportBatch,
  updateImportBatch,
  getImportBatch,
  getImportBatches,
  processImportFile,
  validateImportData,
} from './handlers/import_handlers';

import {
  generateTrialBalance,
  generateGeneralLedger,
  generateProfitAndLoss,
  generateBalanceSheet,
  generateCapitalRollforward,
  generateSalaryRegister,
  generateFxSummary,
  generateAuditPack,
} from './handlers/report_handlers';

import {
  getCashBalances,
  getIncomeExpenseComparison,
  getSalarySplit,
  getFxImpact,
  getPartnerSummary,
  getCashRunway,
  getKPIs,
} from './handlers/dashboard_handlers';

import {
  createAuditLog,
  getAuditLogsForRecord,
  getAuditLogsForUser,
  getRecentAuditActivities,
  getAuditLogs,
} from './handlers/audit_handlers';

import {
  createUser,
  getUsers,
  getUser,
  getUserByEmail,
  updateUserRole,
  deactivateUser,
} from './handlers/user_handlers';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Partner routes
  partners: router({
    create: publicProcedure
      .input(createPartnerInputSchema)
      .mutation(({ input }) => createPartner(input)),
    
    getAll: publicProcedure
      .query(() => getPartners()),
    
    getById: publicProcedure
      .input(idInputSchema)
      .query(({ input }) => getPartner(input.id)),
    
    update: publicProcedure
      .input(updatePartnerInputSchema)
      .mutation(({ input }) => updatePartner(input)),
    
    delete: publicProcedure
      .input(idInputSchema)
      .mutation(({ input }) => deletePartner(input.id)),
  }),

  // Account routes
  accounts: router({
    create: publicProcedure
      .input(createAccountInputSchema)
      .mutation(({ input }) => createAccount(input)),
    
    getAll: publicProcedure
      .query(() => getAccounts()),
    
    getByType: publicProcedure
      .input(accountTypeInputSchema)
      .query(({ input }) => getAccountsByType(input.accountType)),
    
    getBankAccounts: publicProcedure
      .query(() => getBankAccounts()),
    
    getCapitalAccounts: publicProcedure
      .query(() => getCapitalAccounts()),
    
    getPayrollSourceAccounts: publicProcedure
      .query(() => getPayrollSourceAccounts()),
  }),

  // Employee routes
  employees: router({
    create: publicProcedure
      .input(createEmployeeInputSchema)
      .mutation(({ input }) => createEmployee(input)),
    
    getAll: publicProcedure
      .query(() => getEmployees()),
    
    getByCurrency: publicProcedure
      .input(currencyInputSchema)
      .query(({ input }) => getEmployeesByCurrency(input.currency)),
    
    getById: publicProcedure
      .input(idInputSchema)
      .query(({ input }) => getEmployee(input.id)),
  }),

  // FX Rate routes
  fxRates: router({
    set: publicProcedure
      .input(createFxRateInputSchema)
      .mutation(({ input }) => setFxRate(input)),
    
    getByDate: publicProcedure
      .input(dateInputSchema)
      .query(({ input }) => getFxRate(input.date)),
    
    getRange: publicProcedure
      .input(dateRangeInputSchema)
      .query(({ input }) => getFxRates(input.fromDate, input.toDate)),
    
    lock: publicProcedure
      .input(updateFxRateInputSchema)
      .mutation(({ input }) => lockFxRate(input)),
    
    getCurrent: publicProcedure
      .query(() => getCurrentFxRate()),
  }),

  // Period routes
  periods: router({
    create: publicProcedure
      .input(createPeriodInputSchema)
      .mutation(({ input }) => createPeriod(input)),
    
    getAll: publicProcedure
      .query(() => getPeriods()),
    
    getCurrent: publicProcedure
      .query(() => getCurrentPeriod()),
    
    getByYearMonth: publicProcedure
      .input(yearMonthInputSchema)
      .query(({ input }) => getPeriod(input.year, input.month)),
    
    lock: publicProcedure
      .input(lockPeriodInputSchema)
      .mutation(({ input }) => lockPeriod(input)),
    
    validateClose: publicProcedure
      .input(idInputSchema)
      .query(({ input }) => validatePeriodClose(input.id)),
  }),

  // Journal routes
  journals: router({
    create: publicProcedure
      .input(createJournalInputSchema)
      .mutation(({ input }) => createJournal(input)),
    
    addLine: publicProcedure
      .input(createJournalLineInputSchema)
      .mutation(({ input }) => addJournalLine(input)),
    
    getById: publicProcedure
      .input(idInputSchema)
      .query(({ input }) => getJournal(input.id)),
    
    getAll: publicProcedure
      .input(journalFilterInputSchema)
      .query(({ input }) => getJournals(input)),
    
    post: publicProcedure
      .input(postJournalInputSchema)
      .mutation(({ input }) => postJournal(input)),
    
    validate: publicProcedure
      .input(journalIdInputSchema)
      .query(({ input }) => validateJournal(input.journalId)),
    
    deleteLine: publicProcedure
      .input(lineIdInputSchema)
      .mutation(({ input }) => deleteJournalLine(input.lineId)),
  }),

  // Capital Movement routes
  capitalMovements: router({
    create: publicProcedure
      .input(createCapitalMovementInputSchema)
      .mutation(({ input }) => createCapitalMovement(input)),
    
    getByPartner: publicProcedure
      .input(partnerIdInputSchema)
      .query(({ input }) => getPartnerCapitalMovements(input.partnerId)),
    
    getAll: publicProcedure
      .input(capitalMovementFilterInputSchema)
      .query(({ input }) => getCapitalMovements(input)),
    
    getPartnerBalance: publicProcedure
      .input(partnerBalanceInputSchema)
      .query(({ input }) => getPartnerCapitalBalance(input.partnerId, input.asOfDate)),
  }),

  // Import routes
  imports: router({
    createBatch: publicProcedure
      .input(createImportBatchInputSchema)
      .mutation(({ input }) => createImportBatch(input)),
    
    updateBatch: publicProcedure
      .input(updateImportBatchInputSchema)
      .mutation(({ input }) => updateImportBatch(input)),
    
    getBatch: publicProcedure
      .input(idInputSchema)
      .query(({ input }) => getImportBatch(input.id)),
    
    getAllBatches: publicProcedure
      .query(() => getImportBatches()),
    
    // Note: processFile would need special handling for file uploads in a real implementation
    validateData: publicProcedure
      .input(fileBufferInputSchema)
      .query(({ input }) => validateImportData(
        Buffer.from(input.fileBuffer, 'base64'), 
        input.mapping
      )),
  }),

  // Report routes
  reports: router({
    trialBalance: publicProcedure
      .input(trialBalanceInputSchema)
      .query(({ input }) => generateTrialBalance(input)),
    
    generalLedger: publicProcedure
      .input(generalLedgerInputSchema)
      .query(({ input }) => generateGeneralLedger(input)),
    
    profitAndLoss: publicProcedure
      .input(profitLossInputSchema)
      .query(({ input }) => generateProfitAndLoss(input.fromDate, input.toDate, input.currency)),
    
    balanceSheet: publicProcedure
      .input(balanceSheetInputSchema)
      .query(({ input }) => generateBalanceSheet(input.asOfDate, input.currency)),
    
    capitalRollforward: publicProcedure
      .input(capitalRollforwardInputSchema)
      .query(({ input }) => generateCapitalRollforward(input.fromDate, input.toDate, input.partnerId)),
    
    salaryRegister: publicProcedure
      .input(salaryRegisterInputSchema)
      .query(({ input }) => generateSalaryRegister(input.fromDate, input.toDate, input.currency)),
    
    fxSummary: publicProcedure
      .input(fxSummaryInputSchema)
      .query(({ input }) => generateFxSummary(input.fromDate, input.toDate)),
    
    auditPack: publicProcedure
      .input(auditPackInputSchema)
      .query(({ input }) => generateAuditPack(input.periodId)),
  }),

  // Dashboard routes
  dashboard: router({
    cashBalances: publicProcedure
      .query(() => getCashBalances()),
    
    incomeExpense: publicProcedure
      .query(() => getIncomeExpenseComparison()),
    
    salarySplit: publicProcedure
      .input(periodIdInputSchema)
      .query(({ input }) => getSalarySplit(input.periodId)),
    
    fxImpact: publicProcedure
      .input(periodIdInputSchema)
      .query(({ input }) => getFxImpact(input.periodId)),
    
    partnerSummary: publicProcedure
      .query(() => getPartnerSummary()),
    
    cashRunway: publicProcedure
      .query(() => getCashRunway()),
    
    kpis: publicProcedure
      .input(periodIdInputSchema)
      .query(({ input }) => getKPIs(input.periodId)),
  }),

  // Audit routes
  audit: router({
    createLog: publicProcedure
      .input(createAuditLogInputSchema)
      .mutation(({ input }) => createAuditLog(input)),
    
    getForRecord: publicProcedure
      .input(tableRecordInputSchema)
      .query(({ input }) => getAuditLogsForRecord(input.tableName, input.recordId)),
    
    getForUser: publicProcedure
      .input(userIdInputSchema.extend({ limit: z.number().optional() }))
      .query(({ input }) => getAuditLogsForUser(input.userId, input.limit)),
    
    getRecent: publicProcedure
      .input(limitInputSchema.extend({ limit: z.number().default(50) }))
      .query(({ input }) => getRecentAuditActivities(input.limit)),
    
    getFiltered: publicProcedure
      .input(auditFilterInputSchema)
      .query(({ input }) => getAuditLogs(input)),
  }),

  // User routes
  users: router({
    create: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    
    getAll: publicProcedure
      .query(() => getUsers()),
    
    getById: publicProcedure
      .input(idInputSchema)
      .query(({ input }) => getUser(input.id)),
    
    getByEmail: publicProcedure
      .input(emailInputSchema)
      .query(({ input }) => getUserByEmail(input.email)),
    
    updateRole: publicProcedure
      .input(updateUserRoleInputSchema)
      .mutation(({ input }) => updateUserRole(input.userId, input.role, input.partnerId)),
    
    deactivate: publicProcedure
      .input(userIdInputSchema)
      .mutation(({ input }) => deactivateUser(input.userId)),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Multi-Currency Partner Audit Dashboard TRPC server listening at port: ${port}`);
}

start();