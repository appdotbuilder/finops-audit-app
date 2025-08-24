import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, accountsTable, capitalMovementsTable, usersTable, accountTypeEnum, currencyEnum, capitalMovementTypeEnum, roleEnum } from '../db/schema';
import { type CreatePartnerInput, type UpdatePartnerInput } from '../schema';
import { 
  createPartner, 
  getPartners, 
  getPartner, 
  updatePartner, 
  deletePartner 
} from '../handlers/partner_handlers';
import { eq } from 'drizzle-orm';

// Test inputs
const testPartnerInput: CreatePartnerInput = {
  name: 'Test Partner',
  email: 'test@partner.com',
  has_usd_account: true,
  has_pkr_account: false
};

const testPartnerWithBothAccounts: CreatePartnerInput = {
  name: 'Multi-Currency Partner',
  email: 'multi@partner.com',
  has_usd_account: true,
  has_pkr_account: true
};

describe('Partner Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPartner', () => {
    it('should create a partner with valid input', async () => {
      const result = await createPartner(testPartnerInput);

      expect(result.name).toEqual('Test Partner');
      expect(result.email).toEqual('test@partner.com');
      expect(result.has_usd_account).toEqual(true);
      expect(result.has_pkr_account).toEqual(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save partner to database', async () => {
      const result = await createPartner(testPartnerInput);

      const partners = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, result.id))
        .execute();

      expect(partners).toHaveLength(1);
      expect(partners[0].name).toEqual('Test Partner');
      expect(partners[0].email).toEqual('test@partner.com');
      expect(partners[0].has_usd_account).toEqual(true);
      expect(partners[0].has_pkr_account).toEqual(false);
    });

    it('should create partner with both account types', async () => {
      const result = await createPartner(testPartnerWithBothAccounts);

      expect(result.has_usd_account).toEqual(true);
      expect(result.has_pkr_account).toEqual(true);
    });

    it('should reject partner with no account types', async () => {
      const invalidInput: CreatePartnerInput = {
        name: 'Invalid Partner',
        email: 'invalid@partner.com',
        has_usd_account: false,
        has_pkr_account: false
      };

      await expect(createPartner(invalidInput)).rejects.toThrow(/must have at least one account type/i);
    });

    it('should reject duplicate email addresses', async () => {
      await createPartner(testPartnerInput);

      const duplicateInput: CreatePartnerInput = {
        name: 'Another Partner',
        email: 'test@partner.com', // Same email
        has_usd_account: true,
        has_pkr_account: false
      };

      await expect(createPartner(duplicateInput)).rejects.toThrow();
    });
  });

  describe('getPartners', () => {
    it('should return empty array when no partners exist', async () => {
      const result = await getPartners();
      expect(result).toEqual([]);
    });

    it('should return all partners', async () => {
      await createPartner(testPartnerInput);
      await createPartner(testPartnerWithBothAccounts);

      const result = await getPartners();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Partner');
      expect(result[1].name).toEqual('Multi-Currency Partner');
    });

    it('should return partners with correct structure', async () => {
      await createPartner(testPartnerInput);

      const result = await getPartners();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('has_usd_account');
      expect(result[0]).toHaveProperty('has_pkr_account');
      expect(result[0]).toHaveProperty('created_at');
      expect(result[0]).toHaveProperty('updated_at');
    });
  });

  describe('getPartner', () => {
    it('should return null for non-existent partner', async () => {
      const result = await getPartner(999);
      expect(result).toBeNull();
    });

    it('should return correct partner by ID', async () => {
      const created = await createPartner(testPartnerInput);

      const result = await getPartner(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Partner');
      expect(result!.email).toEqual('test@partner.com');
    });

    it('should return partner with all fields', async () => {
      const created = await createPartner(testPartnerWithBothAccounts);

      const result = await getPartner(created.id);

      expect(result!.has_usd_account).toEqual(true);
      expect(result!.has_pkr_account).toEqual(true);
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updatePartner', () => {
    it('should update partner name', async () => {
      const created = await createPartner(testPartnerInput);

      const updateInput: UpdatePartnerInput = {
        id: created.id,
        name: 'Updated Partner Name'
      };

      const result = await updatePartner(updateInput);

      expect(result.name).toEqual('Updated Partner Name');
      expect(result.email).toEqual('test@partner.com'); // Unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update partner email', async () => {
      const created = await createPartner(testPartnerInput);

      const updateInput: UpdatePartnerInput = {
        id: created.id,
        email: 'updated@partner.com'
      };

      const result = await updatePartner(updateInput);

      expect(result.email).toEqual('updated@partner.com');
      expect(result.name).toEqual('Test Partner'); // Unchanged
    });

    it('should update account type flags', async () => {
      const created = await createPartner(testPartnerInput);

      const updateInput: UpdatePartnerInput = {
        id: created.id,
        has_pkr_account: true
      };

      const result = await updatePartner(updateInput);

      expect(result.has_usd_account).toEqual(true); // Unchanged
      expect(result.has_pkr_account).toEqual(true); // Updated
    });

    it('should update multiple fields at once', async () => {
      const created = await createPartner(testPartnerInput);

      const updateInput: UpdatePartnerInput = {
        id: created.id,
        name: 'Completely Updated',
        email: 'new@email.com',
        has_pkr_account: true
      };

      const result = await updatePartner(updateInput);

      expect(result.name).toEqual('Completely Updated');
      expect(result.email).toEqual('new@email.com');
      expect(result.has_usd_account).toEqual(true); // Unchanged
      expect(result.has_pkr_account).toEqual(true); // Updated
    });

    it('should reject update that removes all account types', async () => {
      const created = await createPartner(testPartnerInput);

      const invalidUpdate: UpdatePartnerInput = {
        id: created.id,
        has_usd_account: false
        // has_pkr_account was already false
      };

      await expect(updatePartner(invalidUpdate)).rejects.toThrow(/must have at least one account type/i);
    });

    it('should reject update for non-existent partner', async () => {
      const updateInput: UpdatePartnerInput = {
        id: 999,
        name: 'Does Not Exist'
      };

      await expect(updatePartner(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should persist updates to database', async () => {
      const created = await createPartner(testPartnerInput);

      const updateInput: UpdatePartnerInput = {
        id: created.id,
        name: 'Database Updated'
      };

      await updatePartner(updateInput);

      const fromDb = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, created.id))
        .execute();

      expect(fromDb[0].name).toEqual('Database Updated');
    });
  });

  describe('deletePartner', () => {
    it('should delete partner with no dependencies', async () => {
      const created = await createPartner(testPartnerInput);

      const result = await deletePartner(created.id);

      expect(result).toEqual(true);

      // Verify deletion
      const fromDb = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, created.id))
        .execute();

      expect(fromDb).toHaveLength(0);
    });

    it('should reject deletion of non-existent partner', async () => {
      await expect(deletePartner(999)).rejects.toThrow(/not found/i);
    });

    it('should reject deletion when partner has dependent accounts', async () => {
      const partner = await createPartner(testPartnerInput);

      // Create dependent account
      await db.insert(accountsTable).values({
        code: 'TEST001',
        name: 'Test Account',
        account_type: 'ASSET',
        currency: 'USD',
        partner_id: partner.id
      }).execute();

      await expect(deletePartner(partner.id)).rejects.toThrow(/associated accounts exist/i);
    });

    it('should reject deletion when partner has dependent users', async () => {
      const partner = await createPartner(testPartnerInput);

      // Create dependent user
      await db.insert(usersTable).values({
        email: 'user@test.com',
        name: 'Test User',
        role: 'PARTNER',
        partner_id: partner.id
      }).execute();

      await expect(deletePartner(partner.id)).rejects.toThrow(/associated users exist/i);
    });

    it('should reject deletion when partner has capital movements', async () => {
      const partner = await createPartner(testPartnerInput);

      // Create a user to satisfy foreign key constraint
      const user = await db.insert(usersTable).values({
        email: 'creator@test.com',
        name: 'Creator User',
        role: 'ADMIN'
      }).returning().execute();

      // Create dependent capital movement
      await db.insert(capitalMovementsTable).values({
        partner_id: partner.id,
        movement_type: 'CONTRIBUTION',
        amount: '1000.00',
        currency: 'USD',
        amount_base: '1000.00',
        description: 'Test movement',
        transaction_date: '2024-01-01',
        created_by: user[0].id
      }).execute();

      await expect(deletePartner(partner.id)).rejects.toThrow(/associated capital movements exist/i);
    });
  });
});