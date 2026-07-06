import VaultService from '../services/vault.service.js';

const vaultService = new VaultService();

export class VaultController {
  // =========================================================================
  // Vault Actions
  // =========================================================================

  /**
   * Create a new Vault.
   * 
   * @async
   * @method createVault
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async createVault(req, res, next) {
    try {
      const ownerId = req.user?.id;
      const result = await vaultService.createVault({
        ...req.body,
        ownerId,
      });

      res.status(201).json({
        success: true,
        message: 'Vault created successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing Vault.
   * 
   * @async
   * @method updateVault
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async updateVault(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.updateVault(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Vault updated successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Archive an active Vault.
   * 
   * @async
   * @method archiveVault
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async archiveVault(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.archiveVault(id);

      res.status(200).json({
        success: true,
        message: 'Vault archived successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Restore an archived Vault.
   * 
   * @async
   * @method restoreVault
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async restoreVault(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.restoreVault(id);

      res.status(200).json({
        success: true,
        message: 'Vault restored successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Soft-delete a Vault.
   * 
   * @async
   * @method deleteVault
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async deleteVault(req, res, next) {
    try {
      const { id } = req.params;
      await vaultService.deleteVault(id);

      res.status(200).json({
        success: true,
        message: 'Vault deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List non-deleted Vaults.
   * 
   * @async
   * @method listVaults
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async listVaults(req, res, next) {
    try {
      const result = await vaultService.listVaults(req.query);

      res.status(200).json({
        success: true,
        message: 'Vaults listed successfully.',
        data: result.vaults,
        meta: {
          total: result.total,
          page: Number(req.query.page || 1),
          limit: Number(req.query.limit || 10),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch a Vault profile details.
   * 
   * @async
   * @method getVaultDetails
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async getVaultDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.getVaultDetails(id);

      res.status(200).json({
        success: true,
        message: 'Vault details retrieved successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // Folder Actions
  // =========================================================================

  /**
   * Create a new Folder.
   * 
   * @async
   * @method createFolder
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async createFolder(req, res, next) {
    try {
      const ownerId = req.user?.id;
      const result = await vaultService.createFolder({
        ...req.body,
        ownerId,
      });

      res.status(201).json({
        success: true,
        message: 'Folder created successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Rename a Folder.
   * 
   * @async
   * @method renameFolder
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async renameFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const result = await vaultService.renameFolder(id, name);

      res.status(200).json({
        success: true,
        message: 'Folder renamed successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Move a Folder into a target parent and/or vault.
   * 
   * @async
   * @method moveFolder
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async moveFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { parentId, vaultId } = req.body;
      const result = await vaultService.moveFolder(id, parentId, vaultId);

      res.status(200).json({
        success: true,
        message: 'Folder moved successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Soft-delete a Folder.
   * 
   * @async
   * @method deleteFolder
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async deleteFolder(req, res, next) {
    try {
      const { id } = req.params;
      await vaultService.deleteFolder(id);

      res.status(200).json({
        success: true,
        message: 'Folder deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Restore a soft-deleted Folder.
   * 
   * @async
   * @method restoreFolder
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async restoreFolder(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.restoreFolder(id);

      res.status(200).json({
        success: true,
        message: 'Folder restored successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List sub-folders and documents inside a folder.
   * 
   * @async
   * @method listFolderContents
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async listFolderContents(req, res, next) {
    try {
      const { id } = req.params;
      const { vaultId } = req.query;
      const result = await vaultService.listFolderContents(id, vaultId);

      res.status(200).json({
        success: true,
        message: 'Folder contents listed successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch hierarchical Folder tree.
   * 
   * @async
   * @method getFolderTree
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async getFolderTree(req, res, next) {
    try {
      const { vaultId } = req.query;
      const result = await vaultService.getFolderTree(vaultId);

      res.status(200).json({
        success: true,
        message: 'Folder tree generated successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve Breadcrumb path mapping back to root folder/vault.
   * 
   * @async
   * @method getBreadcrumb
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async getBreadcrumb(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.getBreadcrumb(id);

      res.status(200).json({
        success: true,
        message: 'Folder breadcrumb retrieved successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetch folder details.
   * 
   * @async
   * @method getFolderDetails
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async getFolderDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await vaultService.getFolderDetails(id);

      res.status(200).json({
        success: true,
        message: 'Folder details retrieved successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default VaultController;
