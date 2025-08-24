import { db } from '../db';
import { employeesTable, accountsTable } from '../db/schema';
import { type CreateEmployeeInput, type Employee } from '../schema';
import { eq } from 'drizzle-orm';

// Create a new employee
export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  try {
    // Validate that the funding account exists and matches the salary currency
    const fundingAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, input.funding_account_id))
      .execute();

    if (fundingAccount.length === 0) {
      throw new Error(`Funding account with ID ${input.funding_account_id} does not exist`);
    }

    if (fundingAccount[0].currency !== input.salary_currency) {
      throw new Error(`Funding account currency (${fundingAccount[0].currency}) must match salary currency (${input.salary_currency})`);
    }

    // Create the employee
    const result = await db.insert(employeesTable)
      .values({
        name: input.name,
        email: input.email,
        salary_currency: input.salary_currency,
        funding_account_id: input.funding_account_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Employee creation failed:', error);
    throw error;
  }
}

// Get all employees
export async function getEmployees(): Promise<Employee[]> {
  try {
    const result = await db.select()
      .from(employeesTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    throw error;
  }
}

// Get employees by salary currency
export async function getEmployeesByCurrency(currency: string): Promise<Employee[]> {
  try {
    const result = await db.select()
      .from(employeesTable)
      .where(eq(employeesTable.salary_currency, currency as any))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch employees by currency:', error);
    throw error;
  }
}

// Get employee by ID
export async function getEmployee(id: number): Promise<Employee | null> {
  try {
    const result = await db.select()
      .from(employeesTable)
      .where(eq(employeesTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch employee:', error);
    throw error;
  }
}