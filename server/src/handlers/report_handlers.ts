import { 
    type TrialBalanceInput, 
    type TrialBalanceLine, 
    type GeneralLedgerInput 
} from '../schema';
import { db } from '../db';
import { journalLinesTable, journalsTable, accountsTable } from '../db/schema';
import { eq, lte, and, sum, sql, type SQL } from 'drizzle-orm';

// Generate Trial Balance report
export async function generateTrialBalance(input: TrialBalanceInput): Promise<TrialBalanceLine[]> {
    try {
        // Build conditions array
        const conditions: SQL<unknown>[] = [
            lte(journalsTable.transaction_date, input.as_of_date.toISOString().split('T')[0]), // Convert Date to YYYY-MM-DD string
            eq(journalsTable.status, 'POSTED') // Only include posted journals
        ];

        // Add currency filter if specified
        if (input.currency) {
            conditions.push(eq(accountsTable.currency, input.currency));
        }

        // Build complete query in one chain
        const results = await db.select({
            account_id: journalLinesTable.account_id,
            account_code: accountsTable.code,
            account_name: accountsTable.name,
            account_type: accountsTable.account_type,
            currency: accountsTable.currency,
            total_debit: sum(journalLinesTable.debit_amount),
            total_credit: sum(journalLinesTable.credit_amount),
            total_debit_base: sum(journalLinesTable.debit_amount_base),
            total_credit_base: sum(journalLinesTable.credit_amount_base)
        })
        .from(journalLinesTable)
        .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
        .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .groupBy(
            journalLinesTable.account_id,
            accountsTable.code,
            accountsTable.name,
            accountsTable.account_type,
            accountsTable.currency
        )
        .orderBy(accountsTable.code)
        .execute();

        // Transform results to TrialBalanceLine format
        return results.map(result => {
            const totalDebit = parseFloat(result.total_debit || '0');
            const totalCredit = parseFloat(result.total_credit || '0');
            const totalDebitBase = parseFloat(result.total_debit_base || '0');
            const totalCreditBase = parseFloat(result.total_credit_base || '0');

            // Calculate net balances - debit balance is positive, credit balance is positive
            const netAmount = totalDebit - totalCredit;
            const netAmountBase = totalDebitBase - totalCreditBase;

            return {
                account_code: result.account_code,
                account_name: result.account_name,
                account_type: result.account_type,
                currency: result.currency,
                debit_balance: netAmount > 0 ? netAmount : 0,
                credit_balance: netAmount < 0 ? Math.abs(netAmount) : 0,
                debit_balance_base: netAmountBase > 0 ? netAmountBase : 0,
                credit_balance_base: netAmountBase < 0 ? Math.abs(netAmountBase) : 0
            };
        });

    } catch (error) {
        console.error('Trial balance generation failed:', error);
        throw error;
    }
}

// Generate General Ledger report
export async function generateGeneralLedger(input: GeneralLedgerInput): Promise<any[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating general ledger for specified accounts/date range.
    // Should include all journal line details with running balances.
    return [];
}

// Generate P&L Statement
export async function generateProfitAndLoss(
    fromDate: Date, 
    toDate: Date, 
    currency?: string
): Promise<any> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating P&L statement for the specified period.
    // Should group income and expense accounts with subtotals.
    return {};
}

// Generate Balance Sheet
export async function generateBalanceSheet(asOfDate: Date, currency?: string): Promise<any> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating balance sheet as of a specific date.
    // Should group assets, liabilities, and equity with totals.
    return {};
}

// Generate Capital Rollforward report
export async function generateCapitalRollforward(
    fromDate: Date, 
    toDate: Date, 
    partnerId?: number
): Promise<any> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating capital rollforward showing partner capital changes.
    return {};
}

// Generate Salary Register
export async function generateSalaryRegister(
    fromDate: Date, 
    toDate: Date, 
    currency?: string
): Promise<any[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating salary register showing employee payments.
    return [];
}

// Generate FX Summary report
export async function generateFxSummary(fromDate: Date, toDate: Date): Promise<any> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating FX summary showing realized/unrealized gains/losses.
    return {};
}

// Generate Audit Pack (comprehensive period-end package)
export async function generateAuditPack(periodId: number): Promise<{
    trialBalance: any;
    profitAndLoss: any;
    balanceSheet: any;
    capitalRollforward: any;
    generalLedger: any;
    fxSummary: any;
}> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is generating comprehensive audit pack for a closed period.
    // Should include all major reports and package them for download.
    return {
        trialBalance: {},
        profitAndLoss: {},
        balanceSheet: {},
        capitalRollforward: {},
        generalLedger: {},
        fxSummary: {}
    };
}