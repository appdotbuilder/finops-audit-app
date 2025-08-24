import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
    partnersTable, 
    usersTable, 
    accountsTable, 
    employeesTable, 
    periodsTable, 
    journalsTable, 
    journalLinesTable 
} from '../db/schema';
import { 
    type CreateJournalInput, 
    type PostJournalInput, 
    type CreateJournalLineInput 
} from '../schema';
import {
    createJournal,
    addJournalLine,
    getJournal,
    getJournals,
    postJournal,
    validateJournal,
    deleteJournalLine
} from '../handlers/journal_handlers';
import { eq } from 'drizzle-orm';

describe('Journal Handlers', () => {
    let testUserId: number;
    let testPartnerId: number;
    let testAccountId: number;
    let testEmployeeId: number;
    let testPeriodId: number;

    beforeEach(async () => {
        await createDB();

        // Create test user
        const userResult = await db.insert(usersTable)
            .values({
                email: 'test@example.com',
                name: 'Test User',
                role: 'FINANCE'
            })
            .returning()
            .execute();
        testUserId = userResult[0].id;

        // Create test partner
        const partnerResult = await db.insert(partnersTable)
            .values({
                name: 'Test Partner',
                email: 'partner@example.com',
                has_usd_account: true,
                has_pkr_account: true
            })
            .returning()
            .execute();
        testPartnerId = partnerResult[0].id;

        // Create test account
        const accountResult = await db.insert(accountsTable)
            .values({
                code: '1000',
                name: 'Test Cash Account',
                account_type: 'ASSET',
                currency: 'USD'
            })
            .returning()
            .execute();
        testAccountId = accountResult[0].id;

        // Create test employee
        const employeeResult = await db.insert(employeesTable)
            .values({
                name: 'Test Employee',
                email: 'employee@example.com',
                salary_currency: 'USD',
                funding_account_id: testAccountId
            })
            .returning()
            .execute();
        testEmployeeId = employeeResult[0].id;

        // Create test period
        const periodResult = await db.insert(periodsTable)
            .values({
                year: 2024,
                month: 1,
                status: 'OPEN'
            })
            .returning()
            .execute();
        testPeriodId = periodResult[0].id;
    });

    afterEach(resetDB);

    describe('createJournal', () => {
        const testInput: CreateJournalInput = {
            reference: 'JE-001',
            description: 'Test Journal Entry',
            transaction_date: new Date('2024-01-15'),
            period_id: 0, // Will be set in test
            created_by: 0  // Will be set in test
        };

        it('should create a journal entry', async () => {
            const input = { ...testInput, period_id: testPeriodId, created_by: testUserId };
            const result = await createJournal(input);

            expect(result.reference).toEqual('JE-001');
            expect(result.description).toEqual('Test Journal Entry');
            expect(result.transaction_date).toEqual(new Date('2024-01-15'));
            expect(result.period_id).toEqual(testPeriodId);
            expect(result.status).toEqual('DRAFT');
            expect(result.created_by).toEqual(testUserId);
            expect(result.posted_at).toBeNull();
            expect(result.posted_by).toBeNull();
            expect(result.id).toBeDefined();
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('should save journal to database', async () => {
            const input = { ...testInput, period_id: testPeriodId, created_by: testUserId };
            const result = await createJournal(input);

            const journals = await db.select()
                .from(journalsTable)
                .where(eq(journalsTable.id, result.id))
                .execute();

            expect(journals).toHaveLength(1);
            expect(journals[0].reference).toEqual('JE-001');
            expect(journals[0].status).toEqual('DRAFT');
        });

        it('should reject journal for non-existent period', async () => {
            const input = { ...testInput, period_id: 99999, created_by: testUserId };
            
            expect(createJournal(input)).rejects.toThrow(/period not found/i);
        });

        it('should reject journal for locked period', async () => {
            // Lock the period
            await db.update(periodsTable)
                .set({ status: 'LOCKED', locked_by: testUserId, locked_at: new Date() })
                .where(eq(periodsTable.id, testPeriodId))
                .execute();

            const input = { ...testInput, period_id: testPeriodId, created_by: testUserId };
            
            expect(createJournal(input)).rejects.toThrow(/locked period/i);
        });

        it('should reject journal for non-existent user', async () => {
            const input = { ...testInput, period_id: testPeriodId, created_by: 99999 };
            
            expect(createJournal(input)).rejects.toThrow(/user not found/i);
        });
    });

    describe('addJournalLine', () => {
        let testJournalId: number;

        beforeEach(async () => {
            const journalResult = await db.insert(journalsTable)
                .values({
                    reference: 'JE-001',
                    description: 'Test Journal',
                    transaction_date: '2024-01-15',
                    period_id: testPeriodId,
                    created_by: testUserId
                })
                .returning()
                .execute();
            testJournalId = journalResult[0].id;
        });

        const testInput: CreateJournalLineInput = {
            journal_id: 0, // Will be set in test
            account_id: 0, // Will be set in test
            description: 'Test debit entry',
            debit_amount: 1000.50,
            credit_amount: 0,
            debit_amount_base: 1000.50,
            credit_amount_base: 0
        };

        it('should add journal line', async () => {
            const input = { ...testInput, journal_id: testJournalId, account_id: testAccountId };
            const result = await addJournalLine(input);

            expect(result.journal_id).toEqual(testJournalId);
            expect(result.account_id).toEqual(testAccountId);
            expect(result.description).toEqual('Test debit entry');
            expect(result.debit_amount).toEqual(1000.50);
            expect(result.credit_amount).toEqual(0);
            expect(result.debit_amount_base).toEqual(1000.50);
            expect(result.credit_amount_base).toEqual(0);
            expect(typeof result.debit_amount).toEqual('number');
            expect(result.fx_rate).toBeNull();
            expect(result.partner_id).toBeNull();
            expect(result.employee_id).toBeNull();
            expect(result.id).toBeDefined();
            expect(result.created_at).toBeInstanceOf(Date);
        });

        it('should add journal line with foreign exchange rate', async () => {
            const input = { 
                ...testInput, 
                journal_id: testJournalId, 
                account_id: testAccountId,
                fx_rate: 278.50,
                debit_amount_base: 278500.00
            };
            const result = await addJournalLine(input);

            expect(result.fx_rate).toEqual(278.50);
            expect(typeof result.fx_rate).toEqual('number');
            expect(result.debit_amount_base).toEqual(278500.00);
        });

        it('should add journal line with partner', async () => {
            const input = { 
                ...testInput, 
                journal_id: testJournalId, 
                account_id: testAccountId,
                partner_id: testPartnerId
            };
            const result = await addJournalLine(input);

            expect(result.partner_id).toEqual(testPartnerId);
        });

        it('should add journal line with employee', async () => {
            const input = { 
                ...testInput, 
                journal_id: testJournalId, 
                account_id: testAccountId,
                employee_id: testEmployeeId
            };
            const result = await addJournalLine(input);

            expect(result.employee_id).toEqual(testEmployeeId);
        });

        it('should save journal line to database', async () => {
            const input = { ...testInput, journal_id: testJournalId, account_id: testAccountId };
            const result = await addJournalLine(input);

            const lines = await db.select()
                .from(journalLinesTable)
                .where(eq(journalLinesTable.id, result.id))
                .execute();

            expect(lines).toHaveLength(1);
            expect(parseFloat(lines[0].debit_amount)).toEqual(1000.50);
            expect(parseFloat(lines[0].credit_amount)).toEqual(0);
        });

        it('should reject line for non-existent journal', async () => {
            const input = { ...testInput, journal_id: 99999, account_id: testAccountId };
            
            expect(addJournalLine(input)).rejects.toThrow(/journal not found/i);
        });

        it('should reject line for posted journal', async () => {
            // Post the journal
            await db.update(journalsTable)
                .set({ status: 'POSTED', posted_by: testUserId, posted_at: new Date() })
                .where(eq(journalsTable.id, testJournalId))
                .execute();

            const input = { ...testInput, journal_id: testJournalId, account_id: testAccountId };
            
            expect(addJournalLine(input)).rejects.toThrow(/posted journal/i);
        });

        it('should reject line for non-existent account', async () => {
            const input = { ...testInput, journal_id: testJournalId, account_id: 99999 };
            
            expect(addJournalLine(input)).rejects.toThrow(/account not found/i);
        });

        it('should reject line for non-existent partner', async () => {
            const input = { ...testInput, journal_id: testJournalId, account_id: testAccountId, partner_id: 99999 };
            
            expect(addJournalLine(input)).rejects.toThrow(/partner not found/i);
        });

        it('should reject line for non-existent employee', async () => {
            const input = { ...testInput, journal_id: testJournalId, account_id: testAccountId, employee_id: 99999 };
            
            expect(addJournalLine(input)).rejects.toThrow(/employee not found/i);
        });
    });

    describe('getJournal', () => {
        let testJournalId: number;

        beforeEach(async () => {
            const journalResult = await db.insert(journalsTable)
                .values({
                    reference: 'JE-001',
                    description: 'Test Journal',
                    transaction_date: '2024-01-15',
                    period_id: testPeriodId,
                    created_by: testUserId
                })
                .returning()
                .execute();
            testJournalId = journalResult[0].id;

            // Add some journal lines
            await db.insert(journalLinesTable)
                .values([
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Debit line',
                        debit_amount: '1000.00',
                        credit_amount: '0.00',
                        debit_amount_base: '1000.00',
                        credit_amount_base: '0.00'
                    },
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Credit line',
                        debit_amount: '0.00',
                        credit_amount: '1000.00',
                        debit_amount_base: '0.00',
                        credit_amount_base: '1000.00'
                    }
                ])
                .execute();
        });

        it('should get journal with lines', async () => {
            const result = await getJournal(testJournalId);

            expect(result).not.toBeNull();
            expect(result!.id).toEqual(testJournalId);
            expect(result!.reference).toEqual('JE-001');
            expect(result!.description).toEqual('Test Journal');
            expect(result!.lines).toHaveLength(2);
            
            // Check numeric conversion in lines
            expect(typeof result!.lines[0].debit_amount).toEqual('number');
            expect(typeof result!.lines[0].credit_amount).toEqual('number');
            expect(result!.lines[0].debit_amount).toEqual(1000);
            expect(result!.lines[1].credit_amount).toEqual(1000);
        });

        it('should return null for non-existent journal', async () => {
            const result = await getJournal(99999);
            expect(result).toBeNull();
        });
    });

    describe('getJournals', () => {
        beforeEach(async () => {
            // Create multiple journals for filtering tests
            await db.insert(journalsTable)
                .values([
                    {
                        reference: 'JE-001',
                        description: 'Draft Journal',
                        transaction_date: '2024-01-15',
                        period_id: testPeriodId,
                        status: 'DRAFT',
                        created_by: testUserId
                    },
                    {
                        reference: 'JE-002',
                        description: 'Posted Journal',
                        transaction_date: '2024-01-20',
                        period_id: testPeriodId,
                        status: 'POSTED',
                        posted_by: testUserId,
                        posted_at: new Date(),
                        created_by: testUserId
                    }
                ])
                .execute();
        });

        it('should get all journals without filters', async () => {
            const result = await getJournals();
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('should filter journals by period', async () => {
            const result = await getJournals({ periodId: testPeriodId });
            expect(result).toHaveLength(2);
            result.forEach(journal => {
                expect(journal.period_id).toEqual(testPeriodId);
            });
        });

        it('should filter journals by status', async () => {
            const result = await getJournals({ status: 'DRAFT' });
            expect(result.length).toBeGreaterThanOrEqual(1);
            result.forEach(journal => {
                expect(journal.status).toEqual('DRAFT');
            });
        });

        it('should filter journals by date range', async () => {
            const result = await getJournals({ 
                fromDate: new Date('2024-01-01'), 
                toDate: new Date('2024-01-31') 
            });
            expect(result.length).toBeGreaterThanOrEqual(2);
        });

        it('should filter journals by multiple criteria', async () => {
            const result = await getJournals({ 
                periodId: testPeriodId,
                status: 'POSTED',
                fromDate: new Date('2024-01-01'),
                toDate: new Date('2024-01-31')
            });
            expect(result.length).toBeGreaterThanOrEqual(1);
            result.forEach(journal => {
                expect(journal.period_id).toEqual(testPeriodId);
                expect(journal.status).toEqual('POSTED');
            });
        });
    });

    describe('validateJournal', () => {
        let testJournalId: number;

        beforeEach(async () => {
            const journalResult = await db.insert(journalsTable)
                .values({
                    reference: 'JE-001',
                    description: 'Test Journal',
                    transaction_date: '2024-01-15',
                    period_id: testPeriodId,
                    created_by: testUserId
                })
                .returning()
                .execute();
            testJournalId = journalResult[0].id;
        });

        it('should validate balanced journal', async () => {
            // Add balanced lines
            await db.insert(journalLinesTable)
                .values([
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Debit line',
                        debit_amount: '1000.00',
                        credit_amount: '0.00',
                        debit_amount_base: '1000.00',
                        credit_amount_base: '0.00'
                    },
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Credit line',
                        debit_amount: '0.00',
                        credit_amount: '1000.00',
                        debit_amount_base: '0.00',
                        credit_amount_base: '1000.00'
                    }
                ])
                .execute();

            const result = await validateJournal(testJournalId);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject journal with no lines', async () => {
            const result = await validateJournal(testJournalId);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Journal has no lines');
        });

        it('should reject unbalanced journal', async () => {
            // Add unbalanced lines
            await db.insert(journalLinesTable)
                .values([
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Debit line',
                        debit_amount: '1000.00',
                        credit_amount: '0.00',
                        debit_amount_base: '1000.00',
                        credit_amount_base: '0.00'
                    },
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Credit line',
                        debit_amount: '0.00',
                        credit_amount: '500.00',
                        debit_amount_base: '0.00',
                        credit_amount_base: '500.00'
                    }
                ])
                .execute();

            const result = await validateJournal(testJournalId);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('do not equal'))).toBe(true);
        });

        it('should reject line with both debit and credit', async () => {
            await db.insert(journalLinesTable)
                .values({
                    journal_id: testJournalId,
                    account_id: testAccountId,
                    description: 'Invalid line',
                    debit_amount: '500.00',
                    credit_amount: '500.00',
                    debit_amount_base: '500.00',
                    credit_amount_base: '500.00'
                })
                .execute();

            const result = await validateJournal(testJournalId);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('both debit and credit'))).toBe(true);
        });

        it('should reject line with neither debit nor credit', async () => {
            await db.insert(journalLinesTable)
                .values({
                    journal_id: testJournalId,
                    account_id: testAccountId,
                    description: 'Invalid line',
                    debit_amount: '0.00',
                    credit_amount: '0.00',
                    debit_amount_base: '0.00',
                    credit_amount_base: '0.00'
                })
                .execute();

            const result = await validateJournal(testJournalId);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('either debit or credit'))).toBe(true);
        });
    });

    describe('postJournal', () => {
        let testJournalId: number;

        beforeEach(async () => {
            const journalResult = await db.insert(journalsTable)
                .values({
                    reference: 'JE-001',
                    description: 'Test Journal',
                    transaction_date: '2024-01-15',
                    period_id: testPeriodId,
                    created_by: testUserId
                })
                .returning()
                .execute();
            testJournalId = journalResult[0].id;

            // Add balanced lines
            await db.insert(journalLinesTable)
                .values([
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Debit line',
                        debit_amount: '1000.00',
                        credit_amount: '0.00',
                        debit_amount_base: '1000.00',
                        credit_amount_base: '0.00'
                    },
                    {
                        journal_id: testJournalId,
                        account_id: testAccountId,
                        description: 'Credit line',
                        debit_amount: '0.00',
                        credit_amount: '1000.00',
                        debit_amount_base: '0.00',
                        credit_amount_base: '1000.00'
                    }
                ])
                .execute();
        });

        const testInput: PostJournalInput = {
            id: 0, // Will be set in test
            posted_by: 0 // Will be set in test
        };

        it('should post valid journal', async () => {
            const input = { ...testInput, id: testJournalId, posted_by: testUserId };
            const result = await postJournal(input);

            expect(result.id).toEqual(testJournalId);
            expect(result.status).toEqual('POSTED');
            expect(result.posted_by).toEqual(testUserId);
            expect(result.posted_at).toBeInstanceOf(Date);
        });

        it('should save posted status to database', async () => {
            const input = { ...testInput, id: testJournalId, posted_by: testUserId };
            await postJournal(input);

            const journals = await db.select()
                .from(journalsTable)
                .where(eq(journalsTable.id, testJournalId))
                .execute();

            expect(journals[0].status).toEqual('POSTED');
            expect(journals[0].posted_by).toEqual(testUserId);
            expect(journals[0].posted_at).toBeInstanceOf(Date);
        });

        it('should reject posting non-existent journal', async () => {
            const input = { ...testInput, id: 99999, posted_by: testUserId };
            
            expect(postJournal(input)).rejects.toThrow(/journal not found/i);
        });

        it('should reject posting already posted journal', async () => {
            // Post the journal first
            await db.update(journalsTable)
                .set({ status: 'POSTED', posted_by: testUserId, posted_at: new Date() })
                .where(eq(journalsTable.id, testJournalId))
                .execute();

            const input = { ...testInput, id: testJournalId, posted_by: testUserId };
            
            expect(postJournal(input)).rejects.toThrow(/already posted/i);
        });

        it('should reject posting journal in locked period', async () => {
            // Lock the period
            await db.update(periodsTable)
                .set({ status: 'LOCKED', locked_by: testUserId, locked_at: new Date() })
                .where(eq(periodsTable.id, testPeriodId))
                .execute();

            const input = { ...testInput, id: testJournalId, posted_by: testUserId };
            
            expect(postJournal(input)).rejects.toThrow(/locked period/i);
        });

        it('should reject posting invalid journal', async () => {
            // Remove one line to make journal unbalanced
            await db.delete(journalLinesTable)
                .where(eq(journalLinesTable.journal_id, testJournalId))
                .execute();

            await db.insert(journalLinesTable)
                .values({
                    journal_id: testJournalId,
                    account_id: testAccountId,
                    description: 'Unbalanced line',
                    debit_amount: '1000.00',
                    credit_amount: '0.00',
                    debit_amount_base: '1000.00',
                    credit_amount_base: '0.00'
                })
                .execute();

            const input = { ...testInput, id: testJournalId, posted_by: testUserId };
            
            expect(postJournal(input)).rejects.toThrow(/validation failed/i);
        });

        it('should reject posting by non-existent user', async () => {
            const input = { ...testInput, id: testJournalId, posted_by: 99999 };
            
            expect(postJournal(input)).rejects.toThrow(/user not found/i);
        });
    });

    describe('deleteJournalLine', () => {
        let testJournalId: number;
        let testLineId: number;

        beforeEach(async () => {
            const journalResult = await db.insert(journalsTable)
                .values({
                    reference: 'JE-001',
                    description: 'Test Journal',
                    transaction_date: '2024-01-15',
                    period_id: testPeriodId,
                    created_by: testUserId
                })
                .returning()
                .execute();
            testJournalId = journalResult[0].id;

            const lineResult = await db.insert(journalLinesTable)
                .values({
                    journal_id: testJournalId,
                    account_id: testAccountId,
                    description: 'Test line',
                    debit_amount: '1000.00',
                    credit_amount: '0.00',
                    debit_amount_base: '1000.00',
                    credit_amount_base: '0.00'
                })
                .returning()
                .execute();
            testLineId = lineResult[0].id;
        });

        it('should delete journal line', async () => {
            const result = await deleteJournalLine(testLineId);
            expect(result).toBe(true);

            // Verify line is deleted
            const lines = await db.select()
                .from(journalLinesTable)
                .where(eq(journalLinesTable.id, testLineId))
                .execute();

            expect(lines).toHaveLength(0);
        });

        it('should reject deleting non-existent line', async () => {
            expect(deleteJournalLine(99999)).rejects.toThrow(/line not found/i);
        });

        it('should reject deleting line from posted journal', async () => {
            // Post the journal
            await db.update(journalsTable)
                .set({ status: 'POSTED', posted_by: testUserId, posted_at: new Date() })
                .where(eq(journalsTable.id, testJournalId))
                .execute();

            expect(deleteJournalLine(testLineId)).rejects.toThrow(/posted journal/i);
        });
    });
});