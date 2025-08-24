import { db } from '../db';
import { capitalMovementsTable, fxRatesTable } from '../db/schema';
import { type CreateCapitalMovementInput, type CapitalMovement } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

// Create a new capital movement (contribution or draw)
export async function createCapitalMovement(input: CreateCapitalMovementInput): Promise<CapitalMovement> {
  try {
    let fxRate: number | null = null;
    let amountBase: number;

    // Calculate base currency amount (PKR)
    if (input.currency === 'USD') {
      // Get current FX rate for the transaction date
      const transactionDateString = input.transaction_date.toISOString().split('T')[0];
      const fxRateRecord = await db.select()
        .from(fxRatesTable)
        .where(lte(fxRatesTable.date, transactionDateString))
        .orderBy(desc(fxRatesTable.date))
        .limit(1)
        .execute();

      if (fxRateRecord.length === 0) {
        throw new Error('No FX rate available for the transaction date');
      }

      fxRate = parseFloat(fxRateRecord[0].usd_to_pkr_rate);
      amountBase = input.amount * fxRate;
    } else {
      // PKR transaction - no conversion needed
      amountBase = input.amount;
    }

    // Insert capital movement record
    const result = await db.insert(capitalMovementsTable)
      .values({
        partner_id: input.partner_id,
        movement_type: input.movement_type,
        amount: input.amount.toString(),
        currency: input.currency,
        amount_base: amountBase.toString(),
        fx_rate: fxRate ? fxRate.toString() : null,
        description: input.description,
        transaction_date: input.transaction_date.toISOString().split('T')[0],
        created_by: input.created_by
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const movement = result[0];
    return {
      ...movement,
      transaction_date: new Date(movement.transaction_date),
      amount: parseFloat(movement.amount),
      amount_base: parseFloat(movement.amount_base),
      fx_rate: movement.fx_rate ? parseFloat(movement.fx_rate) : null
    };
  } catch (error) {
    console.error('Capital movement creation failed:', error);
    throw error;
  }
}

// Get capital movements for a partner
export async function getPartnerCapitalMovements(partnerId: number): Promise<CapitalMovement[]> {
  try {
    const movements = await db.select()
      .from(capitalMovementsTable)
      .where(eq(capitalMovementsTable.partner_id, partnerId))
      .orderBy(desc(capitalMovementsTable.transaction_date))
      .execute();

    // Convert numeric fields back to numbers
    return movements.map(movement => ({
      ...movement,
      transaction_date: new Date(movement.transaction_date),
      amount: parseFloat(movement.amount),
      amount_base: parseFloat(movement.amount_base),
      fx_rate: movement.fx_rate ? parseFloat(movement.fx_rate) : null
    }));
  } catch (error) {
    console.error('Partner capital movements retrieval failed:', error);
    throw error;
  }
}

// Get all capital movements with optional filtering
export async function getCapitalMovements(filters?: {
  partnerId?: number;
  movementType?: string;
  fromDate?: Date;
  toDate?: Date;
}): Promise<CapitalMovement[]> {
  try {
    const conditions: SQL<unknown>[] = [];

    if (filters?.partnerId !== undefined) {
      conditions.push(eq(capitalMovementsTable.partner_id, filters.partnerId));
    }

    if (filters?.movementType) {
      conditions.push(eq(capitalMovementsTable.movement_type, filters.movementType as any));
    }

    if (filters?.fromDate) {
      conditions.push(gte(capitalMovementsTable.transaction_date, filters.fromDate.toISOString().split('T')[0]));
    }

    if (filters?.toDate) {
      conditions.push(lte(capitalMovementsTable.transaction_date, filters.toDate.toISOString().split('T')[0]));
    }

    // Build query with or without conditions
    const movements = conditions.length > 0 
      ? await db.select()
          .from(capitalMovementsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(capitalMovementsTable.transaction_date))
          .execute()
      : await db.select()
          .from(capitalMovementsTable)
          .orderBy(desc(capitalMovementsTable.transaction_date))
          .execute();

    // Convert numeric fields back to numbers
    return movements.map(movement => ({
      ...movement,
      transaction_date: new Date(movement.transaction_date),
      amount: parseFloat(movement.amount),
      amount_base: parseFloat(movement.amount_base),
      fx_rate: movement.fx_rate ? parseFloat(movement.fx_rate) : null
    }));
  } catch (error) {
    console.error('Capital movements retrieval failed:', error);
    throw error;
  }
}

// Calculate partner capital balance
export async function getPartnerCapitalBalance(partnerId: number, asOfDate?: Date): Promise<{
  usdBalance: number;
  pkrBalance: number;
  totalBalancePkr: number;
}> {
  try {
    const conditions: SQL<unknown>[] = [
      eq(capitalMovementsTable.partner_id, partnerId)
    ];

    // Apply date filter if provided
    if (asOfDate) {
      conditions.push(lte(capitalMovementsTable.transaction_date, asOfDate.toISOString().split('T')[0]));
    }

    const movements = await db.select()
      .from(capitalMovementsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .execute();

    let usdBalance = 0;
    let pkrBalance = 0;

    // Calculate balances by currency
    movements.forEach(movement => {
      const amount = parseFloat(movement.amount);
      const isContribution = movement.movement_type === 'CONTRIBUTION';
      const adjustedAmount = isContribution ? amount : -amount;

      if (movement.currency === 'USD') {
        usdBalance += adjustedAmount;
      } else {
        pkrBalance += adjustedAmount;
      }
    });

    // Calculate total balance in PKR
    let totalBalancePkr = pkrBalance;

    // Convert USD balance to PKR using latest available rate
    if (usdBalance !== 0) {
      const dateToUse = asOfDate || new Date();
      const dateString = dateToUse.toISOString().split('T')[0];
      const fxRateRecord = await db.select()
        .from(fxRatesTable)
        .where(lte(fxRatesTable.date, dateString))
        .orderBy(desc(fxRatesTable.date))
        .limit(1)
        .execute();

      if (fxRateRecord.length > 0) {
        const fxRate = parseFloat(fxRateRecord[0].usd_to_pkr_rate);
        totalBalancePkr += usdBalance * fxRate;
      }
    }

    return {
      usdBalance,
      pkrBalance,
      totalBalancePkr
    };
  } catch (error) {
    console.error('Partner capital balance calculation failed:', error);
    throw error;
  }
}