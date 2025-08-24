import { db } from '../db';
import { accountsTable, partnersTable } from '../db/schema';
import { type CreateAccountInput, type Account } from '../schema';
import { eq, and } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

// Create a new account
export async function createAccount(input: CreateAccountInput): Promise<Account> {
  try {
    // Validate parent account exists if provided
    if (input.parent_account_id) {
      const parentAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, input.parent_account_id))
        .execute();
      
      if (parentAccount.length === 0) {
        throw new Error(`Parent account with ID ${input.parent_account_id} does not exist`);
      }
    }

    // Validate partner exists if provided
    if (input.partner_id) {
      const partner = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, input.partner_id))
        .execute();
      
      if (partner.length === 0) {
        throw new Error(`Partner with ID ${input.partner_id} does not exist`);
      }
    }

    // Insert account record
    const result = await db.insert(accountsTable)
      .values({
        code: input.code,
        name: input.name,
        account_type: input.account_type,
        currency: input.currency,
        is_bank_account: input.is_bank_account || false,
        is_capital_account: input.is_capital_account || false,
        is_payroll_source: input.is_payroll_source || false,
        is_intercompany: input.is_intercompany || false,
        partner_id: input.partner_id || null,
        parent_account_id: input.parent_account_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Account creation failed:', error);
    throw error;
  }
}

// Get all accounts
export async function getAccounts(): Promise<Account[]> {
  try {
    const result = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.is_active, true))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    throw error;
  }
}

// Get accounts by type
export async function getAccountsByType(accountType: string): Promise<Account[]> {
  try {
    // Validate account type enum first
    const validAccountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'OTHER'];
    if (!validAccountTypes.includes(accountType)) {
      return []; // Return empty array for invalid types instead of throwing
    }

    const result = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.account_type, accountType as any),
          eq(accountsTable.is_active, true)
        )
      )
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch accounts by type:', error);
    throw error;
  }
}

// Get bank accounts
export async function getBankAccounts(): Promise<Account[]> {
  try {
    const result = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.is_bank_account, true),
          eq(accountsTable.is_active, true)
        )
      )
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch bank accounts:', error);
    throw error;
  }
}

// Get capital accounts for partners
export async function getCapitalAccounts(): Promise<Account[]> {
  try {
    const result = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.is_capital_account, true),
          eq(accountsTable.is_active, true)
        )
      )
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch capital accounts:', error);
    throw error;
  }
}

// Get payroll source accounts
export async function getPayrollSourceAccounts(): Promise<Account[]> {
  try {
    const result = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.is_payroll_source, true),
          eq(accountsTable.is_active, true)
        )
      )
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch payroll source accounts:', error);
    throw error;
  }
}