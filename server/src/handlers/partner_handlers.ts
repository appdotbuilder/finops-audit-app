import { db } from '../db';
import { partnersTable, accountsTable, capitalMovementsTable, usersTable } from '../db/schema';
import { type CreatePartnerInput, type UpdatePartnerInput, type Partner } from '../schema';
import { eq, and } from 'drizzle-orm';

// Create a new partner
export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  try {
    // Validate that at least one account type is selected
    if (!input.has_usd_account && !input.has_pkr_account) {
      throw new Error('Partner must have at least one account type (USD or PKR)');
    }

    // Insert partner record
    const result = await db.insert(partnersTable)
      .values({
        name: input.name,
        email: input.email,
        has_usd_account: input.has_usd_account,
        has_pkr_account: input.has_pkr_account
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Partner creation failed:', error);
    throw error;
  }
}

// Get all partners
export async function getPartners(): Promise<Partner[]> {
  try {
    const result = await db.select()
      .from(partnersTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch partners:', error);
    throw error;
  }
}

// Get partner by ID
export async function getPartner(id: number): Promise<Partner | null> {
  try {
    const result = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch partner:', error);
    throw error;
  }
}

// Update partner
export async function updatePartner(input: UpdatePartnerInput): Promise<Partner> {
  try {
    // Check if partner exists
    const existingPartner = await getPartner(input.id);
    if (!existingPartner) {
      throw new Error(`Partner with ID ${input.id} not found`);
    }

    // Prepare update values - only include fields that are provided
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateValues.name = input.name;
    }
    if (input.email !== undefined) {
      updateValues.email = input.email;
    }
    if (input.has_usd_account !== undefined) {
      updateValues.has_usd_account = input.has_usd_account;
    }
    if (input.has_pkr_account !== undefined) {
      updateValues.has_pkr_account = input.has_pkr_account;
    }

    // Validate that at least one account type remains selected
    const finalHasUsd = input.has_usd_account !== undefined 
      ? input.has_usd_account 
      : existingPartner.has_usd_account;
    const finalHasPkr = input.has_pkr_account !== undefined 
      ? input.has_pkr_account 
      : existingPartner.has_pkr_account;

    if (!finalHasUsd && !finalHasPkr) {
      throw new Error('Partner must have at least one account type (USD or PKR)');
    }

    const result = await db.update(partnersTable)
      .set(updateValues)
      .where(eq(partnersTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Partner update failed:', error);
    throw error;
  }
}

// Delete partner (check dependencies first)
export async function deletePartner(id: number): Promise<boolean> {
  try {
    // Check if partner exists
    const existingPartner = await getPartner(id);
    if (!existingPartner) {
      throw new Error(`Partner with ID ${id} not found`);
    }

    // Check for dependent accounts
    const dependentAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.partner_id, id))
      .execute();

    if (dependentAccounts.length > 0) {
      throw new Error(`Cannot delete partner: ${dependentAccounts.length} associated accounts exist`);
    }

    // Check for dependent capital movements
    const dependentMovements = await db.select()
      .from(capitalMovementsTable)
      .where(eq(capitalMovementsTable.partner_id, id))
      .execute();

    if (dependentMovements.length > 0) {
      throw new Error(`Cannot delete partner: ${dependentMovements.length} associated capital movements exist`);
    }

    // Check for dependent users
    const dependentUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.partner_id, id))
      .execute();

    if (dependentUsers.length > 0) {
      throw new Error(`Cannot delete partner: ${dependentUsers.length} associated users exist`);
    }

    // Delete the partner
    await db.delete(partnersTable)
      .where(eq(partnersTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Partner deletion failed:', error);
    throw error;
  }
}