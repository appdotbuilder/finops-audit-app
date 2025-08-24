import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  createUserInputSchema,
  createPartnerInputSchema,
  createEmployeeInputSchema,
  createAccountInputSchema,
  createFxRateInputSchema,
  createJournalEntryInputSchema,
  postJournalEntryInputSchema,
  createAccountingPeriodInputSchema,
  closeAccountingPeriodInputSchema,
  createDataImportInputSchema,
  generateAuditReportInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createPartner } from './handlers/create_partner';
import { getPartners } from './handlers/get_partners';
import { createEmployee } from './handlers/create_employee';
import { getEmployees } from './handlers/get_employees';
import { createAccount } from './handlers/create_account';
import { getAccounts } from './handlers/get_accounts';
import { createFxRate } from './handlers/create_fx_rate';
import { getFxRates } from './handlers/get_fx_rates';
import { createJournalEntry } from './handlers/create_journal_entry';
import { getJournalEntries } from './handlers/get_journal_entries';
import { postJournalEntry } from './handlers/post_journal_entry';
import { getDashboardData } from './handlers/get_dashboard_data';
import { createAccountingPeriod } from './handlers/create_accounting_period';
import { closeAccountingPeriod } from './handlers/close_accounting_period';
import { getAccountingPeriods } from './handlers/get_accounting_periods';
import { createDataImport } from './handlers/create_data_import';
import { getDataImports } from './handlers/get_data_imports';
import { generateAuditReport } from './handlers/generate_audit_report';
import { getAuditTrail } from './handlers/get_audit_trail';

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

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  getUsers: publicProcedure
    .query(() => getUsers()),

  // Partner management
  createPartner: publicProcedure
    .input(createPartnerInputSchema)
    .mutation(({ input }) => createPartner(input)),
  
  getPartners: publicProcedure
    .query(() => getPartners()),

  // Employee management
  createEmployee: publicProcedure
    .input(createEmployeeInputSchema)
    .mutation(({ input }) => createEmployee(input)),
  
  getEmployees: publicProcedure
    .query(() => getEmployees()),

  // Account management
  createAccount: publicProcedure
    .input(createAccountInputSchema)
    .mutation(({ input }) => createAccount(input)),
  
  getAccounts: publicProcedure
    .query(() => getAccounts()),

  // FX Rate management
  createFxRate: publicProcedure
    .input(createFxRateInputSchema)
    .mutation(({ input }) => createFxRate(input)),
  
  getFxRates: publicProcedure
    .query(() => getFxRates()),

  // Journal Entry management
  createJournalEntry: publicProcedure
    .input(createJournalEntryInputSchema)
    .mutation(({ input }) => createJournalEntry(input)),
  
  getJournalEntries: publicProcedure
    .query(() => getJournalEntries()),
  
  postJournalEntry: publicProcedure
    .input(postJournalEntryInputSchema)
    .mutation(({ input }) => postJournalEntry(input)),

  // Dashboard
  getDashboardData: publicProcedure
    .query(() => getDashboardData()),

  // Accounting Period management
  createAccountingPeriod: publicProcedure
    .input(createAccountingPeriodInputSchema)
    .mutation(({ input }) => createAccountingPeriod(input)),
  
  closeAccountingPeriod: publicProcedure
    .input(closeAccountingPeriodInputSchema)
    .mutation(({ input }) => closeAccountingPeriod(input)),
  
  getAccountingPeriods: publicProcedure
    .query(() => getAccountingPeriods()),

  // Data Import
  createDataImport: publicProcedure
    .input(createDataImportInputSchema)
    .mutation(({ input }) => createDataImport(input)),
  
  getDataImports: publicProcedure
    .query(() => getDataImports()),

  // Audit and Reporting
  generateAuditReport: publicProcedure
    .input(generateAuditReportInputSchema)
    .mutation(({ input }) => generateAuditReport(input)),
  
  getAuditTrail: publicProcedure
    .query(() => getAuditTrail()),
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
  console.log(`Multi-Currency Finance Operations TRPC server listening at port: ${port}`);
}

start();