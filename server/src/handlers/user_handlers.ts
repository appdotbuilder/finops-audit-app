import { db } from '../db';
import { usersTable, partnersTable } from '../db/schema';
import { type CreateUserInput, type User, type Role } from '../schema';
import { eq } from 'drizzle-orm';

// Create a new user
export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Validate that partner exists if partner_id is provided
    if (input.partner_id) {
      const partner = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, input.partner_id))
        .execute();
      
      if (partner.length === 0) {
        throw new Error(`Partner with ID ${input.partner_id} not found`);
      }
    }

    // Check if user with email already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();
    
    if (existingUser.length > 0) {
      throw new Error(`User with email ${input.email} already exists`);
    }

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        name: input.name,
        role: input.role,
        partner_id: input.partner_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

// Get all users
export async function getUsers(): Promise<User[]> {
  try {
    const result = await db.select()
      .from(usersTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

// Get user by ID
export async function getUser(id: number): Promise<User | null> {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
}

// Get user by email (for authentication)
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch user by email:', error);
    throw error;
  }
}

// Update user role and permissions
export async function updateUserRole(userId: number, role: string, partnerId?: number): Promise<User> {
  try {
    // Validate that user exists
    const existingUser = await getUser(userId);
    if (!existingUser) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Validate that partner exists if partner_id is provided
    if (partnerId) {
      const partner = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, partnerId))
        .execute();
      
      if (partner.length === 0) {
        throw new Error(`Partner with ID ${partnerId} not found`);
      }
    }

    // Update user
    const result = await db.update(usersTable)
      .set({
        role: role as Role,
        partner_id: partnerId || null,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw error;
  }
}

// Deactivate user
export async function deactivateUser(userId: number): Promise<boolean> {
  try {
    // Validate that user exists
    const existingUser = await getUser(userId);
    if (!existingUser) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Update user to inactive
    await db.update(usersTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .execute();

    return true;
  } catch (error) {
    console.error('Failed to deactivate user:', error);
    throw error;
  }
}