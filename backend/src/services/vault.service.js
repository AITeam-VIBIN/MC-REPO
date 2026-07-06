import { prisma } from '../config/database.js';
import VaultRepository from '../repositories/vault.repository.js';
import {
  generateHierarchyPath,
  validateHierarchyDepth,
  buildFolderTree,
  buildBreadcrumb,
} from '../utils/vault.util.js';

const vaultRepository = new VaultRepository();

export class VaultService {
  // =========================================================================
  // Vault Operations
  // =========================================================================

  /**
   * Create a new Vault.
   */
  async createVault(data) {
    if (data.type === 'DEPARTMENT' && !data.departmentId) {
      throw new Error('Department ID is required for DEPARTMENT type vaults.');
    }
    return vaultRepository.createVault(data);
  }

  /**
   * Update Vault configurations.
   */
  async updateVault(id, data) {
    const vault = await vaultRepository.findVault(id);
    if (!vault) throw new Error('Vault not found.');
    return vaultRepository.updateVault(id, data);
  }

  /**
   * Archive a Vault.
   */
  async archiveVault(id) {
    const vault = await vaultRepository.findVault(id);
    if (!vault) throw new Error('Vault not found.');
    return vaultRepository.archiveVault(id);
  }

  /**
   * Restore an archived Vault.
   */
  async restoreVault(id) {
    const vault = await prisma.vault.findUnique({ where: { id } });
    if (!vault) throw new Error('Vault not found.');
    return vaultRepository.updateVault(id, {
      status: 'ACTIVE',
      isArchived: false,
      isDeleted: false,
      deletedAt: null,
    });
  }

  /**
   * Soft-delete a Vault (updates flags and propagates to all child folders/documents).
   */
  async deleteVault(id) {
    const vault = await vaultRepository.findVault(id);
    if (!vault) throw new Error('Vault not found.');

    // 1. Soft-delete the Vault record itself
    const updatedVault = await vaultRepository.updateVault(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    // 2. Propagate soft-delete to all child folders in the vault
    await prisma.folder.updateMany({
      where: { vaultId: id, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // 3. Propagate soft-delete to all documents in the vault
    await prisma.document.updateMany({
      where: { vaultId: id, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return updatedVault;
  }

  /**
   * List non-deleted Vaults.
   */
  async listVaults(params) {
    return vaultRepository.listVaults(params);
  }

  /**
   * Fetch a Vault profile details.
   */
  async getVaultDetails(id) {
    const vault = await vaultRepository.findVault(id);
    if (!vault) throw new Error('Vault not found.');
    return vault;
  }

  // =========================================================================
  // Folder Operations
  // =========================================================================

  /**
   * Create a new Folder under parent folder and vault boundaries.
   */
  async createFolder(data) {
    let parentPath = '/';
    let vaultId = data.vaultId || null;

    if (data.parentId) {
      const parent = await vaultRepository.findFolderById(data.parentId);
      if (!parent) throw new Error('Parent folder not found.');
      parentPath = parent.path;
      vaultId = parent.vaultId || vaultId;
    }

    const calculatedPath = generateHierarchyPath(parentPath === '/' ? '' : parentPath, data.name);

    // 1. Validate hierarchy depth (maximum 10 levels deep)
    if (!validateHierarchyDepth(calculatedPath, 10)) {
      throw new Error('Nesting limit exceeded. Maximum folder depth is 10 levels.');
    }

    // 2. Prevent duplicate folder name within the same parent folder
    const duplicate = await vaultRepository.findByNameAndParent(data.name, data.parentId, vaultId);
    if (duplicate) {
      throw new Error(`A folder named "${data.name}" already exists in the target directory.`);
    }

    return vaultRepository.createFolder({
      ...data,
      vaultId,
      path: calculatedPath,
    });
  }

  /**
   * Rename a Folder and recursively update absolute paths for all descendants.
   */
  async renameFolder(id, name) {
    const folder = await vaultRepository.findFolderById(id);
    if (!folder) throw new Error('Folder not found.');

    if (folder.name === name) return folder;

    // Check for duplicates in the same parent directory
    const duplicate = await vaultRepository.findByNameAndParent(name, folder.parentId, folder.vaultId);
    if (duplicate) {
      throw new Error(`A folder named "${name}" already exists in the directory.`);
    }

    const oldPath = folder.path;
    const parentPath = folder.parentId 
      ? oldPath.slice(0, oldPath.lastIndexOf('/')) 
      : '';
    const newPath = generateHierarchyPath(parentPath, name);

    // 1. Update the folder name and path
    const updatedFolder = await vaultRepository.updateFolder(id, {
      name,
      path: newPath,
    });

    // 2. Recursively update all sub-folders paths
    const descendants = await vaultRepository.findDescendants(oldPath);
    for (const desc of descendants) {
      const relativeSuffix = desc.path.slice(oldPath.length);
      const descNewPath = newPath + relativeSuffix;
      await vaultRepository.updateFolder(desc.id, { path: descNewPath });
    }

    return updatedFolder;
  }

  /**
   * Move a Folder and propagate path changes for all descendants.
   */
  async moveFolder(id, parentId, vaultId) {
    const folder = await vaultRepository.findFolderById(id);
    if (!folder) throw new Error('Folder not found.');

    if (folder.id === parentId) {
      throw new Error('Cannot move a folder into itself.');
    }

    let parentPath = '/';
    let resolvedVaultId = vaultId || folder.vaultId;

    if (parentId) {
      const parent = await vaultRepository.findFolderById(parentId);
      if (!parent) throw new Error('Destination parent folder not found.');

      // Prevent circular parent-child relationships
      if (parent.path.startsWith(folder.path === '/' ? '/' : `${folder.path}/`) || parent.id === folder.id) {
        throw new Error('Cannot move a parent folder into one of its sub-folders.');
      }

      parentPath = parent.path;
      resolvedVaultId = parent.vaultId || resolvedVaultId;
    }

    const calculatedPath = generateHierarchyPath(parentPath === '/' ? '' : parentPath, folder.name);

    // 1. Validate hierarchy depth (maximum 10 levels deep)
    if (!validateHierarchyDepth(calculatedPath, 10)) {
      throw new Error('Move operations would exceed maximum allowed folder depth limits.');
    }

    // 2. Prevent duplicate folder name in destination
    const duplicate = await vaultRepository.findByNameAndParent(folder.name, parentId, resolvedVaultId);
    if (duplicate && duplicate.id !== folder.id) {
      throw new Error(`A folder named "${folder.name}" already exists in the destination folder.`);
    }

    const oldPath = folder.path;

    // 3. Move the folder
    const movedFolder = await vaultRepository.moveFolder(id, parentId, resolvedVaultId, calculatedPath);

    // 4. Update descendants paths
    const descendants = await vaultRepository.findDescendants(oldPath);
    for (const desc of descendants) {
      const relativeSuffix = desc.path.slice(oldPath.length);
      const descNewPath = calculatedPath + relativeSuffix;
      await vaultRepository.updateFolder(desc.id, {
        path: descNewPath,
        vaultId: resolvedVaultId,
      });
    }

    return movedFolder;
  }

  /**
   * Soft-delete a Folder and propagate to all nested sub-folders/documents.
   */
  async deleteFolder(id) {
    const folder = await vaultRepository.findFolderById(id);
    if (!folder) throw new Error('Folder not found.');

    const deletedFolder = await vaultRepository.deleteFolder(id);

    // Soft delete all sub-folders recursively
    const descendants = await vaultRepository.findDescendants(folder.path);
    const descendantIds = descendants.map(d => d.id);

    if (descendantIds.length > 0) {
      await prisma.folder.updateMany({
        where: { id: { in: descendantIds } },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }

    // Soft delete all documents in the folder and its sub-folders
    const targetFolderIds = [id, ...descendantIds];
    await prisma.document.updateMany({
      where: { folderId: { in: targetFolderIds } },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return deletedFolder;
  }

  /**
   * Restore a soft-deleted Folder and recursively restore all subfolders/documents.
   */
  async restoreFolder(id) {
    const restoredFolder = await vaultRepository.restoreFolder(id);

    // Fetch descendants based on path to restore
    const descendants = await prisma.folder.findMany({
      where: {
        path: { startsWith: restoredFolder.path === '/' ? '/' : `${restoredFolder.path}/` },
        isDeleted: true,
      },
    });
    const descendantIds = descendants.map(d => d.id);

    if (descendantIds.length > 0) {
      await prisma.folder.updateMany({
        where: { id: { in: descendantIds } },
        data: { isDeleted: false, deletedAt: null },
      });
    }

    // Restore all documents in the folder and its sub-folders
    const targetFolderIds = [id, ...descendantIds];
    await prisma.document.updateMany({
      where: { folderId: { in: targetFolderIds }, isDeleted: true },
      data: { isDeleted: false, deletedAt: null },
    });

    return restoredFolder;
  }

  /**
   * List the contents (sub-folders and documents) directly inside a folder.
   */
  async listFolderContents(folderId, vaultId) {
    if (folderId) {
      const folder = await vaultRepository.findFolderById(folderId);
      if (!folder) throw new Error('Folder not found.');
    }
    return vaultRepository.listFolderContents(folderId, vaultId);
  }

  /**
   * Get Folder Tree for a vault.
   */
  async getFolderTree(vaultId) {
    const folders = await vaultRepository.getFolderTree(vaultId);
    return buildFolderTree(folders, null);
  }

  /**
   * Compile Breadcrumb path mapping back to root folder/vault.
   */
  async getBreadcrumb(folderId) {
    const folder = await vaultRepository.findFolderById(folderId);
    if (!folder) throw new Error('Folder not found.');

    const allFolders = await vaultRepository.getFolderTree(folder.vaultId);
    return buildBreadcrumb(allFolders, folderId);
  }

  /**
   * Fetch folder details.
   */
  async getFolderDetails(id) {
    const folder = await vaultRepository.findFolderById(id);
    if (!folder) throw new Error('Folder not found.');
    return folder;
  }
}

export default VaultService;
