import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { auditLogsTable, usersTable, partnersTable } from '../db/schema';
import { type CreateAuditLogInput } from '../schema';
import { 
  createAuditLog, 
  getAuditLogsForRecord, 
  getAuditLogsForUser, 
  getRecentAuditActivities, 
  getAuditLogs 
} from '../handlers/audit_handlers';
import { eq } from 'drizzle-orm';

// Test data
let testUserId: number;
let testUserId2: number;

const createTestUser = async (email: string, name: string) => {
  // Create a partner first for the user
  const partnerResult = await db.insert(partnersTable)
    .values({
      name: `Partner for ${name}`,
      email: `partner-${email}`,
      has_usd_account: true,
      has_pkr_account: true
    })
    .returning()
    .execute();

  const userResult = await db.insert(usersTable)
    .values({
      email,
      name,
      role: 'ADMIN',
      partner_id: partnerResult[0].id,
      is_active: true
    })
    .returning()
    .execute();

  return userResult[0].id;
};

const testInput: CreateAuditLogInput = {
  table_name: 'partners',
  record_id: 123,
  action: 'UPDATE',
  old_values: '{"name": "Old Partner Name", "email": "old@example.com"}',
  new_values: '{"name": "New Partner Name", "email": "new@example.com"}',
  user_id: 0 // Will be set in beforeEach
};

describe('Audit Handlers', () => {
  beforeEach(async () => {
    await createDB();
    testUserId = await createTestUser('test@example.com', 'Test User');
    testUserId2 = await createTestUser('test2@example.com', 'Test User 2');
    testInput.user_id = testUserId;
  });

  afterEach(resetDB);

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const result = await createAuditLog(testInput);

      expect(result.table_name).toEqual('partners');
      expect(result.record_id).toEqual(123);
      expect(result.action).toEqual('UPDATE');
      expect(result.old_values).toContain('"name":"Old Partner Name"');
      expect(result.old_values).toContain('"email":"old@example.com"');
      expect(result.new_values).toContain('"name":"New Partner Name"');
      expect(result.new_values).toContain('"email":"new@example.com"');
      expect(result.user_id).toEqual(testUserId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save audit log to database', async () => {
      const result = await createAuditLog(testInput);

      const auditLogs = await db.select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.id, result.id))
        .execute();

      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].table_name).toEqual('partners');
      expect(auditLogs[0].record_id).toEqual(123);
      expect(auditLogs[0].action).toEqual('UPDATE');
      expect(auditLogs[0].user_id).toEqual(testUserId);
    });

    it('should handle null old_values and new_values', async () => {
      const inputWithNulls: CreateAuditLogInput = {
        table_name: 'accounts',
        record_id: 456,
        action: 'DELETE',
        user_id: testUserId
      };

      const result = await createAuditLog(inputWithNulls);

      expect(result.old_values).toBeNull();
      expect(result.new_values).toBeNull();
      expect(result.table_name).toEqual('accounts');
      expect(result.action).toEqual('DELETE');
    });
  });

  describe('getAuditLogsForRecord', () => {
    it('should fetch audit logs for a specific record', async () => {
      // Create multiple audit logs for the same record
      await createAuditLog(testInput);
      await createAuditLog({
        ...testInput,
        action: 'DELETE',
        old_values: '{"name": "Partner to Delete"}',
        new_values: null
      });

      // Create audit log for different record
      await createAuditLog({
        ...testInput,
        record_id: 999,
        action: 'CREATE'
      });

      const results = await getAuditLogsForRecord('partners', 123);

      expect(results).toHaveLength(2);
      expect(results[0].record_id).toEqual(123);
      expect(results[1].record_id).toEqual(123);
      expect(results[0].table_name).toEqual('partners');
      expect(results[1].table_name).toEqual('partners');
      
      // Results should be ordered by created_at descending (most recent first)
      expect(results[0].created_at >= results[1].created_at).toBe(true);
    });

    it('should return empty array for non-existent record', async () => {
      const results = await getAuditLogsForRecord('partners', 999);
      expect(results).toHaveLength(0);
    });
  });

  describe('getAuditLogsForUser', () => {
    it('should fetch audit logs for a specific user', async () => {
      // Create audit logs for different users
      await createAuditLog(testInput);
      await createAuditLog({
        ...testInput,
        record_id: 456,
        user_id: testUserId
      });
      await createAuditLog({
        ...testInput,
        record_id: 789,
        user_id: testUserId2
      });

      const results = await getAuditLogsForUser(testUserId);

      expect(results).toHaveLength(2);
      results.forEach(log => {
        expect(log.user_id).toEqual(testUserId);
      });
      
      // Results should be ordered by created_at descending
      expect(results[0].created_at >= results[1].created_at).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Create multiple audit logs for the same user
      for (let i = 0; i < 10; i++) {
        await createAuditLog({
          ...testInput,
          record_id: i + 100
        });
      }

      const results = await getAuditLogsForUser(testUserId, 5);
      expect(results).toHaveLength(5);
    });

    it('should use default limit of 50', async () => {
      await createAuditLog(testInput);
      const results = await getAuditLogsForUser(testUserId);
      expect(results).toHaveLength(1);
    });
  });

  describe('getRecentAuditActivities', () => {
    it('should fetch recent audit activities', async () => {
      // Create audit logs from different users and tables
      await createAuditLog(testInput);
      await createAuditLog({
        ...testInput,
        table_name: 'accounts',
        record_id: 456,
        user_id: testUserId2
      });

      const results = await getRecentAuditActivities();

      expect(results).toHaveLength(2);
      // Results should be ordered by created_at descending
      expect(results[0].created_at >= results[1].created_at).toBe(true);
    });

    it('should respect limit parameter', async () => {
      // Create multiple audit logs
      for (let i = 0; i < 10; i++) {
        await createAuditLog({
          ...testInput,
          record_id: i + 100
        });
      }

      const results = await getRecentAuditActivities(3);
      expect(results).toHaveLength(3);
    });

    it('should use default limit of 50', async () => {
      await createAuditLog(testInput);
      const results = await getRecentAuditActivities();
      expect(results).toHaveLength(1);
    });
  });

  describe('getAuditLogs with filtering', () => {
    beforeEach(async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create various audit logs for comprehensive filtering tests
      await createAuditLog({
        ...testInput,
        table_name: 'partners',
        record_id: 100,
        action: 'CREATE',
        user_id: testUserId
      });

      await createAuditLog({
        ...testInput,
        table_name: 'accounts',
        record_id: 200,
        action: 'UPDATE',
        user_id: testUserId2
      });

      await createAuditLog({
        ...testInput,
        table_name: 'partners',
        record_id: 300,
        action: 'DELETE',
        user_id: testUserId
      });
    });

    it('should filter by table name', async () => {
      const results = await getAuditLogs({ tableName: 'partners' });

      expect(results).toHaveLength(2);
      results.forEach(log => {
        expect(log.table_name).toEqual('partners');
      });
    });

    it('should filter by user ID', async () => {
      const results = await getAuditLogs({ userId: testUserId });

      expect(results).toHaveLength(2);
      results.forEach(log => {
        expect(log.user_id).toEqual(testUserId);
      });
    });

    it('should filter by action', async () => {
      const results = await getAuditLogs({ action: 'DELETE' });

      expect(results).toHaveLength(1);
      expect(results[0].action).toEqual('DELETE');
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const results = await getAuditLogs({ 
        fromDate: oneHourAgo,
        toDate: oneHourFromNow
      });

      expect(results.length).toBeGreaterThanOrEqual(3);
      results.forEach(log => {
        expect(log.created_at >= oneHourAgo).toBe(true);
        expect(log.created_at <= oneHourFromNow).toBe(true);
      });
    });

    it('should combine multiple filters', async () => {
      const results = await getAuditLogs({ 
        tableName: 'partners',
        userId: testUserId,
        action: 'CREATE'
      });

      expect(results).toHaveLength(1);
      expect(results[0].table_name).toEqual('partners');
      expect(results[0].user_id).toEqual(testUserId);
      expect(results[0].action).toEqual('CREATE');
    });

    it('should respect limit parameter', async () => {
      const results = await getAuditLogs({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should return all logs when no filters are provided', async () => {
      const results = await getAuditLogs({});
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should return results ordered by created_at descending', async () => {
      const results = await getAuditLogs({});

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].created_at >= results[i + 1].created_at).toBe(true);
      }
    });
  });
});