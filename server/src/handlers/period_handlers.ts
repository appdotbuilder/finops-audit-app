import { db } from '../db';
import { periodsTable, journalsTable, fxRatesTable, usersTable } from '../db/schema';
import { type CreatePeriodInput, type LockPeriodInput, type Period } from '../schema';
import { eq, and, desc, asc } from 'drizzle-orm';

// Create a new accounting period
export async function createPeriod(input: CreatePeriodInput): Promise<Period> {
  try {
    // Check if period already exists
    const existingPeriod = await db.select()
      .from(periodsTable)
      .where(and(
        eq(periodsTable.year, input.year),
        eq(periodsTable.month, input.month)
      ))
      .limit(1)
      .execute();

    if (existingPeriod.length > 0) {
      throw new Error(`Period ${input.year}-${String(input.month).padStart(2, '0')} already exists`);
    }

    // Insert new period
    const result = await db.insert(periodsTable)
      .values({
        year: input.year,
        month: input.month,
        status: 'OPEN'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Period creation failed:', error);
    throw error;
  }
}

// Get all periods
export async function getPeriods(): Promise<Period[]> {
  try {
    const periods = await db.select()
      .from(periodsTable)
      .orderBy(desc(periodsTable.year), desc(periodsTable.month))
      .execute();

    return periods;
  } catch (error) {
    console.error('Failed to fetch periods:', error);
    throw error;
  }
}

// Get current open period
export async function getCurrentPeriod(): Promise<Period | null> {
  try {
    const result = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.status, 'OPEN'))
      .orderBy(desc(periodsTable.year), desc(periodsTable.month))
      .limit(1)
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch current period:', error);
    throw error;
  }
}

// Get period by year and month
export async function getPeriod(year: number, month: number): Promise<Period | null> {
  try {
    const result = await db.select()
      .from(periodsTable)
      .where(and(
        eq(periodsTable.year, year),
        eq(periodsTable.month, month)
      ))
      .limit(1)
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch period:', error);
    throw error;
  }
}

// Lock a period (close it)
export async function lockPeriod(input: LockPeriodInput): Promise<Period> {
  try {
    // Validate period can be closed
    const validation = await validatePeriodClose(input.id);
    if (!validation.canClose) {
      throw new Error(`Cannot lock period: ${validation.errors.join(', ')}`);
    }

    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.locked_by))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error('Invalid user ID for locking period');
    }

    // Update period to locked status
    const result = await db.update(periodsTable)
      .set({
        status: 'LOCKED',
        locked_at: new Date(),
        locked_by: input.locked_by,
        updated_at: new Date()
      })
      .where(eq(periodsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Period not found');
    }

    return result[0];
  } catch (error) {
    console.error('Period lock failed:', error);
    throw error;
  }
}

// Validate period can be closed
export async function validatePeriodClose(periodId: number): Promise<{ canClose: boolean; errors: string[] }> {
  try {
    const errors: string[] = [];

    // Get the period
    const period = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, periodId))
      .limit(1)
      .execute();

    if (period.length === 0) {
      errors.push('Period not found');
      return { canClose: false, errors };
    }

    const periodData = period[0];

    // Check if period is already locked
    if (periodData.status === 'LOCKED') {
      errors.push('Period is already locked');
      return { canClose: false, errors };
    }

    // Check for draft journals in this period
    const draftJournals = await db.select()
      .from(journalsTable)
      .where(and(
        eq(journalsTable.period_id, periodId),
        eq(journalsTable.status, 'DRAFT')
      ))
      .execute();

    if (draftJournals.length > 0) {
      errors.push(`Period contains ${draftJournals.length} draft journal(s) that must be posted first`);
    }

    // Check if FX rate exists for the period month (if needed)
    const periodDate = new Date(periodData.year, periodData.month - 1, 1);
    const dateString = periodDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    
    const fxRate = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.date, dateString))
      .limit(1)
      .execute();

    // Note: We don't require FX rates to exist for period closure in this basic implementation
    // In a more complex system, you might require FX rates to be locked for the period

    return {
      canClose: errors.length === 0,
      errors
    };
  } catch (error) {
    console.error('Period validation failed:', error);
    throw error;
  }
}