import { Router } from 'express';
import { VaultController } from '../controllers/vault.controller.js';
import { requireAuth, requireSession } from '../middleware/index.js';
import {
  createVaultSchema,
  updateVaultSchema,
  listVaultsSchema,
  idParamSchema,
  createFolderSchema,
  renameFolderSchema,
  moveFolderSchema,
} from '../validations/vault.validation.js';

const router = Router();
const vaultController = new VaultController();

// Validation Middleware
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    next(error);
  }
};

// All routes require authentication and an active session
router.use(requireAuth);
router.use(requireSession);

// =========================================================================
// Vault Routes
// =========================================================================
router.post('/vaults', validate(createVaultSchema), vaultController.createVault);
router.get('/vaults', validate(listVaultsSchema), vaultController.listVaults);
router.get('/vaults/:id', validate(idParamSchema), vaultController.getVaultDetails);
router.patch('/vaults/:id', validate(updateVaultSchema), vaultController.updateVault);
router.delete('/vaults/:id', validate(idParamSchema), vaultController.deleteVault);

// Archive and Restore Vaults
router.patch('/vaults/:id/archive', validate(idParamSchema), vaultController.archiveVault);
router.patch('/vaults/:id/restore', validate(idParamSchema), vaultController.restoreVault);

// =========================================================================
// Folder Routes
// =========================================================================
router.post('/folders', validate(createFolderSchema), vaultController.createFolder);
router.get('/folders/:id', validate(idParamSchema), vaultController.getFolderDetails);
router.get('/folders/:id/tree', validate(idParamSchema), vaultController.getFolderTree);
router.get('/folders/:id/breadcrumb', validate(idParamSchema), vaultController.getBreadcrumb);
router.get('/folders/:id/contents', validate(idParamSchema), vaultController.listFolderContents);
router.patch('/folders/:id', validate(renameFolderSchema), vaultController.renameFolder);
router.patch('/folders/:id/move', validate(moveFolderSchema), vaultController.moveFolder);
router.patch('/folders/:id/restore', validate(idParamSchema), vaultController.restoreFolder);
router.delete('/folders/:id', validate(idParamSchema), vaultController.deleteFolder);

export default router;
