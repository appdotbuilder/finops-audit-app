import { db } from '../db';
import { 
    accountsTable, 
    journalLinesTable, 
    journalsTable,
    partnersTable,
    employeesTable,
    periodsTable,
    capitalMovementsTable,
    fxRatesTable
} from '../db/schema';
import { 
    type DashboardBalance, 
    type DashboardIncomeExpense 
} from '../schema';
import { eq, and, sum, gte, lte, sql, between } from 'drizzle-orm';

// Helper function to get current FX rate
async function getCurrentFxRate(): Promise<number> {
    const latestFxRate = await db.select()
        .from(fxRatesTable)
        .orderBy(sql`${fxRatesTable.date} DESC`)
        .limit(1)
        .execute();
    
    return latestFxRate.length > 0 ? parseFloat(latestFxRate[0].usd_to_pkr_rate) : 280;
}

// Get cash and bank balances by currency
export async function getCashBalances(): Promise<DashboardBalance[]> {
    try {
        const currentFxRate = await getCurrentFxRate();

        // Get bank account balances by currency
        const bankBalances = await db.select({
            currency: accountsTable.currency,
            balance: sql<string>`COALESCE(SUM(${journalLinesTable.debit_amount_base} - ${journalLinesTable.credit_amount_base}), 0)`.as('balance')
        })
        .from(accountsTable)
        .leftJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .leftJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED')
        ))
        .where(eq(accountsTable.is_bank_account, true))
        .groupBy(accountsTable.currency)
        .execute();

        return bankBalances.map(balance => {
            const balanceAmount = parseFloat(balance.balance);
            const balancePkr = balance.currency === 'USD' 
                ? balanceAmount * currentFxRate 
                : balanceAmount;

            return {
                currency: balance.currency,
                balance: balanceAmount,
                balance_pkr: balancePkr
            };
        });
    } catch (error) {
        console.error('Failed to get cash balances:', error);
        throw error;
    }
}

// Get income vs expense comparison (MTD & YTD)
export async function getIncomeExpenseComparison(): Promise<DashboardIncomeExpense[]> {
    try {
        const currentFxRate = await getCurrentFxRate();
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const results: DashboardIncomeExpense[] = [];

        // MTD calculations
        const mtdData = await db.select({
            currency: accountsTable.currency,
            income: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'INCOME' THEN ${journalLinesTable.credit_amount_base} - ${journalLinesTable.debit_amount_base} ELSE 0 END), 0)`.as('income'),
            expense: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'EXPENSE' THEN ${journalLinesTable.debit_amount_base} - ${journalLinesTable.credit_amount_base} ELSE 0 END), 0)`.as('expense')
        })
        .from(accountsTable)
        .innerJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .innerJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED'),
            gte(journalsTable.transaction_date, startOfMonth.toISOString().split('T')[0])
        ))
        .groupBy(accountsTable.currency)
        .execute();

        // YTD calculations
        const ytdData = await db.select({
            currency: accountsTable.currency,
            income: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'INCOME' THEN ${journalLinesTable.credit_amount_base} - ${journalLinesTable.debit_amount_base} ELSE 0 END), 0)`.as('income'),
            expense: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'EXPENSE' THEN ${journalLinesTable.debit_amount_base} - ${journalLinesTable.credit_amount_base} ELSE 0 END), 0)`.as('expense')
        })
        .from(accountsTable)
        .innerJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .innerJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED'),
            gte(journalsTable.transaction_date, startOfYear.toISOString().split('T')[0])
        ))
        .groupBy(accountsTable.currency)
        .execute();

        // Process MTD data
        mtdData.forEach(data => {
            const income = parseFloat(data.income);
            const expense = parseFloat(data.expense);
            const net = income - expense;
            
            const incomePkr = data.currency === 'USD' ? income * currentFxRate : income;
            const expensePkr = data.currency === 'USD' ? expense * currentFxRate : expense;
            const netPkr = incomePkr - expensePkr;

            results.push({
                period_type: 'MTD',
                currency: data.currency,
                income,
                expense,
                net,
                income_pkr: incomePkr,
                expense_pkr: expensePkr,
                net_pkr: netPkr
            });
        });

        // Process YTD data
        ytdData.forEach(data => {
            const income = parseFloat(data.income);
            const expense = parseFloat(data.expense);
            const net = income - expense;
            
            const incomePkr = data.currency === 'USD' ? income * currentFxRate : income;
            const expensePkr = data.currency === 'USD' ? expense * currentFxRate : expense;
            const netPkr = incomePkr - expensePkr;

            results.push({
                period_type: 'YTD',
                currency: data.currency,
                income,
                expense,
                net,
                income_pkr: incomePkr,
                expense_pkr: expensePkr,
                net_pkr: netPkr
            });
        });

        return results;
    } catch (error) {
        console.error('Failed to get income/expense comparison:', error);
        throw error;
    }
}

// Get salary split by currency and funding account
export async function getSalarySplit(periodId?: number): Promise<{
    usdSalaries: number;
    pkrSalaries: number;
    totalSalariesPkr: number;
    fundingBreakdown: { accountName: string; amount: number; currency: string }[];
}> {
    try {
        const currentFxRate = await getCurrentFxRate();
        
        const baseQuery = db.select({
            currency: employeesTable.salary_currency,
            amount: sql<string>`COALESCE(SUM(${journalLinesTable.debit_amount_base}), 0)`.as('amount'),
            accountName: accountsTable.name,
            accountCurrency: accountsTable.currency
        })
        .from(employeesTable)
        .innerJoin(journalLinesTable, eq(employeesTable.id, journalLinesTable.employee_id))
        .innerJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED')
        ))
        .innerJoin(accountsTable, eq(employeesTable.funding_account_id, accountsTable.id))
        .groupBy(employeesTable.salary_currency, accountsTable.name, accountsTable.currency);

        const query = periodId 
            ? baseQuery.where(eq(journalsTable.period_id, periodId))
            : baseQuery;

        const results = await query.execute();

        let usdSalaries = 0;
        let pkrSalaries = 0;
        const fundingBreakdown: { accountName: string; amount: number; currency: string }[] = [];

        results.forEach(result => {
            const amount = parseFloat(result.amount);
            
            if (result.currency === 'USD') {
                usdSalaries += amount;
            } else {
                pkrSalaries += amount;
            }

            fundingBreakdown.push({
                accountName: result.accountName,
                amount,
                currency: result.accountCurrency
            });
        });

        const totalSalariesPkr = (usdSalaries * currentFxRate) + pkrSalaries;

        return {
            usdSalaries,
            pkrSalaries,
            totalSalariesPkr,
            fundingBreakdown
        };
    } catch (error) {
        console.error('Failed to get salary split:', error);
        throw error;
    }
}

// Get FX impact summary
export async function getFxImpact(periodId?: number): Promise<{
    realizedGainLoss: number;
    unrealizedGainLoss: number;
    totalFxImpact: number;
}> {
    try {
        // Get realized FX gains/losses from journal entries
        const baseRealizedQuery = db.select({
            amount: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount_base} - ${journalLinesTable.debit_amount_base}), 0)`.as('amount')
        })
        .from(accountsTable)
        .innerJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .innerJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED')
        ));

        const conditions = [sql`${accountsTable.name} ILIKE '%fx%' OR ${accountsTable.name} ILIKE '%exchange%'`];
        
        if (periodId) {
            conditions.push(eq(journalsTable.period_id, periodId));
        }

        const realizedQuery = baseRealizedQuery.where(and(...conditions));

        const realizedResults = await realizedQuery.execute();
        const realizedGainLoss = realizedResults.length > 0 ? parseFloat(realizedResults[0].amount) : 0;

        // For unrealized FX impact, we'd need to calculate the difference between
        // current FX rates and transaction FX rates for open positions
        // This is a simplified calculation
        const unrealizedGainLoss = 0; // Would need more complex calculation

        const totalFxImpact = realizedGainLoss + unrealizedGainLoss;

        return {
            realizedGainLoss,
            unrealizedGainLoss,
            totalFxImpact
        };
    } catch (error) {
        console.error('Failed to get FX impact:', error);
        throw error;
    }
}

// Get partner capital and P&L share
export async function getPartnerSummary(): Promise<{
    partnerId: number;
    partnerName: string;
    capitalBalance: number;
    capitalBalancePkr: number;
    plShare: number;
    plSharePkr: number;
}[]> {
    try {
        const currentFxRate = await getCurrentFxRate();

        // Get partner capital accounts balances
        const capitalBalances = await db.select({
            partnerId: partnersTable.id,
            partnerName: partnersTable.name,
            usdBalance: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.currency} = 'USD' THEN ${journalLinesTable.credit_amount_base} - ${journalLinesTable.debit_amount_base} ELSE 0 END), 0)`.as('usdBalance'),
            pkrBalance: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.currency} = 'PKR' THEN ${journalLinesTable.credit_amount_base} - ${journalLinesTable.debit_amount_base} ELSE 0 END), 0)`.as('pkrBalance')
        })
        .from(partnersTable)
        .leftJoin(accountsTable, and(
            eq(partnersTable.id, accountsTable.partner_id),
            eq(accountsTable.is_capital_account, true)
        ))
        .leftJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .leftJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED')
        ))
        .groupBy(partnersTable.id, partnersTable.name)
        .execute();

        return capitalBalances.map(partner => {
            const usdBalance = parseFloat(partner.usdBalance);
            const pkrBalance = parseFloat(partner.pkrBalance);
            const capitalBalance = usdBalance + pkrBalance;
            const capitalBalancePkr = (usdBalance * currentFxRate) + pkrBalance;

            // P&L share calculation would depend on partnership agreement
            // For now, assuming equal share among active partners
            const plShare = 0; // Would need specific business logic
            const plSharePkr = 0; // Would need specific business logic

            return {
                partnerId: partner.partnerId,
                partnerName: partner.partnerName,
                capitalBalance,
                capitalBalancePkr,
                plShare,
                plSharePkr
            };
        });
    } catch (error) {
        console.error('Failed to get partner summary:', error);
        throw error;
    }
}

// Calculate cash runway (months of expenses covered)
export async function getCashRunway(): Promise<{
    totalCashPkr: number;
    monthlyBurnRatePkr: number;
    runwayMonths: number;
}> {
    try {
        const currentFxRate = await getCurrentFxRate();

        // Get total cash balances
        const cashBalances = await getCashBalances();
        const totalCashPkr = cashBalances.reduce((sum, balance) => sum + balance.balance_pkr, 0);

        // Calculate average monthly burn rate (expenses) for the last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const expenseData = await db.select({
            totalExpenses: sql<string>`COALESCE(SUM(${journalLinesTable.debit_amount_base} - ${journalLinesTable.credit_amount_base}), 0)`.as('totalExpenses')
        })
        .from(accountsTable)
        .innerJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .innerJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED'),
            gte(journalsTable.transaction_date, threeMonthsAgo.toISOString().split('T')[0])
        ))
        .where(eq(accountsTable.account_type, 'EXPENSE'))
        .execute();

        const totalExpensesThreeMonths = expenseData.length > 0 ? parseFloat(expenseData[0].totalExpenses) : 0;
        const monthlyBurnRatePkr = totalExpensesThreeMonths / 3;

        const runwayMonths = monthlyBurnRatePkr > 0 ? totalCashPkr / monthlyBurnRatePkr : 0;

        return {
            totalCashPkr,
            monthlyBurnRatePkr,
            runwayMonths
        };
    } catch (error) {
        console.error('Failed to calculate cash runway:', error);
        throw error;
    }
}

// Get key performance indicators
export async function getKPIs(periodId?: number): Promise<{
    grossRevenue: number;
    netIncome: number;
    operatingExpenses: number;
    salaryExpenses: number;
    effectiveFxRate: number;
}> {
    try {
        const currentFxRate = await getCurrentFxRate();

        const baseQuery = db.select({
            accountType: accountsTable.account_type,
            totalAmount: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'INCOME' THEN ${journalLinesTable.credit_amount_base} - ${journalLinesTable.debit_amount_base} ELSE ${journalLinesTable.debit_amount_base} - ${journalLinesTable.credit_amount_base} END), 0)`.as('totalAmount')
        })
        .from(accountsTable)
        .innerJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
        .innerJoin(journalsTable, and(
            eq(journalLinesTable.journal_id, journalsTable.id),
            eq(journalsTable.status, 'POSTED')
        ))
        .groupBy(accountsTable.account_type);

        const query = periodId 
            ? baseQuery.where(eq(journalsTable.period_id, periodId))
            : baseQuery;

        const results = await query.execute();

        let grossRevenue = 0;
        let operatingExpenses = 0;

        results.forEach(result => {
            const amount = parseFloat(result.totalAmount);
            if (result.accountType === 'INCOME') {
                grossRevenue += amount;
            } else if (result.accountType === 'EXPENSE') {
                operatingExpenses += amount;
            }
        });

        const netIncome = grossRevenue - operatingExpenses;

        // Get salary expenses specifically
        const salaryData = await getSalarySplit(periodId);
        const salaryExpenses = salaryData.totalSalariesPkr;

        return {
            grossRevenue,
            netIncome,
            operatingExpenses,
            salaryExpenses,
            effectiveFxRate: currentFxRate
        };
    } catch (error) {
        console.error('Failed to get KPIs:', error);
        throw error;
    }
}