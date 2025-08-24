import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
    partnersTable, 
    usersTable, 
    accountsTable, 
    periodsTable, 
    journalsTable, 
    journalLinesTable 
} from '../db/schema';
import { type TrialBalanceInput } from '../schema';
import { generateTrialBalance } from '../handlers/report_handlers';

describe('generateTrialBalance', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should generate trial balance with basic account balances', async () => {
        // Create test partner
        const partner = await db.insert(partnersTable).values({
            name: 'Test Partner',
            email: 'partner@test.com',
            has_usd_account: true,
            has_pkr_account: true
        }).returning().execute();

        // Create test user
        const user = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'user@test.com',
            role: 'ADMIN',
            partner_id: partner[0].id
        }).returning().execute();

        // Create test accounts
        const accounts = await db.insert(accountsTable).values([
            {
                code: '1000',
                name: 'Cash USD',
                account_type: 'ASSET',
                currency: 'USD',
                is_bank_account: true
            },
            {
                code: '2000',
                name: 'Accounts Payable',
                account_type: 'LIABILITY',
                currency: 'USD'
            },
            {
                code: '3000',
                name: 'Partner Capital',
                account_type: 'EQUITY',
                currency: 'USD',
                is_capital_account: true
            }
        ]).returning().execute();

        // Create test period
        const period = await db.insert(periodsTable).values({
            year: 2024,
            month: 1,
            status: 'OPEN'
        }).returning().execute();

        // Create test journal
        const journal = await db.insert(journalsTable).values({
            reference: 'JE001',
            description: 'Test Entry',
            transaction_date: '2024-01-15',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        // Create journal lines
        await db.insert(journalLinesTable).values([
            {
                journal_id: journal[0].id,
                account_id: accounts[0].id, // Cash USD
                description: 'Cash received',
                debit_amount: '1000.00',
                credit_amount: '0.00',
                debit_amount_base: '280000.00', // Assuming 1 USD = 280 PKR
                credit_amount_base: '0.00',
                fx_rate: '280.0000'
            },
            {
                journal_id: journal[0].id,
                account_id: accounts[2].id, // Partner Capital
                description: 'Partner contribution',
                debit_amount: '0.00',
                credit_amount: '1000.00',
                debit_amount_base: '0.00',
                credit_amount_base: '280000.00',
                fx_rate: '280.0000'
            }
        ]).execute();

        const input: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31')
        };

        const result = await generateTrialBalance(input);

        expect(result).toHaveLength(2);
        
        // Check Cash account (should have debit balance)
        const cashAccount = result.find(r => r.account_code === '1000');
        expect(cashAccount).toBeDefined();
        expect(cashAccount!.account_name).toEqual('Cash USD');
        expect(cashAccount!.account_type).toEqual('ASSET');
        expect(cashAccount!.currency).toEqual('USD');
        expect(cashAccount!.debit_balance).toEqual(1000);
        expect(cashAccount!.credit_balance).toEqual(0);
        expect(cashAccount!.debit_balance_base).toEqual(280000);
        expect(cashAccount!.credit_balance_base).toEqual(0);

        // Check Partner Capital (should have credit balance)
        const capitalAccount = result.find(r => r.account_code === '3000');
        expect(capitalAccount).toBeDefined();
        expect(capitalAccount!.account_name).toEqual('Partner Capital');
        expect(capitalAccount!.account_type).toEqual('EQUITY');
        expect(capitalAccount!.currency).toEqual('USD');
        expect(capitalAccount!.debit_balance).toEqual(0);
        expect(capitalAccount!.credit_balance).toEqual(1000);
        expect(capitalAccount!.debit_balance_base).toEqual(0);
        expect(capitalAccount!.credit_balance_base).toEqual(280000);
    });

    it('should filter by currency when specified', async () => {
        // Create test user
        const user = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'user@test.com',
            role: 'ADMIN'
        }).returning().execute();

        // Create accounts in different currencies
        const accounts = await db.insert(accountsTable).values([
            {
                code: '1000',
                name: 'Cash USD',
                account_type: 'ASSET',
                currency: 'USD'
            },
            {
                code: '1100',
                name: 'Cash PKR',
                account_type: 'ASSET',
                currency: 'PKR'
            }
        ]).returning().execute();

        // Create test period
        const period = await db.insert(periodsTable).values({
            year: 2024,
            month: 1,
            status: 'OPEN'
        }).returning().execute();

        // Create test journal
        const journal = await db.insert(journalsTable).values({
            reference: 'JE001',
            description: 'Test Entry',
            transaction_date: '2024-01-15',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        // Create journal lines for both currencies
        await db.insert(journalLinesTable).values([
            {
                journal_id: journal[0].id,
                account_id: accounts[0].id, // Cash USD
                description: 'USD transaction',
                debit_amount: '100.00',
                credit_amount: '0.00',
                debit_amount_base: '28000.00',
                credit_amount_base: '0.00'
            },
            {
                journal_id: journal[0].id,
                account_id: accounts[1].id, // Cash PKR
                description: 'PKR transaction',
                debit_amount: '28000.00',
                credit_amount: '0.00',
                debit_amount_base: '28000.00',
                credit_amount_base: '0.00'
            }
        ]).execute();

        // Test filtering by USD currency
        const usdInput: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31'),
            currency: 'USD'
        };

        const usdResult = await generateTrialBalance(usdInput);
        expect(usdResult).toHaveLength(1);
        expect(usdResult[0].account_code).toEqual('1000');
        expect(usdResult[0].currency).toEqual('USD');

        // Test filtering by PKR currency
        const pkrInput: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31'),
            currency: 'PKR'
        };

        const pkrResult = await generateTrialBalance(pkrInput);
        expect(pkrResult).toHaveLength(1);
        expect(pkrResult[0].account_code).toEqual('1100');
        expect(pkrResult[0].currency).toEqual('PKR');
    });

    it('should only include posted journals', async () => {
        // Create test user
        const user = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'user@test.com',
            role: 'ADMIN'
        }).returning().execute();

        // Create test account
        const account = await db.insert(accountsTable).values({
            code: '1000',
            name: 'Cash',
            account_type: 'ASSET',
            currency: 'USD'
        }).returning().execute();

        // Create test period
        const period = await db.insert(periodsTable).values({
            year: 2024,
            month: 1,
            status: 'OPEN'
        }).returning().execute();

        // Create posted journal
        const postedJournal = await db.insert(journalsTable).values({
            reference: 'JE001',
            description: 'Posted Entry',
            transaction_date: '2024-01-15',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        // Create draft journal
        const draftJournal = await db.insert(journalsTable).values({
            reference: 'JE002',
            description: 'Draft Entry',
            transaction_date: '2024-01-15',
            period_id: period[0].id,
            status: 'DRAFT',
            created_by: user[0].id
        }).returning().execute();

        // Create journal lines for both journals
        await db.insert(journalLinesTable).values([
            {
                journal_id: postedJournal[0].id,
                account_id: account[0].id,
                description: 'Posted transaction',
                debit_amount: '100.00',
                credit_amount: '0.00',
                debit_amount_base: '100.00',
                credit_amount_base: '0.00'
            },
            {
                journal_id: draftJournal[0].id,
                account_id: account[0].id,
                description: 'Draft transaction',
                debit_amount: '50.00',
                credit_amount: '0.00',
                debit_amount_base: '50.00',
                credit_amount_base: '0.00'
            }
        ]).execute();

        const input: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31')
        };

        const result = await generateTrialBalance(input);

        expect(result).toHaveLength(1);
        // Should only include the posted journal amount (100), not draft (50)
        expect(result[0].debit_balance).toEqual(100);
        expect(result[0].credit_balance).toEqual(0);
    });

    it('should respect the as_of_date filter', async () => {
        // Create test user
        const user = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'user@test.com',
            role: 'ADMIN'
        }).returning().execute();

        // Create test account
        const account = await db.insert(accountsTable).values({
            code: '1000',
            name: 'Cash',
            account_type: 'ASSET',
            currency: 'USD'
        }).returning().execute();

        // Create test period
        const period = await db.insert(periodsTable).values({
            year: 2024,
            month: 1,
            status: 'OPEN'
        }).returning().execute();

        // Create journals with different dates
        const earlyJournal = await db.insert(journalsTable).values({
            reference: 'JE001',
            description: 'Early Entry',
            transaction_date: '2024-01-10',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        const lateJournal = await db.insert(journalsTable).values({
            reference: 'JE002',
            description: 'Late Entry',
            transaction_date: '2024-01-25',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        // Create journal lines
        await db.insert(journalLinesTable).values([
            {
                journal_id: earlyJournal[0].id,
                account_id: account[0].id,
                description: 'Early transaction',
                debit_amount: '100.00',
                credit_amount: '0.00',
                debit_amount_base: '100.00',
                credit_amount_base: '0.00'
            },
            {
                journal_id: lateJournal[0].id,
                account_id: account[0].id,
                description: 'Late transaction',
                debit_amount: '200.00',
                credit_amount: '0.00',
                debit_amount_base: '200.00',
                credit_amount_base: '0.00'
            }
        ]).execute();

        // Test with as_of_date before late journal
        const earlyInput: TrialBalanceInput = {
            as_of_date: new Date('2024-01-15')
        };

        const earlyResult = await generateTrialBalance(earlyInput);
        expect(earlyResult).toHaveLength(1);
        expect(earlyResult[0].debit_balance).toEqual(100); // Only early journal

        // Test with as_of_date after all journals
        const lateInput: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31')
        };

        const lateResult = await generateTrialBalance(lateInput);
        expect(lateResult).toHaveLength(1);
        expect(lateResult[0].debit_balance).toEqual(300); // Both journals
    });

    it('should return empty array when no qualifying transactions exist', async () => {
        const input: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31')
        };

        const result = await generateTrialBalance(input);
        expect(result).toHaveLength(0);
    });

    it('should handle mixed debit and credit transactions correctly', async () => {
        // Create test user
        const user = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'user@test.com',
            role: 'ADMIN'
        }).returning().execute();

        // Create test account
        const account = await db.insert(accountsTable).values({
            code: '1000',
            name: 'Cash',
            account_type: 'ASSET',
            currency: 'USD'
        }).returning().execute();

        // Create test period
        const period = await db.insert(periodsTable).values({
            year: 2024,
            month: 1,
            status: 'OPEN'
        }).returning().execute();

        // Create test journal
        const journal = await db.insert(journalsTable).values({
            reference: 'JE001',
            description: 'Mixed Entry',
            transaction_date: '2024-01-15',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        // Create journal lines with mixed debits and credits
        await db.insert(journalLinesTable).values([
            {
                journal_id: journal[0].id,
                account_id: account[0].id,
                description: 'Debit transaction',
                debit_amount: '500.00',
                credit_amount: '0.00',
                debit_amount_base: '500.00',
                credit_amount_base: '0.00'
            },
            {
                journal_id: journal[0].id,
                account_id: account[0].id,
                description: 'Credit transaction',
                debit_amount: '0.00',
                credit_amount: '200.00',
                debit_amount_base: '0.00',
                credit_amount_base: '200.00'
            }
        ]).execute();

        const input: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31')
        };

        const result = await generateTrialBalance(input);

        expect(result).toHaveLength(1);
        // Net should be 500 - 200 = 300 debit balance
        expect(result[0].debit_balance).toEqual(300);
        expect(result[0].credit_balance).toEqual(0);
        expect(result[0].debit_balance_base).toEqual(300);
        expect(result[0].credit_balance_base).toEqual(0);
    });

    it('should handle credit balance correctly', async () => {
        // Create test user
        const user = await db.insert(usersTable).values({
            name: 'Test User',
            email: 'user@test.com',
            role: 'ADMIN'
        }).returning().execute();

        // Create test account
        const account = await db.insert(accountsTable).values({
            code: '2000',
            name: 'Accounts Payable',
            account_type: 'LIABILITY',
            currency: 'USD'
        }).returning().execute();

        // Create test period
        const period = await db.insert(periodsTable).values({
            year: 2024,
            month: 1,
            status: 'OPEN'
        }).returning().execute();

        // Create test journal
        const journal = await db.insert(journalsTable).values({
            reference: 'JE001',
            description: 'Credit Entry',
            transaction_date: '2024-01-15',
            period_id: period[0].id,
            status: 'POSTED',
            created_by: user[0].id,
            posted_by: user[0].id,
            posted_at: new Date()
        }).returning().execute();

        // Create journal line with net credit balance
        await db.insert(journalLinesTable).values([
            {
                journal_id: journal[0].id,
                account_id: account[0].id,
                description: 'Credit transaction',
                debit_amount: '100.00',
                credit_amount: '300.00',
                debit_amount_base: '100.00',
                credit_amount_base: '300.00'
            }
        ]).execute();

        const input: TrialBalanceInput = {
            as_of_date: new Date('2024-01-31')
        };

        const result = await generateTrialBalance(input);

        expect(result).toHaveLength(1);
        // Net should be 100 - 300 = -200, so credit balance of 200
        expect(result[0].debit_balance).toEqual(0);
        expect(result[0].credit_balance).toEqual(200);
        expect(result[0].debit_balance_base).toEqual(0);
        expect(result[0].credit_balance_base).toEqual(200);
    });
});