import { prisma } from '../config/database.js';

export class VaultRepository {
  /**
   * Create a new Vault record.
   * 
   * @async
   * @method createVault
   * @param {Object} data - Vault creation parameters
   * @returns {Promise<Object>} Created Vault record
   */
  async createVault(data) {
    return prisma.vault.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        status: 'ACTIVE',
        ownerId: data.ownerId,
        departmentId: data.departmentId,
      },
    });
  }

  /**
   * Update an existing Vault record.
   * 
   * @async
   * @method updateVault
   * @param {string} id - Vault primary UUID
   * @param {Object} data - Parameters to update
   * @returns {Promise<Object>} Updated Vault record
   */
  async updateVault(id, data) {
    return prisma.vault.update({
      where: { id },
      data,
    });
  }

  /**
   * Find a Vault by ID.
   * 
   * @async
   * @method findVault
   * @param {string} id - Vault primary UUID
   * @returns {Promise<Object|null>} Found Vault record or null
   */
  async findVault(id) {
    return prisma.vault.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        owner: true,
        department: true,
      },
    });
  }

  /**
   * List all non-deleted Vaults with filtering and pagination.
   * 
   * @async
   * @method listVaults
   * @param {Object} params - Filtering, search, and pagination details
   * @returns {Promise<{vaults: Array<Object>, total: number}>} List of vaults and count
   */
  async listVaults(params) {
    const { page = 1, limit = 10, status, type, search } = params;
    const skip = (page - 1) * limit;

    const whereClause = {
      isDeleted: false,
      ...(status && { status }),
      ...(type && { type }),
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const [vaults, total] = await prisma.$transaction([
      prisma.vault.findMany({
        where: whereClause,
        include: {
          owner: true,
          department: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.vault.count({
        where: whereClause,
      }),
    ]);

    return { vaults, total };
  }

  /**
   * Archive a Vault (updates status flag to ARCHIVED).
   * 
   * @async
   * @method archiveVault
   * @param {string} id - Vault primary UUID
   * @returns {Promise<Object>} Archived Vault record
   */
  async archiveVault(id) {
    return prisma.vault.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        isArchived: true,
      },
    });
  }

  /**
   * Create a new Folder record.
   * 
   * @async
   * @method createFolder
   * @param {Object} data - Folder creation details
   * @returns {Promise<Object>} Created Folder record
   */
  async createFolder(data) {
    return prisma.folder.create({
      data: {
        name: data.name,
        parentId: data.parentId || null,
        vaultId: data.vaultId || null,
        departmentId: data.departmentId || null,
        ownerId: data.ownerId,
        path: data.path || '/',
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Update Folder attributes (e.g. name, status, archiving).
   * 
   * @async
   * @method updateFolder
   * @param {string} id - Folder primary UUID
   * @param {Object} data - Parameters to update
   * @returns {Promise<Object>} Updated Folder record
   */
  async updateFolder(id, data) {
    return prisma.folder.update({
      where: { id },
      data,
    });
  }

  /**
   * Move a folder by updating parent, vault, and path attributes.
   * 
   * @async
   * @method moveFolder
   * @param {string} id - Folder primary UUID
   * @param {string|null} parentId - Target parent folder ID
   * @param {string|null} vaultId - Target vault ID
   * @param {string} path - Target absolute path
   * @returns {Promise<Object>} Moved folder record
   */
  async moveFolder(id, parentId, vaultId, path) {
    return prisma.folder.update({
      where: { id },
      data: {
        parentId,
        vaultId,
        path,
      },
    });
  }

  /**
   * Soft-delete a folder and all its child hierarchies.
   * 
   * @async
   * @method deleteFolder
   * @param {string} id - Folder primary UUID
   * @returns {Promise<Object>} Soft-deleted Folder record
   */
  async deleteFolder(id) {
    return prisma.folder.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Restore a soft-deleted folder.
   * 
   * @async
   * @method restoreFolder
   * @param {string} id - Folder primary UUID
   * @returns {Promise<Object>} Restored Folder record
   */
  async restoreFolder(id) {
    return prisma.folder.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  /**
   * Fetch all folders matching parentId/vaultId criteria to build hierarchy tree.
   * 
   * @async
   * @method getFolderTree
   * @param {string|null} vaultId - Vault filter target
   * @returns {Promise<Array<Object>>} Folders list
   */
  async getFolderTree(vaultId) {
    return prisma.folder.findMany({
      where: {
        vaultId,
        isDeleted: false,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Query a folder details with its parent recursive loops representation.
   * 
   * @async
   * @method getFolderPath
   * @param {string} id - Folder primary UUID
   * @returns {Promise<Object|null>} Detailed folder with parent information
   */
  async getFolderPath(id) {
    return prisma.folder.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        parent: true,
      },
    });
  }

  /**
   * Lists the immediate contents (sub-folders and documents) under a directory node.
   * 
   * @async
   * @method listFolderContents
   * @param {string|null} folderId - Target folder ID
   * @param {string|null} vaultId - Target vault ID
   * @returns {Promise<{folders: Array<Object>, documents: Array<Object>}>} Children list
   */
  async listFolderContents(folderId, vaultId) {
    const [folders, documents] = await prisma.$transaction([
      prisma.folder.findMany({
        where: {
          parentId: folderId,
          vaultId,
          isDeleted: false,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.document.findMany({
        where: {
          folderId,
          vaultId,
          isDeleted: false,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { folders, documents };
  }

  /**
   * Get Folder by ID.
   * 
   * @async
   * @method findFolderById
   * @param {string} id - Folder UUID
   * @returns {Promise<Object|null>} Found Folder or null
   */
  async findFolderById(id) {
    return prisma.folder.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });
  }

  /**
   * Find folder by parent and name (to prevent duplicate names under same parent).
   * 
   * @async
   * @method findByNameAndParent
   * @param {string} name - Target folder name
   * @param {string|null} parentId - Target parent folder ID
   * @param {string|null} vaultId - Target vault ID
   * @returns {Promise<Object|null>} Existing duplicate folder or null
   */
  async findByNameAndParent(name, parentId, vaultId) {
    return prisma.folder.findFirst({
      where: {
        name,
        parentId: parentId || null,
        vaultId: vaultId || null,
        isDeleted: false,
      },
    });
  }

  /**
   * List all subfolders recursively under a parent path.
   * 
   * @async
   * @method findDescendants
   * @param {string} parentPath - Target parent path prefix
   * @returns {Promise<Array<Object>>} Descendants list
   */
  async findDescendants(parentPath) {
    return prisma.folder.findMany({
      where: {
        path: {
          startsWith: parentPath === '/' ? '/' : `${parentPath}/`,
        },
        isDeleted: false,
      },
    });
  }
}

export default VaultRepository;
