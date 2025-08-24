import { db } from '../db';
import { 
    journalsTable, 
    journalLinesTable, 
    periodsTable, 
    accountsTable,
    usersTable,
    partnersTable,
    employeesTable
} from '../db/schema';
import { 
    type CreateJournalInput, 
    type PostJournalInput, 
    type Journal, 
    type CreateJournalLineInput, 
    type JournalLine 
} from '../schema';
import { eq, and, gte, lte, between, SQL } from 'drizzle-orm';

// Create a new journal entry
export async function createJournal(input: CreateJournalInput): Promise<Journal> {
    try {
        // Validate that the period exists and is open
        const period = await db.select()
            .from(periodsTable)
            .where(eq(periodsTable.id, input.period_id))
            .execute();

        if (period.length === 0) {
            throw new Error('Period not found');
        }

        if (period[0].status === 'LOCKED') {
            throw new Error('Cannot create journal in locked period');
        }

        // Validate that the user exists
        const user = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, input.created_by))
            .execute();

        if (user.length === 0) {
            throw new Error('User not found');
        }

        // Insert journal record
        const result = await db.insert(journalsTable)
            .values({
                reference: input.reference,
                description: input.description,
                transaction_date: input.transaction_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
                period_id: input.period_id,
                status: 'DRAFT',
                created_by: input.created_by
            })
            .returning()
            .execute();

        // Convert date string back to Date object
        const journal = result[0];
        return {
            ...journal,
            transaction_date: new Date(journal.transaction_date + 'T00:00:00.000Z')
        };
    } catch (error) {
        console.error('Journal creation failed:', error);
        throw error;
    }
}

// Add journal line to a journal
export async function addJournalLine(input: CreateJournalLineInput): Promise<JournalLine> {
    try {
        // Validate that the journal exists and is in draft status
        const journal = await db.select()
            .from(journalsTable)
            .where(eq(journalsTable.id, input.journal_id))
            .execute();

        if (journal.length === 0) {
            throw new Error('Journal not found');
        }

        if (journal[0].status === 'POSTED') {
            throw new Error('Cannot modify posted journal');
        }

        // Validate that the account exists
        const account = await db.select()
            .from(accountsTable)
            .where(eq(accountsTable.id, input.account_id))
            .execute();

        if (account.length === 0) {
            throw new Error('Account not found');
        }

        // Validate partner if provided
        if (input.partner_id) {
            const partner = await db.select()
                .from(partnersTable)
                .where(eq(partnersTable.id, input.partner_id))
                .execute();

            if (partner.length === 0) {
                throw new Error('Partner not found');
            }
        }

        // Validate employee if provided
        if (input.employee_id) {
            const employee = await db.select()
                .from(employeesTable)
                .where(eq(employeesTable.id, input.employee_id))
                .execute();

            if (employee.length === 0) {
                throw new Error('Employee not found');
            }
        }

        // Insert journal line record
        const result = await db.insert(journalLinesTable)
            .values({
                journal_id: input.journal_id,
                account_id: input.account_id,
                description: input.description,
                debit_amount: input.debit_amount.toString(),
                credit_amount: input.credit_amount.toString(),
                debit_amount_base: input.debit_amount_base.toString(),
                credit_amount_base: input.credit_amount_base.toString(),
                fx_rate: input.fx_rate ? input.fx_rate.toString() : null,
                partner_id: input.partner_id || null,
                employee_id: input.employee_id || null
            })
            .returning()
            .execute();

        // Convert numeric fields back to numbers
        const journalLine = result[0];
        return {
            ...journalLine,
            debit_amount: parseFloat(journalLine.debit_amount),
            credit_amount: parseFloat(journalLine.credit_amount),
            debit_amount_base: parseFloat(journalLine.debit_amount_base),
            credit_amount_base: parseFloat(journalLine.credit_amount_base),
            fx_rate: journalLine.fx_rate ? parseFloat(journalLine.fx_rate) : null
        };
    } catch (error) {
        console.error('Journal line creation failed:', error);
        throw error;
    }
}

// Get journal by ID with lines
export async function getJournal(id: number): Promise<(Journal & { lines: JournalLine[] }) | null> {
    try {
        // Get the journal
        const journals = await db.select()
            .from(journalsTable)
            .where(eq(journalsTable.id, id))
            .execute();

        if (journals.length === 0) {
            return null;
        }

        // Get journal lines
        const lines = await db.select()
            .from(journalLinesTable)
            .where(eq(journalLinesTable.journal_id, id))
            .execute();

        // Convert numeric fields in lines
        const convertedLines: JournalLine[] = lines.map(line => ({
            ...line,
            debit_amount: parseFloat(line.debit_amount),
            credit_amount: parseFloat(line.credit_amount),
            debit_amount_base: parseFloat(line.debit_amount_base),
            credit_amount_base: parseFloat(line.credit_amount_base),
            fx_rate: line.fx_rate ? parseFloat(line.fx_rate) : null
        }));

        // Convert journal date string to Date object
        const journal = journals[0];
        return {
            ...journal,
            transaction_date: new Date(journal.transaction_date + 'T00:00:00.000Z'),
            lines: convertedLines
        };
    } catch (error) {
        console.error('Get journal failed:', error);
        throw error;
    }
}

// Get all journals with optional filtering
export async function getJournals(filters?: {
    periodId?: number;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
}): Promise<Journal[]> {
    try {
        const conditions: SQL<unknown>[] = [];

        if (filters?.periodId !== undefined) {
            conditions.push(eq(journalsTable.period_id, filters.periodId));
        }

        if (filters?.status) {
            conditions.push(eq(journalsTable.status, filters.status as any));
        }

        if (filters?.fromDate) {
            conditions.push(gte(journalsTable.transaction_date, filters.fromDate.toISOString().split('T')[0]));
        }

        if (filters?.toDate) {
            conditions.push(lte(journalsTable.transaction_date, filters.toDate.toISOString().split('T')[0]));
        }

        // Build the query with or without where clause
        const results = conditions.length > 0
            ? await db.select()
                .from(journalsTable)
                .where(conditions.length === 1 ? conditions[0] : and(...conditions))
                .execute()
            : await db.select()
                .from(journalsTable)
                .execute();
        
        // Convert date strings back to Date objects
        return results.map(journal => ({
            ...journal,
            transaction_date: new Date(journal.transaction_date + 'T00:00:00.000Z')
        }));
    } catch (error) {
        console.error('Get journals failed:', error);
        throw error;
    }
}

// Post a journal (make it immutable)
export async function postJournal(input: PostJournalInput): Promise<Journal> {
    try {
        // Get journal with lines to validate
        const journalWithLines = await getJournal(input.id);
        if (!journalWithLines) {
            throw new Error('Journal not found');
        }

        if (journalWithLines.status === 'POSTED') {
            throw new Error('Journal already posted');
        }

        // Check if period is still open
        const period = await db.select()
            .from(periodsTable)
            .where(eq(periodsTable.id, journalWithLines.period_id))
            .execute();

        if (period.length === 0 || period[0].status === 'LOCKED') {
            throw new Error('Cannot post journal in locked period');
        }

        // Validate journal balance
        const validation = await validateJournal(input.id);
        if (!validation.isValid) {
            throw new Error(`Journal validation failed: ${validation.errors.join(', ')}`);
        }

        // Validate that user exists
        const user = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, input.posted_by))
            .execute();

        if (user.length === 0) {
            throw new Error('User not found');
        }

        // Update journal to posted status
        const result = await db.update(journalsTable)
            .set({
                status: 'POSTED',
                posted_at: new Date(),
                posted_by: input.posted_by,
                updated_at: new Date()
            })
            .where(eq(journalsTable.id, input.id))
            .returning()
            .execute();

        // Convert date string back to Date object
        const journal = result[0];
        return {
            ...journal,
            transaction_date: new Date(journal.transaction_date + 'T00:00:00.000Z')
        };
    } catch (error) {
        console.error('Post journal failed:', error);
        throw error;
    }
}

// Validate journal balances
export async function validateJournal(journalId: number): Promise<{ isValid: boolean; errors: string[] }> {
    try {
        const lines = await db.select()
            .from(journalLinesTable)
            .where(eq(journalLinesTable.journal_id, journalId))
            .execute();

        if (lines.length === 0) {
            return {
                isValid: false,
                errors: ['Journal has no lines']
            };
        }

        const errors: string[] = [];

        // Calculate totals - both in original currency and base currency
        let totalDebits = 0;
        let totalCredits = 0;
        let totalDebitsBase = 0;
        let totalCreditsBase = 0;

        lines.forEach(line => {
            totalDebits += parseFloat(line.debit_amount);
            totalCredits += parseFloat(line.credit_amount);
            totalDebitsBase += parseFloat(line.debit_amount_base);
            totalCreditsBase += parseFloat(line.credit_amount_base);

            // Validate that each line has either debit or credit (but not both or neither)
            const debit = parseFloat(line.debit_amount);
            const credit = parseFloat(line.credit_amount);
            
            if (debit > 0 && credit > 0) {
                errors.push(`Line ${line.id}: Cannot have both debit and credit amounts`);
            } else if (debit === 0 && credit === 0) {
                errors.push(`Line ${line.id}: Must have either debit or credit amount`);
            }
        });

        // Check if debits equal credits (allow for small rounding differences)
        const tolerance = 0.01;
        if (Math.abs(totalDebits - totalCredits) > tolerance) {
            errors.push(`Debits (${totalDebits.toFixed(2)}) do not equal credits (${totalCredits.toFixed(2)})`);
        }

        if (Math.abs(totalDebitsBase - totalCreditsBase) > tolerance) {
            errors.push(`Base currency debits (${totalDebitsBase.toFixed(2)}) do not equal base currency credits (${totalCreditsBase.toFixed(2)})`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    } catch (error) {
        console.error('Validate journal failed:', error);
        return {
            isValid: false,
            errors: ['Validation failed due to system error']
        };
    }
}

// Delete journal line
export async function deleteJournalLine(lineId: number): Promise<boolean> {
    try {
        // Get the journal line to check journal status
        const lines = await db.select({
            id: journalLinesTable.id,
            journalId: journalLinesTable.journal_id
        })
            .from(journalLinesTable)
            .where(eq(journalLinesTable.id, lineId))
            .execute();

        if (lines.length === 0) {
            throw new Error('Journal line not found');
        }

        // Check if journal is in draft status
        const journals = await db.select()
            .from(journalsTable)
            .where(eq(journalsTable.id, lines[0].journalId))
            .execute();

        if (journals.length === 0) {
            throw new Error('Associated journal not found');
        }

        if (journals[0].status === 'POSTED') {
            throw new Error('Cannot delete line from posted journal');
        }

        // Delete the journal line
        await db.delete(journalLinesTable)
            .where(eq(journalLinesTable.id, lineId))
            .execute();

        return true;
    } catch (error) {
        console.error('Delete journal line failed:', error);
        throw error;
    }
}