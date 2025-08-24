import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { 
    partnersTable, 
    usersTable, 
    accountsTable, 
    employeesTable,
    fxRatesTable,
    periodsTable,
    journalsTable,
    journalLinesTable,
    capitalMovementsTable
} from '../db/schema';
import {
    getCashBalances,
    getIncomeExpenseComparison,
    getSalarySplit,
    getFxImpact,
    getPartnerSummary,
    getCashRunway,
    getKPIs
} from '../handlers/dashboard_handlers';

describe('Dashboard Handlers', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    // Helper function to create test data
    async function createTestData() {
        // Create partners
        const partner1 = await db.insert(partnersTable)
            .values({
                name: 'John Partner',
                email: 'john@partner.com',
                has_usd_account: true,
                has_pkr_account: true
            })
            .returning()
            .execute();

        const partner2 = await db.insert(partnersTable)
            .values({
                name: 'Jane Partner',
                email: 'jane@partner.com',
                has_usd_account: true,
                has_pkr_account: false
            })
            .returning()
            .execute();

        // Create user
        const user = await db.insert(usersTable)
            .values({
                name: 'Test User',
                email: 'test@user.com',
                role: 'ADMIN',
                partner_id: partner1[0].id
            })
            .returning()
            .execute();

        // Create FX rate for today
        const todayStr = new Date().toISOString().split('T')[0];
        
        const fxRate = await db.insert(fxRatesTable)
            .values({
                date: todayStr,
                usd_to_pkr_rate: '280.0000'
            })
            .returning()
            .execute();

        // Create accounts
        const usdBankAccount = await db.insert(accountsTable)
            .values({
                code: 'BANK-USD-001',
                name: 'USD Bank Account',
                account_type: 'ASSET',
                currency: 'USD',
                is_bank_account: true
            })
            .returning()
            .execute();

        const pkrBankAccount = await db.insert(accountsTable)
            .values({
                code: 'BANK-PKR-001',
                name: 'PKR Bank Account',
                account_type: 'ASSET',
                currency: 'PKR',
                is_bank_account: true
            })
            .returning()
            .execute();

        const revenueAccount = await db.insert(accountsTable)
            .values({
                code: 'REV-001',
                name: 'Revenue Account',
                account_type: 'INCOME',
                currency: 'USD'
            })
            .returning()
            .execute();

        const expenseAccount = await db.insert(accountsTable)
            .values({
                code: 'EXP-001',
                name: 'Office Expenses',
                account_type: 'EXPENSE',
                currency: 'PKR'
            })
            .returning()
            .execute();

        const capitalAccountUSD = await db.insert(accountsTable)
            .values({
                code: 'CAP-USD-001',
                name: 'Partner Capital USD',
                account_type: 'EQUITY',
                currency: 'USD',
                is_capital_account: true,
                partner_id: partner1[0].id
            })
            .returning()
            .execute();

        const capitalAccountPKR = await db.insert(accountsTable)
            .values({
                code: 'CAP-PKR-001',
                name: 'Partner Capital PKR',
                account_type: 'EQUITY',
                currency: 'PKR',
                is_capital_account: true,
                partner_id: partner2[0].id
            })
            .returning()
            .execute();

        // Create employee
        const employee = await db.insert(employeesTable)
            .values({
                name: 'Test Employee',
                email: 'employee@test.com',
                salary_currency: 'USD',
                funding_account_id: usdBankAccount[0].id
            })
            .returning()
            .execute();

        // Create period
        const currentDate = new Date();
        const period = await db.insert(periodsTable)
            .values({
                year: currentDate.getFullYear(),
                month: currentDate.getMonth() + 1,
                status: 'OPEN'
            })
            .returning()
            .execute();

        // Create journal for current month
        const currentDateStr = new Date().toISOString().split('T')[0];
        
        const journal = await db.insert(journalsTable)
            .values({
                reference: 'TEST-001',
                description: 'Test Journal Entry',
                transaction_date: currentDateStr,
                period_id: period[0].id,
                status: 'POSTED',
                created_by: user[0].id,
                posted_by: user[0].id,
                posted_at: new Date()
            })
            .returning()
            .execute();

        // Create journal lines for bank balances
        await db.insert(journalLinesTable)
            .values([
                // USD Bank deposit from capital
                {
                    journal_id: journal[0].id,
                    account_id: usdBankAccount[0].id,
                    description: 'USD Bank deposit',
                    debit_amount: '1000.00',
                    credit_amount: '0.00',
                    debit_amount_base: '1000.00',
                    credit_amount_base: '0.00'
                },
                // PKR Bank deposit from capital
                {
                    journal_id: journal[0].id,
                    account_id: pkrBankAccount[0].id,
                    description: 'PKR Bank deposit',
                    debit_amount: '50000.00',
                    credit_amount: '0.00',
                    debit_amount_base: '50000.00',
                    credit_amount_base: '0.00'
                },
                // Revenue recognition (USD converted)
                {
                    journal_id: journal[0].id,
                    account_id: revenueAccount[0].id,
                    description: 'Revenue entry',
                    debit_amount: '0.00',
                    credit_amount: '800.00',
                    debit_amount_base: '0.00',
                    credit_amount_base: '224000.00',
                    fx_rate: '280.0000'
                },
                // Office expense
                {
                    journal_id: journal[0].id,
                    account_id: expenseAccount[0].id,
                    description: 'Office expense',
                    debit_amount: '15000.00',
                    credit_amount: '0.00',
                    debit_amount_base: '15000.00',
                    credit_amount_base: '0.00'
                },
                // Partner capital USD
                {
                    journal_id: journal[0].id,
                    account_id: capitalAccountUSD[0].id,
                    description: 'Partner capital',
                    debit_amount: '0.00',
                    credit_amount: '200.00',
                    debit_amount_base: '0.00',
                    credit_amount_base: '56000.00',
                    fx_rate: '280.0000'
                },
                // Partner capital PKR
                {
                    journal_id: journal[0].id,
                    account_id: capitalAccountPKR[0].id,
                    description: 'Partner capital PKR',
                    debit_amount: '0.00',
                    credit_amount: '95000.00',
                    debit_amount_base: '0.00',
                    credit_amount_base: '95000.00'
                }
            ])
            .execute();

        // Create salary journal line
        await db.insert(journalLinesTable)
            .values({
                journal_id: journal[0].id,
                account_id: expenseAccount[0].id,
                description: 'Salary expense',
                debit_amount: '5000.00',
                credit_amount: '0.00',
                debit_amount_base: '5000.00',
                credit_amount_base: '0.00',
                employee_id: employee[0].id
            })
            .execute();

        return {
            partners: [partner1[0], partner2[0]],
            user: user[0],
            accounts: {
                usdBank: usdBankAccount[0],
                pkrBank: pkrBankAccount[0],
                revenue: revenueAccount[0],
                expense: expenseAccount[0],
                capitalUSD: capitalAccountUSD[0],
                capitalPKR: capitalAccountPKR[0]
            },
            employee: employee[0],
            period: period[0],
            journal: journal[0]
        };
    }

    describe('getCashBalances', () => {
        it('should return cash balances by currency', async () => {
            await createTestData();

            const balances = await getCashBalances();

            expect(balances).toHaveLength(2);
            
            const usdBalance = balances.find(b => b.currency === 'USD');
            const pkrBalance = balances.find(b => b.currency === 'PKR');

            expect(usdBalance).toBeDefined();
            expect(usdBalance!.balance).toEqual(1000);
            expect(usdBalance!.balance_pkr).toEqual(280000);

            expect(pkrBalance).toBeDefined();
            expect(pkrBalance!.balance).toEqual(50000);
            expect(pkrBalance!.balance_pkr).toEqual(50000);
        });

        it('should return empty array when no bank accounts exist', async () => {
            const balances = await getCashBalances();
            expect(balances).toHaveLength(0);
        });
    });

    describe('getIncomeExpenseComparison', () => {
        it('should return MTD and YTD income/expense comparison', async () => {
            await createTestData();

            const comparison = await getIncomeExpenseComparison();

            // Should have data for both MTD and YTD periods
            expect(comparison.length).toBeGreaterThan(0);

            const mtdData = comparison.filter(c => c.period_type === 'MTD');
            const ytdData = comparison.filter(c => c.period_type === 'YTD');

            expect(mtdData.length).toBeGreaterThan(0);
            expect(ytdData.length).toBeGreaterThan(0);

            // Check structure of first result
            const firstResult = comparison[0];
            expect(firstResult).toHaveProperty('period_type');
            expect(firstResult).toHaveProperty('currency');
            expect(firstResult).toHaveProperty('income');
            expect(firstResult).toHaveProperty('expense');
            expect(firstResult).toHaveProperty('net');
            expect(firstResult).toHaveProperty('income_pkr');
            expect(firstResult).toHaveProperty('expense_pkr');
            expect(firstResult).toHaveProperty('net_pkr');
        });

        it('should return empty array when no transactions exist', async () => {
            const comparison = await getIncomeExpenseComparison();
            expect(comparison).toHaveLength(0);
        });
    });

    describe('getSalarySplit', () => {
        it('should return salary split by currency and funding account', async () => {
            const testData = await createTestData();

            const salarySplit = await getSalarySplit(testData.period.id);

            expect(salarySplit).toHaveProperty('usdSalaries');
            expect(salarySplit).toHaveProperty('pkrSalaries');
            expect(salarySplit).toHaveProperty('totalSalariesPkr');
            expect(salarySplit).toHaveProperty('fundingBreakdown');

            expect(typeof salarySplit.usdSalaries).toBe('number');
            expect(typeof salarySplit.pkrSalaries).toBe('number');
            expect(typeof salarySplit.totalSalariesPkr).toBe('number');
            expect(Array.isArray(salarySplit.fundingBreakdown)).toBe(true);

            if (salarySplit.fundingBreakdown.length > 0) {
                const breakdown = salarySplit.fundingBreakdown[0];
                expect(breakdown).toHaveProperty('accountName');
                expect(breakdown).toHaveProperty('amount');
                expect(breakdown).toHaveProperty('currency');
            }
        });

        it('should return zero values when no salary transactions exist', async () => {
            const salarySplit = await getSalarySplit();

            expect(salarySplit.usdSalaries).toEqual(0);
            expect(salarySplit.pkrSalaries).toEqual(0);
            expect(salarySplit.totalSalariesPkr).toEqual(0);
            expect(salarySplit.fundingBreakdown).toHaveLength(0);
        });
    });

    describe('getFxImpact', () => {
        it('should return FX impact summary', async () => {
            const testData = await createTestData();

            const fxImpact = await getFxImpact(testData.period.id);

            expect(fxImpact).toHaveProperty('realizedGainLoss');
            expect(fxImpact).toHaveProperty('unrealizedGainLoss');
            expect(fxImpact).toHaveProperty('totalFxImpact');

            expect(typeof fxImpact.realizedGainLoss).toBe('number');
            expect(typeof fxImpact.unrealizedGainLoss).toBe('number');
            expect(typeof fxImpact.totalFxImpact).toBe('number');

            expect(fxImpact.totalFxImpact).toEqual(fxImpact.realizedGainLoss + fxImpact.unrealizedGainLoss);
        });

        it('should return zero impact when no FX transactions exist', async () => {
            const fxImpact = await getFxImpact();

            expect(fxImpact.realizedGainLoss).toEqual(0);
            expect(fxImpact.unrealizedGainLoss).toEqual(0);
            expect(fxImpact.totalFxImpact).toEqual(0);
        });
    });

    describe('getPartnerSummary', () => {
        it('should return partner capital and P&L summary', async () => {
            await createTestData();

            const partnerSummary = await getPartnerSummary();

            expect(Array.isArray(partnerSummary)).toBe(true);
            expect(partnerSummary.length).toBeGreaterThan(0);

            const firstPartner = partnerSummary[0];
            expect(firstPartner).toHaveProperty('partnerId');
            expect(firstPartner).toHaveProperty('partnerName');
            expect(firstPartner).toHaveProperty('capitalBalance');
            expect(firstPartner).toHaveProperty('capitalBalancePkr');
            expect(firstPartner).toHaveProperty('plShare');
            expect(firstPartner).toHaveProperty('plSharePkr');

            expect(typeof firstPartner.partnerId).toBe('number');
            expect(typeof firstPartner.partnerName).toBe('string');
            expect(typeof firstPartner.capitalBalance).toBe('number');
            expect(typeof firstPartner.capitalBalancePkr).toBe('number');
            expect(typeof firstPartner.plShare).toBe('number');
            expect(typeof firstPartner.plSharePkr).toBe('number');
        });

        it('should return empty array when no partners exist', async () => {
            const partnerSummary = await getPartnerSummary();
            expect(partnerSummary).toHaveLength(0);
        });
    });

    describe('getCashRunway', () => {
        it('should calculate cash runway correctly', async () => {
            await createTestData();

            const runway = await getCashRunway();

            expect(runway).toHaveProperty('totalCashPkr');
            expect(runway).toHaveProperty('monthlyBurnRatePkr');
            expect(runway).toHaveProperty('runwayMonths');

            expect(typeof runway.totalCashPkr).toBe('number');
            expect(typeof runway.monthlyBurnRatePkr).toBe('number');
            expect(typeof runway.runwayMonths).toBe('number');

            expect(runway.totalCashPkr).toBeGreaterThan(0);
            expect(runway.monthlyBurnRatePkr).toBeGreaterThanOrEqual(0);
            expect(runway.runwayMonths).toBeGreaterThanOrEqual(0);
        });

        it('should return zero runway when no cash or expenses exist', async () => {
            const runway = await getCashRunway();

            expect(runway.totalCashPkr).toEqual(0);
            expect(runway.monthlyBurnRatePkr).toEqual(0);
            expect(runway.runwayMonths).toEqual(0);
        });
    });

    describe('getKPIs', () => {
        it('should return key performance indicators', async () => {
            const testData = await createTestData();

            const kpis = await getKPIs(testData.period.id);

            expect(kpis).toHaveProperty('grossRevenue');
            expect(kpis).toHaveProperty('netIncome');
            expect(kpis).toHaveProperty('operatingExpenses');
            expect(kpis).toHaveProperty('salaryExpenses');
            expect(kpis).toHaveProperty('effectiveFxRate');

            expect(typeof kpis.grossRevenue).toBe('number');
            expect(typeof kpis.netIncome).toBe('number');
            expect(typeof kpis.operatingExpenses).toBe('number');
            expect(typeof kpis.salaryExpenses).toBe('number');
            expect(typeof kpis.effectiveFxRate).toBe('number');

            expect(kpis.effectiveFxRate).toBeGreaterThan(0);
            expect(kpis.netIncome).toEqual(kpis.grossRevenue - kpis.operatingExpenses);
        });

        it('should return zero KPIs when no transactions exist', async () => {
            const kpis = await getKPIs();

            expect(kpis.grossRevenue).toEqual(0);
            expect(kpis.netIncome).toEqual(0);
            expect(kpis.operatingExpenses).toEqual(0);
            expect(kpis.salaryExpenses).toEqual(0);
            expect(kpis.effectiveFxRate).toBeGreaterThan(0); // Should have default FX rate
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully', async () => {
            // Test error handling by trying to use an invalid SQL query
            try {
                await db.execute(sql`SELECT * FROM nonexistent_table`);
                // If we reach here, the test should fail
                expect(true).toBe(false);
            } catch (error) {
                // This is expected - the query should fail
                expect(error).toBeDefined();
                expect(error instanceof Error).toBe(true);
            }
        });
    });

    describe('Integration tests', () => {
        it('should provide consistent data across all dashboard functions', async () => {
            const testData = await createTestData();

            // Get all dashboard data
            const [
                cashBalances,
                incomeExpense,
                salarySplit,
                fxImpact,
                partnerSummary,
                cashRunway,
                kpis
            ] = await Promise.all([
                getCashBalances(),
                getIncomeExpenseComparison(),
                getSalarySplit(testData.period.id),
                getFxImpact(testData.period.id),
                getPartnerSummary(),
                getCashRunway(),
                getKPIs(testData.period.id)
            ]);

            // Verify all functions return data
            expect(cashBalances.length).toBeGreaterThan(0);
            expect(incomeExpense.length).toBeGreaterThan(0);
            expect(partnerSummary.length).toBeGreaterThan(0);
            
            // Verify data consistency
            const totalCashFromBalances = cashBalances.reduce((sum, b) => sum + b.balance_pkr, 0);
            expect(cashRunway.totalCashPkr).toEqual(totalCashFromBalances);

            // Verify FX rate consistency
            expect(kpis.effectiveFxRate).toEqual(280);
        });
    });
});