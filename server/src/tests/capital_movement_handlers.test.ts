import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, usersTable, fxRatesTable } from '../db/schema';
import { type CreateCapitalMovementInput } from '../schema';
import { 
  createCapitalMovement,
  getPartnerCapitalMovements,
  getCapitalMovements,
  getPartnerCapitalBalance
} from '../handlers/capital_movement_handlers';

// Test data setup
let testPartnerId: number;
let testUserId: number;

const setupTestData = async () => {
  // Create test partner
  const partner = await db.insert(partnersTable)
    .values({
      name: 'Test Partner',
      email: 'partner@test.com',
      has_usd_account: true,
      has_pkr_account: true
    })
    .returning()
    .execute();
  
  testPartnerId = partner[0].id;

  // Create test user
  const user = await db.insert(usersTable)
    .values({
      name: 'Test User',
      email: 'user@test.com',
      role: 'FINANCE'
    })
    .returning()
    .execute();
  
  testUserId = user[0].id;

  // Create test FX rate
  await db.insert(fxRatesTable)
    .values({
      date: '2024-01-01',
      usd_to_pkr_rate: '280.0000'
    })
    .execute();
};

describe('createCapitalMovement', () => {
  beforeEach(async () => {
    await createDB();
    await setupTestData();
  });
  
  afterEach(resetDB);

  it('should create a PKR capital contribution', async () => {
    const input: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'Initial capital contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    };

    const result = await createCapitalMovement(input);

    expect(result.partner_id).toBe(testPartnerId);
    expect(result.movement_type).toBe('CONTRIBUTION');
    expect(result.amount).toBe(100000);
    expect(result.currency).toBe('PKR');
    expect(result.amount_base).toBe(100000); // Same as amount for PKR
    expect(result.fx_rate).toBeNull(); // No FX rate for PKR
    expect(result.description).toBe('Initial capital contribution');
    expect(result.created_by).toBe(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a USD capital contribution with FX conversion', async () => {
    const input: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 1000,
      currency: 'USD',
      description: 'USD capital contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    };

    const result = await createCapitalMovement(input);

    expect(result.partner_id).toBe(testPartnerId);
    expect(result.movement_type).toBe('CONTRIBUTION');
    expect(result.amount).toBe(1000);
    expect(result.currency).toBe('USD');
    expect(result.amount_base).toBe(280000); // 1000 * 280 FX rate
    expect(result.fx_rate).toBe(280);
    expect(result.description).toBe('USD capital contribution');
    expect(result.created_by).toBe(testUserId);
  });

  it('should create a capital draw', async () => {
    const input: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 50000,
      currency: 'PKR',
      description: 'Partner draw',
      transaction_date: new Date('2024-01-20'),
      created_by: testUserId
    };

    const result = await createCapitalMovement(input);

    expect(result.movement_type).toBe('DRAW');
    expect(result.amount).toBe(50000);
    expect(result.currency).toBe('PKR');
    expect(result.description).toBe('Partner draw');
  });

  it('should throw error when no FX rate available for USD transaction', async () => {
    const input: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 1000,
      currency: 'USD',
      description: 'USD contribution without FX rate',
      transaction_date: new Date('2023-12-01'), // Before our test FX rate
      created_by: testUserId
    };

    await expect(createCapitalMovement(input)).rejects.toThrow(/No FX rate available/i);
  });
});

describe('getPartnerCapitalMovements', () => {
  beforeEach(async () => {
    await createDB();
    await setupTestData();
  });
  
  afterEach(resetDB);

  it('should return capital movements for a partner', async () => {
    // Create test movements
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'First contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 25000,
      currency: 'PKR',
      description: 'First draw',
      transaction_date: new Date('2024-01-20'),
      created_by: testUserId
    });

    const movements = await getPartnerCapitalMovements(testPartnerId);

    expect(movements).toHaveLength(2);
    expect(movements[0].transaction_date >= movements[1].transaction_date).toBe(true); // Ordered by date desc
    
    // Verify numeric conversions
    movements.forEach(movement => {
      expect(typeof movement.amount).toBe('number');
      expect(typeof movement.amount_base).toBe('number');
      expect(movement.fx_rate === null || typeof movement.fx_rate === 'number').toBe(true);
    });
  });

  it('should return empty array for partner with no movements', async () => {
    const movements = await getPartnerCapitalMovements(testPartnerId);
    expect(movements).toHaveLength(0);
  });
});

describe('getCapitalMovements', () => {
  beforeEach(async () => {
    await createDB();
    await setupTestData();
  });
  
  afterEach(resetDB);

  it('should return all capital movements without filters', async () => {
    // Create test movements
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'Contribution 1',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 1000,
      currency: 'USD',
      description: 'Draw 1',
      transaction_date: new Date('2024-01-20'),
      created_by: testUserId
    });

    const movements = await getCapitalMovements();

    expect(movements).toHaveLength(2);
    expect(movements[0].transaction_date >= movements[1].transaction_date).toBe(true); // Ordered by date desc
  });

  it('should filter by partner ID', async () => {
    // Create another partner
    const partner2 = await db.insert(partnersTable)
      .values({
        name: 'Partner 2',
        email: 'partner2@test.com',
        has_usd_account: false,
        has_pkr_account: true
      })
      .returning()
      .execute();

    // Create movements for both partners
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'Partner 1 contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: partner2[0].id,
      movement_type: 'CONTRIBUTION',
      amount: 50000,
      currency: 'PKR',
      description: 'Partner 2 contribution',
      transaction_date: new Date('2024-01-16'),
      created_by: testUserId
    });

    const movements = await getCapitalMovements({ partnerId: testPartnerId });

    expect(movements).toHaveLength(1);
    expect(movements[0].partner_id).toBe(testPartnerId);
  });

  it('should filter by movement type', async () => {
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'Contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 25000,
      currency: 'PKR',
      description: 'Draw',
      transaction_date: new Date('2024-01-20'),
      created_by: testUserId
    });

    const contributions = await getCapitalMovements({ movementType: 'CONTRIBUTION' });
    const draws = await getCapitalMovements({ movementType: 'DRAW' });

    expect(contributions).toHaveLength(1);
    expect(contributions[0].movement_type).toBe('CONTRIBUTION');
    expect(draws).toHaveLength(1);
    expect(draws[0].movement_type).toBe('DRAW');
  });

  it('should filter by date range', async () => {
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'Early contribution',
      transaction_date: new Date('2024-01-10'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 50000,
      currency: 'PKR',
      description: 'Late contribution',
      transaction_date: new Date('2024-01-25'),
      created_by: testUserId
    });

    const movements = await getCapitalMovements({
      fromDate: new Date('2024-01-15'),
      toDate: new Date('2024-01-31')
    });

    expect(movements).toHaveLength(1);
    expect(movements[0].description).toBe('Late contribution');
  });
});

describe('getPartnerCapitalBalance', () => {
  beforeEach(async () => {
    await createDB();
    await setupTestData();
  });
  
  afterEach(resetDB);

  it('should calculate balance for PKR movements only', async () => {
    // Create PKR movements
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'PKR contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 25000,
      currency: 'PKR',
      description: 'PKR draw',
      transaction_date: new Date('2024-01-20'),
      created_by: testUserId
    });

    const balance = await getPartnerCapitalBalance(testPartnerId);

    expect(balance.usdBalance).toBe(0);
    expect(balance.pkrBalance).toBe(75000); // 100000 - 25000
    expect(balance.totalBalancePkr).toBe(75000);
  });

  it('should calculate balance for USD movements only', async () => {
    // Create USD movements
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 1000,
      currency: 'USD',
      description: 'USD contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 250,
      currency: 'USD',
      description: 'USD draw',
      transaction_date: new Date('2024-01-20'),
      created_by: testUserId
    });

    const balance = await getPartnerCapitalBalance(testPartnerId);

    expect(balance.usdBalance).toBe(750); // 1000 - 250
    expect(balance.pkrBalance).toBe(0);
    expect(balance.totalBalancePkr).toBe(210000); // 750 * 280 FX rate
  });

  it('should calculate balance for mixed currency movements', async () => {
    // Create mixed currency movements
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 1000,
      currency: 'USD',
      description: 'USD contribution',
      transaction_date: new Date('2024-01-15'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 50000,
      currency: 'PKR',
      description: 'PKR contribution',
      transaction_date: new Date('2024-01-16'),
      created_by: testUserId
    });

    const balance = await getPartnerCapitalBalance(testPartnerId);

    expect(balance.usdBalance).toBe(1000);
    expect(balance.pkrBalance).toBe(50000);
    expect(balance.totalBalancePkr).toBe(330000); // 50000 + (1000 * 280)
  });

  it('should filter by as of date', async () => {
    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'CONTRIBUTION',
      amount: 100000,
      currency: 'PKR',
      description: 'Early contribution',
      transaction_date: new Date('2024-01-10'),
      created_by: testUserId
    });

    await createCapitalMovement({
      partner_id: testPartnerId,
      movement_type: 'DRAW',
      amount: 25000,
      currency: 'PKR',
      description: 'Late draw',
      transaction_date: new Date('2024-01-25'),
      created_by: testUserId
    });

    // Balance as of Jan 15 should only include the early contribution
    const balance = await getPartnerCapitalBalance(testPartnerId, new Date('2024-01-15'));

    expect(balance.pkrBalance).toBe(100000);
    expect(balance.totalBalancePkr).toBe(100000);
  });

  it('should return zero balances for partner with no movements', async () => {
    const balance = await getPartnerCapitalBalance(testPartnerId);

    expect(balance.usdBalance).toBe(0);
    expect(balance.pkrBalance).toBe(0);
    expect(balance.totalBalancePkr).toBe(0);
  });
});