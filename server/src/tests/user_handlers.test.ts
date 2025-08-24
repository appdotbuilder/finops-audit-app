import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, partnersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { 
  createUser, 
  getUsers, 
  getUser, 
  getUserByEmail, 
  updateUserRole, 
  deactivateUser 
} from '../handlers/user_handlers';
import { eq } from 'drizzle-orm';

// Test input for creating a user
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'FINANCE'
};

// Test input for creating a partner (prerequisite)
const testPartnerData = {
  name: 'Test Partner',
  email: 'partner@example.com',
  has_usd_account: true,
  has_pkr_account: false
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const result = await createUser(testUserInput);

      expect(result.email).toEqual('test@example.com');
      expect(result.name).toEqual('Test User');
      expect(result.role).toEqual('FINANCE');
      expect(result.partner_id).toBeNull();
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a user with partner association', async () => {
      // Create prerequisite partner
      const partnerResult = await db.insert(partnersTable)
        .values(testPartnerData)
        .returning()
        .execute();

      const userInput: CreateUserInput = {
        ...testUserInput,
        role: 'PARTNER',
        partner_id: partnerResult[0].id
      };

      const result = await createUser(userInput);

      expect(result.role).toEqual('PARTNER');
      expect(result.partner_id).toEqual(partnerResult[0].id);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].name).toEqual('Test User');
      expect(users[0].role).toEqual('FINANCE');
      expect(users[0].is_active).toBe(true);
    });

    it('should throw error for duplicate email', async () => {
      await createUser(testUserInput);

      await expect(createUser(testUserInput)).rejects.toThrow(/already exists/i);
    });

    it('should throw error for invalid partner_id', async () => {
      const userInput: CreateUserInput = {
        ...testUserInput,
        partner_id: 999
      };

      await expect(createUser(userInput)).rejects.toThrow(/partner.*not found/i);
    });
  });

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const result = await getUsers();
      expect(result).toEqual([]);
    });

    it('should return all users', async () => {
      await createUser(testUserInput);
      await createUser({
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'ADMIN'
      });

      const result = await getUsers();

      expect(result).toHaveLength(2);
      expect(result.map(u => u.email)).toContain('test@example.com');
      expect(result.map(u => u.email)).toContain('admin@example.com');
    });

    it('should include inactive users', async () => {
      const user = await createUser(testUserInput);
      await deactivateUser(user.id);

      const result = await getUsers();

      expect(result).toHaveLength(1);
      expect(result[0].is_active).toBe(false);
    });
  });

  describe('getUser', () => {
    it('should return user by ID', async () => {
      const createdUser = await createUser(testUserInput);

      const result = await getUser(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdUser.id);
      expect(result!.email).toEqual('test@example.com');
      expect(result!.name).toEqual('Test User');
    });

    it('should return null for non-existent user', async () => {
      const result = await getUser(999);
      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      await createUser(testUserInput);

      const result = await getUserByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result!.email).toEqual('test@example.com');
      expect(result!.name).toEqual('Test User');
      expect(result!.role).toEqual('FINANCE');
    });

    it('should return null for non-existent email', async () => {
      const result = await getUserByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should be case sensitive', async () => {
      await createUser(testUserInput);

      const result = await getUserByEmail('TEST@EXAMPLE.COM');
      expect(result).toBeNull();
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const user = await createUser(testUserInput);

      const result = await updateUserRole(user.id, 'ADMIN');

      expect(result.role).toEqual('ADMIN');
      expect(result.partner_id).toBeNull();
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.updated_at > user.updated_at).toBe(true);
    });

    it('should update user role and partner association', async () => {
      // Create prerequisite partner
      const partnerResult = await db.insert(partnersTable)
        .values(testPartnerData)
        .returning()
        .execute();

      const user = await createUser(testUserInput);

      const result = await updateUserRole(user.id, 'PARTNER', partnerResult[0].id);

      expect(result.role).toEqual('PARTNER');
      expect(result.partner_id).toEqual(partnerResult[0].id);
    });

    it('should update role and clear partner association', async () => {
      // Create prerequisite partner
      const partnerResult = await db.insert(partnersTable)
        .values(testPartnerData)
        .returning()
        .execute();

      const userInput: CreateUserInput = {
        ...testUserInput,
        partner_id: partnerResult[0].id
      };

      const user = await createUser(userInput);

      const result = await updateUserRole(user.id, 'ADMIN');

      expect(result.role).toEqual('ADMIN');
      expect(result.partner_id).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      await expect(updateUserRole(999, 'ADMIN')).rejects.toThrow(/user.*not found/i);
    });

    it('should throw error for invalid partner_id', async () => {
      const user = await createUser(testUserInput);

      await expect(updateUserRole(user.id, 'PARTNER', 999)).rejects.toThrow(/partner.*not found/i);
    });

    it('should update database correctly', async () => {
      const user = await createUser(testUserInput);

      await updateUserRole(user.id, 'AUDITOR');

      const updatedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();

      expect(updatedUser[0].role).toEqual('AUDITOR');
      expect(updatedUser[0].updated_at > user.updated_at).toBe(true);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      const user = await createUser(testUserInput);

      const result = await deactivateUser(user.id);

      expect(result).toBe(true);

      // Verify user is deactivated in database
      const deactivatedUser = await getUser(user.id);
      expect(deactivatedUser!.is_active).toBe(false);
      expect(deactivatedUser!.updated_at > user.updated_at).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(deactivateUser(999)).rejects.toThrow(/user.*not found/i);
    });

    it('should update database correctly', async () => {
      const user = await createUser(testUserInput);

      await deactivateUser(user.id);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();

      expect(users[0].is_active).toBe(false);
      expect(users[0].updated_at > user.updated_at).toBe(true);
    });

    it('should handle already deactivated user', async () => {
      const user = await createUser(testUserInput);
      await deactivateUser(user.id);

      const result = await deactivateUser(user.id);
      expect(result).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple role changes', async () => {
      // Create prerequisite partner
      const partnerResult = await db.insert(partnersTable)
        .values(testPartnerData)
        .returning()
        .execute();

      const user = await createUser(testUserInput);

      // Change to partner role
      await updateUserRole(user.id, 'PARTNER', partnerResult[0].id);
      
      // Change back to finance role
      const finalResult = await updateUserRole(user.id, 'FINANCE');

      expect(finalResult.role).toEqual('FINANCE');
      expect(finalResult.partner_id).toBeNull();
    });

    it('should maintain user data integrity across operations', async () => {
      const user = await createUser(testUserInput);
      const originalEmail = user.email;
      const originalName = user.name;

      // Update role
      await updateUserRole(user.id, 'ADMIN');

      // Deactivate user
      await deactivateUser(user.id);

      // Verify original data is preserved
      const finalUser = await getUser(user.id);
      expect(finalUser!.email).toEqual(originalEmail);
      expect(finalUser!.name).toEqual(originalName);
      expect(finalUser!.role).toEqual('ADMIN');
      expect(finalUser!.is_active).toBe(false);
    });
  });
});