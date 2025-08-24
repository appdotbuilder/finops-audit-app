import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { employeesTable, accountsTable } from '../db/schema';
import { type CreateEmployeeInput, type Currency, type AccountType } from '../schema';
import { createEmployee, getEmployees, getEmployeesByCurrency, getEmployee } from '../handlers/employee_handlers';
import { eq } from 'drizzle-orm';

describe('Employee Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testAccountUSD: any;
  let testAccountPKR: any;

  beforeEach(async () => {
    // Create test accounts for funding
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'FUND-USD',
        name: 'USD Funding Account',
        account_type: 'ASSET' as AccountType,
        currency: 'USD' as Currency,
        is_payroll_source: true
      })
      .returning()
      .execute();

    const pkrAccount = await db.insert(accountsTable)
      .values({
        code: 'FUND-PKR',
        name: 'PKR Funding Account',
        account_type: 'ASSET' as AccountType,
        currency: 'PKR' as Currency,
        is_payroll_source: true
      })
      .returning()
      .execute();

    testAccountUSD = usdAccount[0];
    testAccountPKR = pkrAccount[0];
  });

  describe('createEmployee', () => {
    it('should create an employee with valid funding account', async () => {
      const input: CreateEmployeeInput = {
        name: 'John Doe',
        email: 'john.doe@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      };

      const result = await createEmployee(input);

      expect(result.id).toBeDefined();
      expect(result.name).toEqual('John Doe');
      expect(result.email).toEqual('john.doe@company.com');
      expect(result.salary_currency).toEqual('USD');
      expect(result.funding_account_id).toEqual(testAccountUSD.id);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save employee to database', async () => {
      const input: CreateEmployeeInput = {
        name: 'Jane Smith',
        email: 'jane.smith@company.com',
        salary_currency: 'PKR' as Currency,
        funding_account_id: testAccountPKR.id
      };

      const result = await createEmployee(input);

      const employees = await db.select()
        .from(employeesTable)
        .where(eq(employeesTable.id, result.id))
        .execute();

      expect(employees).toHaveLength(1);
      expect(employees[0].name).toEqual('Jane Smith');
      expect(employees[0].email).toEqual('jane.smith@company.com');
      expect(employees[0].salary_currency).toEqual('PKR');
      expect(employees[0].funding_account_id).toEqual(testAccountPKR.id);
    });

    it('should reject employee when funding account does not exist', async () => {
      const input: CreateEmployeeInput = {
        name: 'Invalid Employee',
        email: 'invalid@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: 99999
      };

      await expect(createEmployee(input)).rejects.toThrow(/Funding account with ID 99999 does not exist/);
    });

    it('should reject employee when currency mismatch', async () => {
      const input: CreateEmployeeInput = {
        name: 'Currency Mismatch',
        email: 'mismatch@company.com',
        salary_currency: 'PKR' as Currency,
        funding_account_id: testAccountUSD.id
      };

      await expect(createEmployee(input)).rejects.toThrow(/Funding account currency \(USD\) must match salary currency \(PKR\)/);
    });

    it('should enforce unique email constraint', async () => {
      const input1: CreateEmployeeInput = {
        name: 'First Employee',
        email: 'duplicate@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      };

      const input2: CreateEmployeeInput = {
        name: 'Second Employee',
        email: 'duplicate@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      };

      await createEmployee(input1);
      await expect(createEmployee(input2)).rejects.toThrow();
    });
  });

  describe('getEmployees', () => {
    it('should return empty array when no employees exist', async () => {
      const result = await getEmployees();
      expect(result).toEqual([]);
    });

    it('should return all employees', async () => {
      // Create test employees
      await createEmployee({
        name: 'Employee 1',
        email: 'emp1@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      });

      await createEmployee({
        name: 'Employee 2',
        email: 'emp2@company.com',
        salary_currency: 'PKR' as Currency,
        funding_account_id: testAccountPKR.id
      });

      const result = await getEmployees();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Employee 1');
      expect(result[1].name).toEqual('Employee 2');
    });

    it('should return employees with correct data types', async () => {
      await createEmployee({
        name: 'Test Employee',
        email: 'test@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      });

      const result = await getEmployees();

      expect(result).toHaveLength(1);
      expect(typeof result[0].id).toBe('number');
      expect(typeof result[0].name).toBe('string');
      expect(typeof result[0].email).toBe('string');
      expect(typeof result[0].salary_currency).toBe('string');
      expect(typeof result[0].funding_account_id).toBe('number');
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getEmployeesByCurrency', () => {
    beforeEach(async () => {
      // Create employees with different currencies
      await createEmployee({
        name: 'USD Employee 1',
        email: 'usd1@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      });

      await createEmployee({
        name: 'USD Employee 2',
        email: 'usd2@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      });

      await createEmployee({
        name: 'PKR Employee 1',
        email: 'pkr1@company.com',
        salary_currency: 'PKR' as Currency,
        funding_account_id: testAccountPKR.id
      });
    });

    it('should return employees with USD currency only', async () => {
      const result = await getEmployeesByCurrency('USD');

      expect(result).toHaveLength(2);
      expect(result[0].salary_currency).toEqual('USD');
      expect(result[1].salary_currency).toEqual('USD');
      expect(result[0].name).toEqual('USD Employee 1');
      expect(result[1].name).toEqual('USD Employee 2');
    });

    it('should return employees with PKR currency only', async () => {
      const result = await getEmployeesByCurrency('PKR');

      expect(result).toHaveLength(1);
      expect(result[0].salary_currency).toEqual('PKR');
      expect(result[0].name).toEqual('PKR Employee 1');
    });

    it('should return empty array when no employees match currency', async () => {
      // First, let's create only USD employees, then search for PKR employees
      await createEmployee({
        name: 'Another USD Employee',
        email: 'another.usd@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      });

      // Clear existing PKR employee from beforeEach
      await db.delete(employeesTable)
        .where(eq(employeesTable.name, 'PKR Employee 1'))
        .execute();

      // Now search for PKR employees (should be empty)
      const result = await getEmployeesByCurrency('PKR');
      expect(result).toEqual([]);
    });
  });

  describe('getEmployee', () => {
    let testEmployee: any;

    beforeEach(async () => {
      testEmployee = await createEmployee({
        name: 'Test Employee',
        email: 'test.employee@company.com',
        salary_currency: 'USD' as Currency,
        funding_account_id: testAccountUSD.id
      });
    });

    it('should return employee by ID', async () => {
      const result = await getEmployee(testEmployee.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(testEmployee.id);
      expect(result!.name).toEqual('Test Employee');
      expect(result!.email).toEqual('test.employee@company.com');
      expect(result!.salary_currency).toEqual('USD');
      expect(result!.funding_account_id).toEqual(testAccountUSD.id);
    });

    it('should return null for non-existent employee', async () => {
      const result = await getEmployee(99999);
      expect(result).toBeNull();
    });

    it('should return employee with correct data types', async () => {
      const result = await getEmployee(testEmployee.id);

      expect(result).not.toBeNull();
      expect(typeof result!.id).toBe('number');
      expect(typeof result!.name).toBe('string');
      expect(typeof result!.email).toBe('string');
      expect(typeof result!.salary_currency).toBe('string');
      expect(typeof result!.funding_account_id).toBe('number');
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });
  });
});