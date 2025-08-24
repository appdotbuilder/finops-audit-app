import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { periodsTable, usersTable, journalsTable } from '../db/schema';
import { type CreatePeriodInput, type LockPeriodInput } from '../schema';
import { 
  createPeriod, 
  getPeriods, 
  getCurrentPeriod, 
  getPeriod, 
  lockPeriod, 
  validatePeriodClose 
} from '../handlers/period_handlers';
import { eq, and } from 'drizzle-orm';

// Test data
const testPeriodInput: CreatePeriodInput = {
  year: 2024,
  month: 1
};

const testUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'ADMIN' as const,
  is_active: true
};

describe('Period Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPeriod', () => {
    it('should create a new period', async () => {
      const result = await createPeriod(testPeriodInput);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(1);
      expect(result.status).toBe('OPEN');
      expect(result.locked_at).toBeNull();
      expect(result.locked_by).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save period to database', async () => {
      const result = await createPeriod(testPeriodInput);

      const periods = await db.select()
        .from(periodsTable)
        .where(eq(periodsTable.id, result.id))
        .execute();

      expect(periods).toHaveLength(1);
      expect(periods[0].year).toBe(2024);
      expect(periods[0].month).toBe(1);
      expect(periods[0].status).toBe('OPEN');
    });

    it('should prevent duplicate periods', async () => {
      // Create first period
      await createPeriod(testPeriodInput);

      // Attempt to create duplicate
      await expect(createPeriod(testPeriodInput))
        .rejects
        .toThrow(/already exists/i);
    });

    it('should handle different year/month combinations', async () => {
      const period1 = await createPeriod({ year: 2024, month: 1 });
      const period2 = await createPeriod({ year: 2024, month: 2 });
      const period3 = await createPeriod({ year: 2025, month: 1 });

      expect(period1.year).toBe(2024);
      expect(period1.month).toBe(1);
      expect(period2.year).toBe(2024);
      expect(period2.month).toBe(2);
      expect(period3.year).toBe(2025);
      expect(period3.month).toBe(1);
    });
  });

  describe('getPeriods', () => {
    it('should return empty array when no periods exist', async () => {
      const result = await getPeriods();
      expect(result).toEqual([]);
    });

    it('should return all periods ordered by year and month descending', async () => {
      // Create periods in random order
      await createPeriod({ year: 2024, month: 1 });
      await createPeriod({ year: 2023, month: 12 });
      await createPeriod({ year: 2024, month: 3 });
      await createPeriod({ year: 2024, month: 2 });

      const result = await getPeriods();

      expect(result).toHaveLength(4);
      expect(result[0].year).toBe(2024);
      expect(result[0].month).toBe(3);
      expect(result[1].year).toBe(2024);
      expect(result[1].month).toBe(2);
      expect(result[2].year).toBe(2024);
      expect(result[2].month).toBe(1);
      expect(result[3].year).toBe(2023);
      expect(result[3].month).toBe(12);
    });

    it('should include all period fields', async () => {
      await createPeriod(testPeriodInput);
      
      const result = await getPeriods();
      
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('year');
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('status');
      expect(result[0]).toHaveProperty('locked_at');
      expect(result[0]).toHaveProperty('locked_by');
      expect(result[0]).toHaveProperty('created_at');
      expect(result[0]).toHaveProperty('updated_at');
    });
  });

  describe('getCurrentPeriod', () => {
    it('should return null when no periods exist', async () => {
      const result = await getCurrentPeriod();
      expect(result).toBeNull();
    });

    it('should return null when all periods are locked', async () => {
      // Create user for locking
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create and lock a period
      const period = await createPeriod(testPeriodInput);
      await lockPeriod({ id: period.id, locked_by: user.id });

      const result = await getCurrentPeriod();
      expect(result).toBeNull();
    });

    it('should return the most recent open period', async () => {
      // Create user for locking
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create multiple periods
      const period1 = await createPeriod({ year: 2024, month: 1 });
      const period2 = await createPeriod({ year: 2024, month: 2 });
      const period3 = await createPeriod({ year: 2024, month: 3 });

      // Lock the first period
      await lockPeriod({ id: period1.id, locked_by: user.id });

      const result = await getCurrentPeriod();
      
      expect(result).not.toBeNull();
      expect(result!.year).toBe(2024);
      expect(result!.month).toBe(3); // Most recent open period
      expect(result!.status).toBe('OPEN');
    });

    it('should return open period even with locked periods present', async () => {
      // Create user for locking
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const period1 = await createPeriod({ year: 2024, month: 1 });
      const period2 = await createPeriod({ year: 2024, month: 2 });
      
      // Lock period 2 but keep period 1 open
      await lockPeriod({ id: period2.id, locked_by: user.id });

      const result = await getCurrentPeriod();
      
      expect(result).not.toBeNull();
      expect(result!.id).toBe(period1.id);
      expect(result!.status).toBe('OPEN');
    });
  });

  describe('getPeriod', () => {
    it('should return null for non-existent period', async () => {
      const result = await getPeriod(2024, 1);
      expect(result).toBeNull();
    });

    it('should return specific period by year and month', async () => {
      await createPeriod({ year: 2024, month: 1 });
      await createPeriod({ year: 2024, month: 2 });
      
      const result = await getPeriod(2024, 1);
      
      expect(result).not.toBeNull();
      expect(result!.year).toBe(2024);
      expect(result!.month).toBe(1);
      expect(result!.status).toBe('OPEN');
    });

    it('should distinguish between different years', async () => {
      await createPeriod({ year: 2024, month: 1 });
      await createPeriod({ year: 2025, month: 1 });
      
      const result2024 = await getPeriod(2024, 1);
      const result2025 = await getPeriod(2025, 1);
      
      expect(result2024!.year).toBe(2024);
      expect(result2025!.year).toBe(2025);
      expect(result2024!.id).not.toBe(result2025!.id);
    });
  });

  describe('lockPeriod', () => {
    it('should lock a period successfully', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create period
      const period = await createPeriod(testPeriodInput);

      const lockInput: LockPeriodInput = {
        id: period.id,
        locked_by: user.id
      };

      const result = await lockPeriod(lockInput);

      expect(result.id).toBe(period.id);
      expect(result.status).toBe('LOCKED');
      expect(result.locked_at).toBeInstanceOf(Date);
      expect(result.locked_by).toBe(user.id);
    });

    it('should update period in database when locked', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create period
      const period = await createPeriod(testPeriodInput);

      await lockPeriod({ id: period.id, locked_by: user.id });

      const updatedPeriod = await db.select()
        .from(periodsTable)
        .where(eq(periodsTable.id, period.id))
        .execute();

      expect(updatedPeriod[0].status).toBe('LOCKED');
      expect(updatedPeriod[0].locked_at).toBeInstanceOf(Date);
      expect(updatedPeriod[0].locked_by).toBe(user.id);
    });

    it('should fail with invalid user ID', async () => {
      const period = await createPeriod(testPeriodInput);

      await expect(lockPeriod({ id: period.id, locked_by: 999 }))
        .rejects
        .toThrow(/invalid user id/i);
    });

    it('should fail with non-existent period', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      await expect(lockPeriod({ id: 999, locked_by: user.id }))
        .rejects
        .toThrow(/period not found/i);
    });

    it('should fail when period has draft journals', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create period
      const period = await createPeriod(testPeriodInput);

      // Create draft journal in the period
      const today = new Date().toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
      
      await db.insert(journalsTable)
        .values({
          reference: 'TEST-001',
          description: 'Test journal',
          transaction_date: today,
          period_id: period.id,
          status: 'DRAFT',
          created_by: user.id
        })
        .execute();

      await expect(lockPeriod({ id: period.id, locked_by: user.id }))
        .rejects
        .toThrow(/draft journal/i);
    });
  });

  describe('validatePeriodClose', () => {
    it('should validate period can be closed when no issues exist', async () => {
      const period = await createPeriod(testPeriodInput);

      const result = await validatePeriodClose(period.id);

      expect(result.canClose).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for non-existent period', async () => {
      const result = await validatePeriodClose(999);

      expect(result.canClose).toBe(false);
      expect(result.errors).toContain('Period not found');
    });

    it('should fail validation for already locked period', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create and lock period
      const period = await createPeriod(testPeriodInput);
      await lockPeriod({ id: period.id, locked_by: user.id });

      const result = await validatePeriodClose(period.id);

      expect(result.canClose).toBe(false);
      expect(result.errors).toContain('Period is already locked');
    });

    it('should fail validation when draft journals exist', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create period
      const period = await createPeriod(testPeriodInput);

      // Create multiple draft journals
      const today = new Date().toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
      
      await db.insert(journalsTable)
        .values([
          {
            reference: 'TEST-001',
            description: 'Test journal 1',
            transaction_date: today,
            period_id: period.id,
            status: 'DRAFT',
            created_by: user.id
          },
          {
            reference: 'TEST-002',
            description: 'Test journal 2',
            transaction_date: today,
            period_id: period.id,
            status: 'DRAFT',
            created_by: user.id
          }
        ])
        .execute();

      const result = await validatePeriodClose(period.id);

      expect(result.canClose).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/2 draft journal/i);
    });

    it('should pass validation when period has posted journals', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create period
      const period = await createPeriod(testPeriodInput);

      // Create posted journal
      const today = new Date().toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
      
      await db.insert(journalsTable)
        .values({
          reference: 'TEST-001',
          description: 'Test journal',
          transaction_date: today,
          period_id: period.id,
          status: 'POSTED',
          posted_at: new Date(),
          posted_by: user.id,
          created_by: user.id
        })
        .execute();

      const result = await validatePeriodClose(period.id);

      expect(result.canClose).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle multiple validation errors', async () => {
      // Create user
      const [user] = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create and lock period
      const period = await createPeriod(testPeriodInput);
      
      // Create draft journal
      const today = new Date().toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
      
      await db.insert(journalsTable)
        .values({
          reference: 'TEST-001',
          description: 'Test journal',
          transaction_date: today,
          period_id: period.id,
          status: 'DRAFT',
          created_by: user.id
        })
        .execute();

      // Lock period directly in database
      await db.update(periodsTable)
        .set({ status: 'LOCKED' })
        .where(eq(periodsTable.id, period.id))
        .execute();

      const result = await validatePeriodClose(period.id);

      expect(result.canClose).toBe(false);
      expect(result.errors).toContain('Period is already locked');
    });
  });
});