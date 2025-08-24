import { db } from '../db';
import { fxRatesTable } from '../db/schema';
import { type CreateFxRateInput, type UpdateFxRateInput, type FxRate } from '../schema';
import { eq, lte, gte, and, desc, SQL } from 'drizzle-orm';

// Helper function to convert Date to YYYY-MM-DD string format
const formatDateForDB = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper function to convert database result to FxRate with proper types
const convertDbRateToFxRate = (dbRate: any): FxRate => {
  return {
    ...dbRate,
    date: new Date(dbRate.date + 'T00:00:00.000Z'), // Convert string to Date
    usd_to_pkr_rate: parseFloat(dbRate.usd_to_pkr_rate) // Convert string to number
  };
};

// Create or update FX rate for a specific date
export async function setFxRate(input: CreateFxRateInput): Promise<FxRate> {
  try {
    const dateStr = formatDateForDB(input.date);
    
    // Check if a rate already exists for this date
    const existingRates = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.date, dateStr))
      .execute();

    if (existingRates.length > 0) {
      const existingRate = existingRates[0];
      
      // Check if the existing rate is locked
      if (existingRate.is_locked) {
        throw new Error('Cannot update locked FX rate');
      }

      // Update existing rate
      const updatedRates = await db.update(fxRatesTable)
        .set({
          usd_to_pkr_rate: input.usd_to_pkr_rate.toString(),
          updated_at: new Date()
        })
        .where(eq(fxRatesTable.id, existingRate.id))
        .returning()
        .execute();

      return convertDbRateToFxRate(updatedRates[0]);
    } else {
      // Create new rate
      const newRates = await db.insert(fxRatesTable)
        .values({
          date: dateStr,
          usd_to_pkr_rate: input.usd_to_pkr_rate.toString(),
          is_locked: false
        })
        .returning()
        .execute();

      return convertDbRateToFxRate(newRates[0]);
    }
  } catch (error) {
    console.error('Failed to set FX rate:', error);
    throw error;
  }
}

// Get FX rate for a specific date
export async function getFxRate(date: Date): Promise<FxRate | null> {
  try {
    const dateStr = formatDateForDB(date);
    
    // First try to find exact match for the date
    const exactRates = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.date, dateStr))
      .execute();

    if (exactRates.length > 0) {
      return convertDbRateToFxRate(exactRates[0]);
    }

    // If no exact match, find the most recent rate before or on the given date
    const recentRates = await db.select()
      .from(fxRatesTable)
      .where(lte(fxRatesTable.date, dateStr))
      .orderBy(desc(fxRatesTable.date))
      .limit(1)
      .execute();

    if (recentRates.length > 0) {
      return convertDbRateToFxRate(recentRates[0]);
    }

    return null;
  } catch (error) {
    console.error('Failed to get FX rate:', error);
    throw error;
  }
}

// Get all FX rates within a date range
export async function getFxRates(fromDate: Date, toDate: Date): Promise<FxRate[]> {
  try {
    const fromDateStr = formatDateForDB(fromDate);
    const toDateStr = formatDateForDB(toDate);
    
    const conditions: SQL<unknown>[] = [];
    
    conditions.push(gte(fxRatesTable.date, fromDateStr));
    conditions.push(lte(fxRatesTable.date, toDateStr));

    const rates = await db.select()
      .from(fxRatesTable)
      .where(and(...conditions))
      .orderBy(desc(fxRatesTable.date))
      .execute();

    return rates.map(rate => convertDbRateToFxRate(rate));
  } catch (error) {
    console.error('Failed to get FX rates:', error);
    throw error;
  }
}

// Lock FX rate to prevent further changes
export async function lockFxRate(input: UpdateFxRateInput): Promise<FxRate> {
  try {
    // Check if the rate exists
    const existingRates = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.id, input.id))
      .execute();

    if (existingRates.length === 0) {
      throw new Error('FX rate not found');
    }

    const existingRate = existingRates[0];
    
    // Check if already locked
    if (existingRate.is_locked) {
      throw new Error('FX rate is already locked');
    }

    // Update to lock the rate
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.is_locked !== undefined) {
      updateData.is_locked = input.is_locked;
    }

    if (input.usd_to_pkr_rate !== undefined) {
      updateData.usd_to_pkr_rate = input.usd_to_pkr_rate.toString();
    }

    const updatedRates = await db.update(fxRatesTable)
      .set(updateData)
      .where(eq(fxRatesTable.id, input.id))
      .returning()
      .execute();

    return convertDbRateToFxRate(updatedRates[0]);
  } catch (error) {
    console.error('Failed to lock FX rate:', error);
    throw error;
  }
}

// Get current USD to PKR rate
export async function getCurrentFxRate(): Promise<number> {
  try {
    const today = new Date();
    const todayStr = formatDateForDB(today);
    
    // Get the most recent rate (today or before today)
    const recentRates = await db.select()
      .from(fxRatesTable)
      .where(lte(fxRatesTable.date, todayStr))
      .orderBy(desc(fxRatesTable.date))
      .limit(1)
      .execute();

    if (recentRates.length > 0) {
      return parseFloat(recentRates[0].usd_to_pkr_rate);
    }

    throw new Error('No FX rate available');
  } catch (error) {
    console.error('Failed to get current FX rate:', error);
    throw error;
  }
}