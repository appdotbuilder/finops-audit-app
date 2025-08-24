import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fxRatesTable } from '../db/schema';
import { type CreateFxRateInput, type UpdateFxRateInput } from '../schema';
import { 
  setFxRate, 
  getFxRate, 
  getFxRates, 
  lockFxRate, 
  getCurrentFxRate 
} from '../handlers/fx_rate_handlers';
import { eq, desc } from 'drizzle-orm';

// Test data
const testRateInput: CreateFxRateInput = {
  date: new Date('2024-01-15'),
  usd_to_pkr_rate: 278.50
};

const testRateInput2: CreateFxRateInput = {
  date: new Date('2024-01-16'),
  usd_to_pkr_rate: 279.25
};

describe('FX Rate Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('setFxRate', () => {
    it('should create a new FX rate', async () => {
      const result = await setFxRate(testRateInput);

      expect(result.id).toBeDefined();
      expect(result.date).toEqual(testRateInput.date);
      expect(result.usd_to_pkr_rate).toEqual(278.50);
      expect(typeof result.usd_to_pkr_rate).toBe('number');
      expect(result.is_locked).toBe(false);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save FX rate to database', async () => {
      const result = await setFxRate(testRateInput);

      const rates = await db.select()
        .from(fxRatesTable)
        .where(eq(fxRatesTable.id, result.id))
        .execute();

      expect(rates).toHaveLength(1);
      expect(rates[0].date).toEqual(testRateInput.date.toISOString().split('T')[0]);
      expect(parseFloat(rates[0].usd_to_pkr_rate)).toEqual(278.50);
      expect(rates[0].is_locked).toBe(false);
    });

    it('should update existing FX rate for same date', async () => {
      // Create initial rate
      await setFxRate(testRateInput);

      // Update rate for same date
      const updatedInput: CreateFxRateInput = {
        date: testRateInput.date,
        usd_to_pkr_rate: 280.00
      };

      const result = await setFxRate(updatedInput);

      expect(result.usd_to_pkr_rate).toEqual(280.00);

      // Verify only one record exists for this date
      const rates = await db.select()
        .from(fxRatesTable)
        .where(eq(fxRatesTable.date, testRateInput.date.toISOString().split('T')[0]))
        .execute();

      expect(rates).toHaveLength(1);
      expect(parseFloat(rates[0].usd_to_pkr_rate)).toEqual(280.00);
    });

    it('should throw error when trying to update locked rate', async () => {
      // Create and lock a rate
      const createdRate = await setFxRate(testRateInput);
      await lockFxRate({ id: createdRate.id, is_locked: true });

      // Try to update the locked rate
      const updatedInput: CreateFxRateInput = {
        date: testRateInput.date,
        usd_to_pkr_rate: 280.00
      };

      await expect(setFxRate(updatedInput)).rejects.toThrow(/locked/i);
    });
  });

  describe('getFxRate', () => {
    it('should return exact match for date', async () => {
      const createdRate = await setFxRate(testRateInput);

      const result = await getFxRate(testRateInput.date);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdRate.id);
      expect(result!.date).toEqual(testRateInput.date);
      expect(result!.usd_to_pkr_rate).toEqual(278.50);
      expect(typeof result!.usd_to_pkr_rate).toBe('number');
    });

    it('should return most recent rate when exact date not found', async () => {
      // Create rates for Jan 15 and Jan 17
      await setFxRate(testRateInput);
      await setFxRate({
        date: new Date('2024-01-17'),
        usd_to_pkr_rate: 279.75
      });

      // Query for Jan 16 (should return Jan 15 rate)
      const result = await getFxRate(new Date('2024-01-16'));

      expect(result).not.toBeNull();
      expect(result!.date).toEqual(testRateInput.date);
      expect(result!.usd_to_pkr_rate).toEqual(278.50);
    });

    it('should return null when no rate available for date', async () => {
      await setFxRate(testRateInput);

      // Query for date before any rates exist
      const result = await getFxRate(new Date('2024-01-14'));

      expect(result).toBeNull();
    });
  });

  describe('getFxRates', () => {
    beforeEach(async () => {
      // Create test rates
      await setFxRate(testRateInput);
      await setFxRate(testRateInput2);
      await setFxRate({
        date: new Date('2024-01-17'),
        usd_to_pkr_rate: 279.75
      });
    });

    it('should return rates within date range', async () => {
      const fromDate = new Date('2024-01-15');
      const toDate = new Date('2024-01-16');

      const result = await getFxRates(fromDate, toDate);

      expect(result).toHaveLength(2);
      expect(result[0].date).toEqual(testRateInput2.date); // Most recent first
      expect(result[1].date).toEqual(testRateInput.date);
      expect(result.every(rate => typeof rate.usd_to_pkr_rate === 'number')).toBe(true);
    });

    it('should return empty array when no rates in range', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-10');

      const result = await getFxRates(fromDate, toDate);

      expect(result).toHaveLength(0);
    });

    it('should return rates in descending order by date', async () => {
      const fromDate = new Date('2024-01-15');
      const toDate = new Date('2024-01-17');

      const result = await getFxRates(fromDate, toDate);

      expect(result).toHaveLength(3);
      expect(result[0].date).toEqual(new Date('2024-01-17'));
      expect(result[1].date).toEqual(new Date('2024-01-16'));
      expect(result[2].date).toEqual(new Date('2024-01-15'));
    });
  });

  describe('lockFxRate', () => {
    it('should lock an existing FX rate', async () => {
      const createdRate = await setFxRate(testRateInput);

      const lockInput: UpdateFxRateInput = {
        id: createdRate.id,
        is_locked: true
      };

      const result = await lockFxRate(lockInput);

      expect(result.id).toEqual(createdRate.id);
      expect(result.is_locked).toBe(true);
      expect(result.updated_at.getTime()).toBeGreaterThan(createdRate.updated_at.getTime());
    });

    it('should update rate value when locking', async () => {
      const createdRate = await setFxRate(testRateInput);

      const lockInput: UpdateFxRateInput = {
        id: createdRate.id,
        usd_to_pkr_rate: 280.00,
        is_locked: true
      };

      const result = await lockFxRate(lockInput);

      expect(result.usd_to_pkr_rate).toEqual(280.00);
      expect(result.is_locked).toBe(true);
      expect(typeof result.usd_to_pkr_rate).toBe('number');
    });

    it('should throw error when rate does not exist', async () => {
      const lockInput: UpdateFxRateInput = {
        id: 999,
        is_locked: true
      };

      await expect(lockFxRate(lockInput)).rejects.toThrow(/not found/i);
    });

    it('should throw error when trying to lock already locked rate', async () => {
      const createdRate = await setFxRate(testRateInput);
      await lockFxRate({ id: createdRate.id, is_locked: true });

      // Try to lock again
      await expect(lockFxRate({ id: createdRate.id, is_locked: true })).rejects.toThrow(/already locked/i);
    });

    it('should save locked status to database', async () => {
      const createdRate = await setFxRate(testRateInput);
      await lockFxRate({ id: createdRate.id, is_locked: true });

      const rates = await db.select()
        .from(fxRatesTable)
        .where(eq(fxRatesTable.id, createdRate.id))
        .execute();

      expect(rates[0].is_locked).toBe(true);
    });
  });

  describe('getCurrentFxRate', () => {
    it('should return the most recent FX rate', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create rates for yesterday and today
      await setFxRate({ date: yesterday, usd_to_pkr_rate: 278.00 });
      await setFxRate({ date: today, usd_to_pkr_rate: 279.00 });

      const result = await getCurrentFxRate();

      expect(result).toEqual(279.00);
      expect(typeof result).toBe('number');
    });

    it('should return rate from previous day if no rate for today', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await setFxRate({ date: yesterday, usd_to_pkr_rate: 278.50 });

      const result = await getCurrentFxRate();

      expect(result).toEqual(278.50);
    });

    it('should throw error when no rates available', async () => {
      await expect(getCurrentFxRate()).rejects.toThrow(/No FX rate available/i);
    });

    it('should not return future dates', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create rates for yesterday and tomorrow
      await setFxRate({ date: yesterday, usd_to_pkr_rate: 278.00 });
      await setFxRate({ date: tomorrow, usd_to_pkr_rate: 280.00 });

      const result = await getCurrentFxRate();

      // Should return yesterday's rate, not tomorrow's
      expect(result).toEqual(278.00);
    });
  });

  describe('numeric field conversions', () => {
    it('should handle numeric conversions correctly in all operations', async () => {
      // Test setFxRate conversion
      const createdRate = await setFxRate(testRateInput);
      expect(typeof createdRate.usd_to_pkr_rate).toBe('number');

      // Verify database storage as string
      const dbRates = await db.select()
        .from(fxRatesTable)
        .where(eq(fxRatesTable.id, createdRate.id))
        .execute();
      expect(typeof dbRates[0].usd_to_pkr_rate).toBe('string');

      // Test getFxRate conversion
      const retrievedRate = await getFxRate(testRateInput.date);
      expect(typeof retrievedRate!.usd_to_pkr_rate).toBe('number');

      // Test getFxRates conversion
      const ratesRange = await getFxRates(testRateInput.date, testRateInput.date);
      expect(typeof ratesRange[0].usd_to_pkr_rate).toBe('number');

      // Test lockFxRate conversion
      const lockedRate = await lockFxRate({ id: createdRate.id, is_locked: true });
      expect(typeof lockedRate.usd_to_pkr_rate).toBe('number');

      // Test getCurrentFxRate conversion
      const currentRate = await getCurrentFxRate();
      expect(typeof currentRate).toBe('number');
    });
  });
});