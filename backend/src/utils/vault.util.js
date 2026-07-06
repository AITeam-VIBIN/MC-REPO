/**
 * Build a hierarchical folder tree structure from a flat array of folder records.
 * 
 * @function buildFolderTree
 * @param {Array<Object>} folders - Flat list of folder records
 * @param {string|null} [parentId=null] - The root or parent identifier to start building from
 * @returns {Array<Object>} Hierarchical nested tree array
 */
export function buildFolderTree(folders, parentId = null) {
  return folders
    .filter(f => f.parentId === parentId)
    .map(f => ({
      ...f,
      subFolders: buildFolderTree(folders, f.id)
    }));
}

/**
 * Build a breadcrumb path mapping folders back to their root.
 * 
 * @function buildBreadcrumb
 * @param {Array<Object>} folders - All system folders or folders in a vault
 * @param {string|null} folderId - Target folder primary identifier
 * @returns {Array<Object>} Array of folder nodes representing path, ordered root to leaf
 */
export function buildBreadcrumb(folders, folderId) {
  if (!folderId) return [];

  const crumbs = [];
  let current = folders.find(f => f.id === folderId);

  while (current) {
    crumbs.unshift({
      id: current.id,
      name: current.name,
      path: current.path
    });
    current = current.parentId ? folders.find(f => f.id === current.parentId) : null;
  }

  return crumbs;
}

/**
 * Normalize folder path string format (strips extra slashes, adds single leading slash).
 * 
 * @function normalizeFolderPath
 * @param {string} path - Folder path input
 * @returns {string} Normalized clean path
 */
export function normalizeFolderPath(path) {
  if (!path) return '/';
  
  // Replace multiple slashes with a single slash
  let clean = path.replace(/\/+/g, '/');

  // Strip trailing slash unless it is just root
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }

  // Ensure leading slash
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }

  return clean;
}

/**
 * Generate absolute hierarchy path string combining parent path with new folder name.
 * 
 * @function generateHierarchyPath
 * @param {string|null} parentPath - Absolute path of parent folder (or null for root level)
 * @param {string} folderName - Name of current folder
 * @returns {string} Combined absolute path
 */
export function generateHierarchyPath(parentPath, folderName) {
  const base = parentPath ? parentPath : '';
  return normalizeFolderPath(`${base}/${folderName}`);
}

/**
 * Validate folder hierarchy depth by counting path slash segments.
 * 
 * @function validateHierarchyDepth
 * @param {string} path - Absolute path of folder
 * @param {number} [maxDepth=10] - Permitted nesting limits depth
 * @returns {boolean} True if within limits, false if too deep
 */
export function validateHierarchyDepth(path, maxDepth = 10) {
  const normalized = normalizeFolderPath(path);
  // Root path is level 0. Count how many segments exist.
  const segments = normalized.split('/').filter(Boolean);
  return segments.length <= maxDepth;
}

/**
 * Generate URL-friendly slug from string.
 * 
 * @function generateSlug
 * @param {string} text - Alphanumeric text to convert
 * @returns {string} Slug string
 */
export function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

export default {
  buildFolderTree,
  buildBreadcrumb,
  normalizeFolderPath,
  generateHierarchyPath,
  validateHierarchyDepth,
  generateSlug,
};
