import { db } from '../db';
import { auditLogsTable, usersTable } from '../db/schema';
import { type CreateAuditLogInput, type AuditLog } from '../schema';
import { eq, desc, and, gte, lte, SQL } from 'drizzle-orm';

// Create audit log entry
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  try {
    const result = await db.insert(auditLogsTable)
      .values({
        table_name: input.table_name,
        record_id: input.record_id,
        action: input.action,
        old_values: input.old_values || null,
        new_values: input.new_values || null,
        user_id: input.user_id
      })
      .returning()
      .execute();

    const auditLog = result[0];
    return {
      ...auditLog,
      old_values: typeof auditLog.old_values === 'string' ? auditLog.old_values : (auditLog.old_values ? JSON.stringify(auditLog.old_values) : null),
      new_values: typeof auditLog.new_values === 'string' ? auditLog.new_values : (auditLog.new_values ? JSON.stringify(auditLog.new_values) : null)
    };
  } catch (error) {
    console.error('Audit log creation failed:', error);
    throw error;
  }
}

// Get audit logs for a specific record
export async function getAuditLogsForRecord(tableName: string, recordId: number): Promise<AuditLog[]> {
  try {
    const results = await db.select()
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.table_name, tableName),
        eq(auditLogsTable.record_id, recordId)
      ))
      .orderBy(desc(auditLogsTable.created_at))
      .execute();

    return results.map(log => ({
      ...log,
      old_values: typeof log.old_values === 'string' ? log.old_values : (log.old_values ? JSON.stringify(log.old_values) : null),
      new_values: typeof log.new_values === 'string' ? log.new_values : (log.new_values ? JSON.stringify(log.new_values) : null)
    }));
  } catch (error) {
    console.error('Failed to fetch audit logs for record:', error);
    throw error;
  }
}

// Get audit logs for a user
export async function getAuditLogsForUser(userId: number, limit: number = 50): Promise<AuditLog[]> {
  try {
    const results = await db.select()
      .from(auditLogsTable)
      .where(eq(auditLogsTable.user_id, userId))
      .orderBy(desc(auditLogsTable.created_at))
      .limit(limit)
      .execute();

    return results.map(log => ({
      ...log,
      old_values: typeof log.old_values === 'string' ? log.old_values : (log.old_values ? JSON.stringify(log.old_values) : null),
      new_values: typeof log.new_values === 'string' ? log.new_values : (log.new_values ? JSON.stringify(log.new_values) : null)
    }));
  } catch (error) {
    console.error('Failed to fetch audit logs for user:', error);
    throw error;
  }
}

// Get recent audit activities
export async function getRecentAuditActivities(limit: number = 50): Promise<AuditLog[]> {
  try {
    const results = await db.select()
      .from(auditLogsTable)
      .orderBy(desc(auditLogsTable.created_at))
      .limit(limit)
      .execute();

    return results.map(log => ({
      ...log,
      old_values: typeof log.old_values === 'string' ? log.old_values : (log.old_values ? JSON.stringify(log.old_values) : null),
      new_values: typeof log.new_values === 'string' ? log.new_values : (log.new_values ? JSON.stringify(log.new_values) : null)
    }));
  } catch (error) {
    console.error('Failed to fetch recent audit activities:', error);
    throw error;
  }
}

// Get audit logs with filtering
export async function getAuditLogs(filters: {
  tableName?: string;
  userId?: number;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): Promise<AuditLog[]> {
  try {
    const conditions: SQL<unknown>[] = [];

    if (filters.tableName) {
      conditions.push(eq(auditLogsTable.table_name, filters.tableName));
    }

    if (filters.userId) {
      conditions.push(eq(auditLogsTable.user_id, filters.userId));
    }

    if (filters.action) {
      conditions.push(eq(auditLogsTable.action, filters.action));
    }

    if (filters.fromDate) {
      conditions.push(gte(auditLogsTable.created_at, filters.fromDate));
    }

    if (filters.toDate) {
      conditions.push(lte(auditLogsTable.created_at, filters.toDate));
    }

    // Use a unified approach for all query combinations
    const baseSelect = db.select().from(auditLogsTable);
    let finalQuery;

    if (conditions.length > 0 && filters.limit) {
      // Has conditions and limit
      finalQuery = baseSelect
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(auditLogsTable.created_at))
        .limit(filters.limit);
    } else if (conditions.length > 0) {
      // Has conditions but no limit
      finalQuery = baseSelect
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(auditLogsTable.created_at));
    } else if (filters.limit) {
      // No conditions but has limit
      finalQuery = baseSelect
        .orderBy(desc(auditLogsTable.created_at))
        .limit(filters.limit);
    } else {
      // No conditions and no limit
      finalQuery = baseSelect
        .orderBy(desc(auditLogsTable.created_at));
    }

    const results = await finalQuery.execute();

    return results.map(log => ({
      ...log,
      old_values: typeof log.old_values === 'string' ? log.old_values : (log.old_values ? JSON.stringify(log.old_values) : null),
      new_values: typeof log.new_values === 'string' ? log.new_values : (log.new_values ? JSON.stringify(log.new_values) : null)
    }));
  } catch (error) {
    console.error('Failed to fetch filtered audit logs:', error);
    throw error;
  }
}