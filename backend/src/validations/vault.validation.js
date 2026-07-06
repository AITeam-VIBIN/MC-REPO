import { z } from 'zod';

// UUID / Primary ID Schema
export const idParamSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID format.'),
});

// Create Vault Schema
export const createVaultSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, 'Vault name must be at least 3 characters long.').max(100, 'Vault name cannot exceed 100 characters.'),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters.').optional(),
    type: z.enum(['DEPARTMENT', 'PROJECT', 'CLIENT', 'CUSTOM']).default('CUSTOM'),
    departmentId: z.string().uuid('Department ID must be a valid UUID.').optional(),
  }),
});

// Update Vault Schema
export const updateVaultSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().trim().min(3, 'Vault name must be at least 3 characters long.').max(100, 'Vault name cannot exceed 100 characters.').optional(),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters.').optional(),
    type: z.enum(['DEPARTMENT', 'PROJECT', 'CLIENT', 'CUSTOM']).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED', 'DISABLED']).optional(),
    departmentId: z.string().uuid('Department ID must be a valid UUID.').optional(),
  }),
});

// List Vaults Query Schema
export const listVaultsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(['ACTIVE', 'ARCHIVED', 'DISABLED']).optional(),
    type: z.enum(['DEPARTMENT', 'PROJECT', 'CLIENT', 'CUSTOM']).optional(),
    search: z.string().trim().optional(),
  }).optional(),
});

// Create Folder Schema
export const createFolderSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Folder name is required.').max(100, 'Folder name cannot exceed 100 characters.'),
    parentId: z.string().uuid('Parent folder ID must be a valid UUID.').nullable().optional(),
    vaultId: z.string().uuid('Vault ID must be a valid UUID.').optional(),
    departmentId: z.string().uuid('Department ID must be a valid UUID.').optional(),
  }),
});

// Rename Folder Schema
export const renameFolderSchema = z.object({
  params: idParamSchema,
  body: z.object({
    name: z.string().trim().min(1, 'Folder name is required.').max(100, 'Folder name cannot exceed 100 characters.'),
  }),
});

// Move Folder Schema
export const moveFolderSchema = z.object({
  params: idParamSchema,
  body: z.object({
    parentId: z.string().uuid('Parent folder ID must be a valid UUID.').nullable(),
    vaultId: z.string().uuid('Vault ID must be a valid UUID.').optional(),
  }),
});
