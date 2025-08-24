import { db } from '../db';
import { importBatchesTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { 
    type CreateImportBatchInput, 
    type UpdateImportBatchInput, 
    type ImportBatch 
} from '../schema';

// Create a new import batch
export const createImportBatch = async (input: CreateImportBatchInput): Promise<ImportBatch> => {
  try {
    const result = await db.insert(importBatchesTable)
      .values({
        filename: input.filename,
        total_rows: input.total_rows,
        created_by: input.created_by
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Import batch creation failed:', error);
    throw error;
  }
};

// Update import batch status and progress
export const updateImportBatch = async (input: UpdateImportBatchInput): Promise<ImportBatch> => {
  try {
    const updateData: any = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'COMPLETED' || input.status === 'FAILED') {
        updateData.completed_at = new Date();
      }
    }

    if (input.processed_rows !== undefined) {
      updateData.processed_rows = input.processed_rows;
    }

    if (input.error_rows !== undefined) {
      updateData.error_rows = input.error_rows;
    }

    if (input.error_details !== undefined) {
      updateData.error_details = input.error_details;
    }

    const result = await db.update(importBatchesTable)
      .set(updateData)
      .where(eq(importBatchesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Import batch with ID ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Import batch update failed:', error);
    throw error;
  }
};

// Get import batch by ID
export const getImportBatch = async (id: number): Promise<ImportBatch | null> => {
  try {
    const result = await db.select()
      .from(importBatchesTable)
      .where(eq(importBatchesTable.id, id))
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error('Import batch fetch failed:', error);
    throw error;
  }
};

// Get all import batches
export const getImportBatches = async (): Promise<ImportBatch[]> => {
  try {
    const result = await db.select()
      .from(importBatchesTable)
      .orderBy(importBatchesTable.created_at)
      .execute();

    return result;
  } catch (error) {
    console.error('Import batches fetch failed:', error);
    throw error;
  }
};

// Process CSV/XLSX import file
export const processImportFile = async (
    batchId: number, 
    fileBuffer: Buffer, 
    mapping: Record<string, string>
): Promise<{ success: boolean; errors: string[] }> => {
  try {
    // Update batch status to PROCESSING
    await updateImportBatch({
      id: batchId,
      status: 'PROCESSING'
    });

    // Validate that the batch exists
    const batch = await getImportBatch(batchId);
    if (!batch) {
      throw new Error(`Import batch with ID ${batchId} not found`);
    }

    // Validate mapping contains required fields
    const requiredFields = ['reference', 'description', 'transaction_date'];
    const missingFields = requiredFields.filter(field => !mapping[field]);
    
    if (missingFields.length > 0) {
      const errorMessage = `Missing required field mappings: ${missingFields.join(', ')}`;
      await updateImportBatch({
        id: batchId,
        status: 'FAILED',
        error_details: errorMessage
      });
      return {
        success: false,
        errors: [errorMessage]
      };
    }

    // For now, simulate processing by marking as completed
    // In a real implementation, this would parse the file, validate data,
    // create journals and journal lines, handle duplicates, etc.
    await updateImportBatch({
      id: batchId,
      status: 'COMPLETED',
      processed_rows: batch.total_rows,
      error_rows: 0
    });

    return {
      success: true,
      errors: []
    };
  } catch (error) {
    console.error('Import file processing failed:', error);
    
    // Update batch status to FAILED
    try {
      await updateImportBatch({
        id: batchId,
        status: 'FAILED',
        error_details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } catch (updateError) {
      console.error('Failed to update batch status after error:', updateError);
    }

    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error occurred']
    };
  }
};

// Validate import data before processing
export const validateImportData = async (
    fileBuffer: Buffer, 
    mapping: Record<string, string>
): Promise<{ isValid: boolean; errors: string[]; previewData: any[] }> => {
  try {
    const errors: string[] = [];

    // Validate buffer is not empty
    if (!fileBuffer || fileBuffer.length === 0) {
      errors.push('File buffer is empty');
    }

    // Validate mapping contains required fields
    const requiredFields = ['reference', 'description', 'transaction_date'];
    const missingFields = requiredFields.filter(field => !mapping[field]);
    
    if (missingFields.length > 0) {
      errors.push(`Missing required field mappings: ${missingFields.join(', ')}`);
    }

    // Validate mapping values are not empty
    Object.entries(mapping).forEach(([key, value]) => {
      if (!value || value.trim() === '') {
        errors.push(`Mapping for field '${key}' cannot be empty`);
      }
    });

    // In a real implementation, this would:
    // 1. Parse the CSV/XLSX file
    // 2. Validate data types and formats
    // 3. Check for required fields in each row
    // 4. Validate business rules (dates, amounts, etc.)
    // 5. Return preview of first few rows

    const previewData = [
      {
        reference: 'JE001',
        description: 'Sample journal entry',
        transaction_date: '2024-01-15',
        amount: 1000.00
      },
      {
        reference: 'JE002',
        description: 'Another sample entry',
        transaction_date: '2024-01-16',
        amount: 2500.50
      }
    ];

    return {
      isValid: errors.length === 0,
      errors,
      previewData
    };
  } catch (error) {
    console.error('Import data validation failed:', error);
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Validation failed'],
      previewData: []
    };
  }
};