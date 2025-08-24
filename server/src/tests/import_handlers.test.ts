import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, importBatchesTable } from '../db/schema';
import { 
  createImportBatch,
  updateImportBatch,
  getImportBatch,
  getImportBatches,
  processImportFile,
  validateImportData
} from '../handlers/import_handlers';
import { 
  type CreateImportBatchInput,
  type UpdateImportBatchInput
} from '../schema';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'ADMIN' as const,
  is_active: true
};

const testImportBatchInput: CreateImportBatchInput = {
  filename: 'test-import.csv',
  total_rows: 100,
  created_by: 1
};

describe('Import Handlers', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    testUserId = userResult[0].id;
    
    // Update test input with actual user ID
    testImportBatchInput.created_by = testUserId;
  });

  afterEach(resetDB);

  describe('createImportBatch', () => {
    it('should create an import batch successfully', async () => {
      const result = await createImportBatch(testImportBatchInput);

      expect(result.id).toBeDefined();
      expect(result.filename).toEqual('test-import.csv');
      expect(result.total_rows).toEqual(100);
      expect(result.processed_rows).toEqual(0);
      expect(result.error_rows).toEqual(0);
      expect(result.status).toEqual('PENDING');
      expect(result.created_by).toEqual(testUserId);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.completed_at).toBeNull();
      expect(result.error_details).toBeNull();
    });

    it('should save import batch to database', async () => {
      const result = await createImportBatch(testImportBatchInput);

      const batches = await db.select()
        .from(importBatchesTable)
        .where(eq(importBatchesTable.id, result.id))
        .execute();

      expect(batches).toHaveLength(1);
      expect(batches[0].filename).toEqual('test-import.csv');
      expect(batches[0].total_rows).toEqual(100);
      expect(batches[0].status).toEqual('PENDING');
    });

    it('should throw error for invalid created_by user', async () => {
      const invalidInput = {
        ...testImportBatchInput,
        created_by: 99999
      };

      await expect(createImportBatch(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
    });
  });

  describe('updateImportBatch', () => {
    let batchId: number;

    beforeEach(async () => {
      const batch = await createImportBatch(testImportBatchInput);
      batchId = batch.id;
    });

    it('should update import batch status', async () => {
      const updateInput: UpdateImportBatchInput = {
        id: batchId,
        status: 'PROCESSING'
      };

      const result = await updateImportBatch(updateInput);

      expect(result.id).toEqual(batchId);
      expect(result.status).toEqual('PROCESSING');
      expect(result.completed_at).toBeNull();
    });

    it('should update processed and error rows', async () => {
      const updateInput: UpdateImportBatchInput = {
        id: batchId,
        processed_rows: 80,
        error_rows: 5
      };

      const result = await updateImportBatch(updateInput);

      expect(result.processed_rows).toEqual(80);
      expect(result.error_rows).toEqual(5);
    });

    it('should set completed_at when status is COMPLETED', async () => {
      const updateInput: UpdateImportBatchInput = {
        id: batchId,
        status: 'COMPLETED',
        processed_rows: 100
      };

      const result = await updateImportBatch(updateInput);

      expect(result.status).toEqual('COMPLETED');
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('should set completed_at when status is FAILED', async () => {
      const updateInput: UpdateImportBatchInput = {
        id: batchId,
        status: 'FAILED',
        error_details: 'Processing failed'
      };

      const result = await updateImportBatch(updateInput);

      expect(result.status).toEqual('FAILED');
      expect(result.error_details).toEqual('Processing failed');
      expect(result.completed_at).toBeInstanceOf(Date);
    });

    it('should update error details', async () => {
      const updateInput: UpdateImportBatchInput = {
        id: batchId,
        error_details: 'Sample error message'
      };

      const result = await updateImportBatch(updateInput);

      expect(result.error_details).toEqual('Sample error message');
    });

    it('should throw error for non-existent batch ID', async () => {
      const updateInput: UpdateImportBatchInput = {
        id: 99999,
        status: 'PROCESSING'
      };

      await expect(updateImportBatch(updateInput)).rejects.toThrow(/not found/i);
    });
  });

  describe('getImportBatch', () => {
    let batchId: number;

    beforeEach(async () => {
      const batch = await createImportBatch(testImportBatchInput);
      batchId = batch.id;
    });

    it('should get import batch by ID', async () => {
      const result = await getImportBatch(batchId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(batchId);
      expect(result!.filename).toEqual('test-import.csv');
      expect(result!.total_rows).toEqual(100);
    });

    it('should return null for non-existent batch ID', async () => {
      const result = await getImportBatch(99999);

      expect(result).toBeNull();
    });
  });

  describe('getImportBatches', () => {
    it('should return empty array when no batches exist', async () => {
      const result = await getImportBatches();

      expect(result).toEqual([]);
    });

    it('should get all import batches', async () => {
      // Create multiple batches
      await createImportBatch(testImportBatchInput);
      await createImportBatch({
        ...testImportBatchInput,
        filename: 'second-import.csv',
        total_rows: 50
      });

      const result = await getImportBatches();

      expect(result).toHaveLength(2);
      expect(result[0].filename).toEqual('test-import.csv');
      expect(result[1].filename).toEqual('second-import.csv');
    });

    it('should return batches ordered by creation date', async () => {
      // Create batches with slight delay to ensure different timestamps
      const batch1 = await createImportBatch({
        ...testImportBatchInput,
        filename: 'first.csv'
      });
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const batch2 = await createImportBatch({
        ...testImportBatchInput,
        filename: 'second.csv'
      });

      const result = await getImportBatches();

      expect(result).toHaveLength(2);
      expect(result[0].created_at <= result[1].created_at).toBe(true);
    });
  });

  describe('processImportFile', () => {
    let batchId: number;
    const mockFileBuffer = Buffer.from('reference,description,date\nJE001,Test Entry,2024-01-15');
    const validMapping = {
      reference: 'reference',
      description: 'description',
      transaction_date: 'date'
    };

    beforeEach(async () => {
      const batch = await createImportBatch(testImportBatchInput);
      batchId = batch.id;
    });

    it('should process import file successfully', async () => {
      const result = await processImportFile(batchId, mockFileBuffer, validMapping);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);

      // Verify batch status was updated
      const updatedBatch = await getImportBatch(batchId);
      expect(updatedBatch!.status).toEqual('COMPLETED');
      expect(updatedBatch!.processed_rows).toEqual(100);
      expect(updatedBatch!.error_rows).toEqual(0);
      expect(updatedBatch!.completed_at).toBeInstanceOf(Date);
    });

    it('should fail when required field mappings are missing', async () => {
      const invalidMapping = {
        reference: 'reference'
        // Missing description and transaction_date
      };

      const result = await processImportFile(batchId, mockFileBuffer, invalidMapping);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/missing required field mappings/i);

      // Verify batch status was updated to FAILED
      const updatedBatch = await getImportBatch(batchId);
      expect(updatedBatch!.status).toEqual('FAILED');
      expect(updatedBatch!.error_details).toMatch(/missing required field mappings/i);
    });

    it('should fail for non-existent batch ID', async () => {
      const result = await processImportFile(99999, mockFileBuffer, validMapping);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/not found/i);
    });

    it('should handle processing workflow correctly', async () => {
      const result = await processImportFile(batchId, mockFileBuffer, validMapping);

      expect(result.success).toBe(true);
      
      // Verify final status is COMPLETED
      const finalBatch = await getImportBatch(batchId);
      expect(finalBatch!.status).toEqual('COMPLETED');
    });
  });

  describe('validateImportData', () => {
    const mockFileBuffer = Buffer.from('reference,description,date\nJE001,Test Entry,2024-01-15');
    const validMapping = {
      reference: 'reference',
      description: 'description',
      transaction_date: 'date'
    };

    it('should validate data successfully with valid input', async () => {
      const result = await validateImportData(mockFileBuffer, validMapping);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.previewData).toHaveLength(2);
      expect(result.previewData[0].reference).toEqual('JE001');
    });

    it('should fail validation with empty file buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await validateImportData(emptyBuffer, validMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('File buffer is empty'))).toBe(true);
      expect(result.previewData).toHaveLength(2); // Function still returns preview data
    });

    it('should fail validation with missing required field mappings', async () => {
      const invalidMapping = {
        reference: 'reference'
        // Missing description and transaction_date
      };

      const result = await validateImportData(mockFileBuffer, invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('Missing required field mappings'))).toBe(true);
    });

    it('should fail validation with empty mapping values', async () => {
      const invalidMapping = {
        reference: 'reference',
        description: '',
        transaction_date: '   '
      };

      const result = await validateImportData(mockFileBuffer, invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('cannot be empty'))).toBe(true);
    });

    it('should return preview data regardless of validation errors', async () => {
      const invalidMapping = {
        reference: ''
      };

      const result = await validateImportData(mockFileBuffer, invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.previewData).toHaveLength(2);
    });
  });
});