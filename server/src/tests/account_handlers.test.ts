import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable, partnersTable } from '../db/schema';
import { type CreateAccountInput } from '../schema';
import { 
  createAccount, 
  getAccounts, 
  getAccountsByType, 
  getBankAccounts, 
  getCapitalAccounts, 
  getPayrollSourceAccounts 
} from '../handlers/account_handlers';
import { eq } from 'drizzle-orm';

describe('Account Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createAccount', () => {
    it('should create a basic account', async () => {
      const input: CreateAccountInput = {
        code: 'A001',
        name: 'Cash in Bank',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      };

      const result = await createAccount(input);

      expect(result.id).toBeDefined();
      expect(result.code).toEqual('A001');
      expect(result.name).toEqual('Cash in Bank');
      expect(result.account_type).toEqual('ASSET');
      expect(result.currency).toEqual('USD');
      expect(result.is_bank_account).toBe(true);
      expect(result.is_capital_account).toBe(false);
      expect(result.is_payroll_source).toBe(false);
      expect(result.is_intercompany).toBe(false);
      expect(result.partner_id).toBeNull();
      expect(result.parent_account_id).toBeNull();
      expect(result.is_active).toBe(true);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save account to database', async () => {
      const input: CreateAccountInput = {
        code: 'A002',
        name: 'Accounts Receivable',
        account_type: 'ASSET',
        currency: 'PKR',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: true
      };

      const result = await createAccount(input);

      const accounts = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, result.id))
        .execute();

      expect(accounts).toHaveLength(1);
      expect(accounts[0].code).toEqual('A002');
      expect(accounts[0].name).toEqual('Accounts Receivable');
      expect(accounts[0].account_type).toEqual('ASSET');
      expect(accounts[0].currency).toEqual('PKR');
      expect(accounts[0].is_intercompany).toBe(true);
    });

    it('should create account with parent account', async () => {
      // Create parent account first
      const parentInput: CreateAccountInput = {
        code: 'A100',
        name: 'Current Assets',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      };

      const parentAccount = await createAccount(parentInput);

      // Create child account
      const childInput: CreateAccountInput = {
        code: 'A101',
        name: 'Cash',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_account_id: parentAccount.id
      };

      const result = await createAccount(childInput);

      expect(result.parent_account_id).toEqual(parentAccount.id);
    });

    it('should create account with partner', async () => {
      // Create partner first
      const partner = await db.insert(partnersTable)
        .values({
          name: 'Test Partner',
          email: 'partner@test.com',
          has_usd_account: true,
          has_pkr_account: false
        })
        .returning()
        .execute();

      const input: CreateAccountInput = {
        code: 'E001',
        name: 'Partner Capital',
        account_type: 'EQUITY',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: true,
        is_payroll_source: false,
        is_intercompany: false,
        partner_id: partner[0].id
      };

      const result = await createAccount(input);

      expect(result.partner_id).toEqual(partner[0].id);
      expect(result.is_capital_account).toBe(true);
    });

    it('should throw error for non-existent parent account', async () => {
      const input: CreateAccountInput = {
        code: 'A999',
        name: 'Invalid Account',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_account_id: 99999
      };

      await expect(createAccount(input)).rejects.toThrow(/Parent account with ID 99999 does not exist/i);
    });

    it('should throw error for non-existent partner', async () => {
      const input: CreateAccountInput = {
        code: 'A998',
        name: 'Invalid Partner Account',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false,
        partner_id: 99999
      };

      await expect(createAccount(input)).rejects.toThrow(/Partner with ID 99999 does not exist/i);
    });

    it('should handle duplicate account code error', async () => {
      const input: CreateAccountInput = {
        code: 'DUP001',
        name: 'First Account',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      };

      await createAccount(input);

      // Try to create duplicate
      const duplicateInput: CreateAccountInput = {
        code: 'DUP001',
        name: 'Duplicate Account',
        account_type: 'LIABILITY',
        currency: 'PKR',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      };

      await expect(createAccount(duplicateInput)).rejects.toThrow();
    });
  });

  describe('getAccounts', () => {
    it('should return all active accounts', async () => {
      // Create test accounts
      await createAccount({
        code: 'A001',
        name: 'Cash',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      await createAccount({
        code: 'L001',
        name: 'Accounts Payable',
        account_type: 'LIABILITY',
        currency: 'PKR',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      const result = await getAccounts();

      expect(result).toHaveLength(2);
      expect(result[0].code).toEqual('A001');
      expect(result[1].code).toEqual('L001');
    });

    it('should only return active accounts', async () => {
      // Create active account
      const activeAccount = await createAccount({
        code: 'A001',
        name: 'Active Account',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      // Deactivate account directly in database
      await db.update(accountsTable)
        .set({ is_active: false })
        .where(eq(accountsTable.id, activeAccount.id))
        .execute();

      const result = await getAccounts();

      expect(result).toHaveLength(0);
    });
  });

  describe('getAccountsByType', () => {
    it('should return accounts filtered by type', async () => {
      // Create accounts of different types
      await createAccount({
        code: 'A001',
        name: 'Cash',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      await createAccount({
        code: 'L001',
        name: 'Accounts Payable',
        account_type: 'LIABILITY',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      await createAccount({
        code: 'A002',
        name: 'Inventory',
        account_type: 'ASSET',
        currency: 'PKR',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      const assetAccounts = await getAccountsByType('ASSET');
      const liabilityAccounts = await getAccountsByType('LIABILITY');

      expect(assetAccounts).toHaveLength(2);
      expect(liabilityAccounts).toHaveLength(1);
      expect(assetAccounts[0].account_type).toEqual('ASSET');
      expect(assetAccounts[1].account_type).toEqual('ASSET');
      expect(liabilityAccounts[0].account_type).toEqual('LIABILITY');
    });

    it('should return empty array for non-existent account type', async () => {
      const result = await getAccountsByType('NONEXISTENT');
      expect(result).toHaveLength(0);
    });

    it('should return correct results for valid account types', async () => {
      await createAccount({
        code: 'I001',
        name: 'Service Revenue',
        account_type: 'INCOME',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      const incomeAccounts = await getAccountsByType('INCOME');
      const expenseAccounts = await getAccountsByType('EXPENSE');
      
      expect(incomeAccounts).toHaveLength(1);
      expect(expenseAccounts).toHaveLength(0);
      expect(incomeAccounts[0].account_type).toEqual('INCOME');
    });
  });

  describe('getBankAccounts', () => {
    it('should return only bank accounts', async () => {
      // Create bank account
      await createAccount({
        code: 'A001',
        name: 'Chase Bank',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      // Create non-bank account
      await createAccount({
        code: 'A002',
        name: 'Accounts Receivable',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      const result = await getBankAccounts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Chase Bank');
      expect(result[0].is_bank_account).toBe(true);
    });
  });

  describe('getCapitalAccounts', () => {
    it('should return only capital accounts', async () => {
      // Create capital account
      await createAccount({
        code: 'E001',
        name: 'Partner Capital',
        account_type: 'EQUITY',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: true,
        is_payroll_source: false,
        is_intercompany: false
      });

      // Create non-capital account
      await createAccount({
        code: 'A001',
        name: 'Cash',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      const result = await getCapitalAccounts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Partner Capital');
      expect(result[0].is_capital_account).toBe(true);
    });
  });

  describe('getPayrollSourceAccounts', () => {
    it('should return only payroll source accounts', async () => {
      // Create payroll source account
      await createAccount({
        code: 'A001',
        name: 'Payroll Bank Account',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: true,
        is_intercompany: false
      });

      // Create non-payroll account
      await createAccount({
        code: 'A002',
        name: 'General Bank Account',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      const result = await getPayrollSourceAccounts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Payroll Bank Account');
      expect(result[0].is_payroll_source).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with invalid enum values to trigger database error
      const invalidInput = {
        code: 'INVALID',
        name: 'Invalid Account',
        account_type: 'INVALID_TYPE' as any, // Force invalid enum value
        currency: 'USD' as any,
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      };

      await expect(createAccount(invalidInput)).rejects.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should create complete account hierarchy', async () => {
      // Create parent account
      const parentAccount = await createAccount({
        code: 'A100',
        name: 'Current Assets',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: false
      });

      // Create multiple child accounts
      const cashAccount = await createAccount({
        code: 'A101',
        name: 'Cash',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: true,
        is_capital_account: false,
        is_payroll_source: true,
        is_intercompany: false,
        parent_account_id: parentAccount.id
      });

      const arAccount = await createAccount({
        code: 'A102',
        name: 'Accounts Receivable',
        account_type: 'ASSET',
        currency: 'USD',
        is_bank_account: false,
        is_capital_account: false,
        is_payroll_source: false,
        is_intercompany: true,
        parent_account_id: parentAccount.id
      });

      // Verify hierarchy
      expect(cashAccount.parent_account_id).toEqual(parentAccount.id);
      expect(arAccount.parent_account_id).toEqual(parentAccount.id);

      // Verify filtering works correctly
      const bankAccounts = await getBankAccounts();
      const payrollAccounts = await getPayrollSourceAccounts();
      const assetAccounts = await getAccountsByType('ASSET');

      expect(bankAccounts).toHaveLength(1);
      expect(payrollAccounts).toHaveLength(1);
      expect(assetAccounts).toHaveLength(3); // Parent + 2 children
      expect(bankAccounts[0].code).toEqual('A101');
      expect(payrollAccounts[0].code).toEqual('A101');
    });
  });
});